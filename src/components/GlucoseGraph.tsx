import { useState } from "react";
import { Text, View } from "react-native";
import { useAppConfig } from "../config/AppConfigProvider";
import type { GlucoseReading } from "../glucose/types";
import type { InsulinDose } from "../insulin/types";
import {
    DOSE_ROW_HEIGHT,
    formatInsulin,
    INSULIN_COLOR,
    layoutInsulinDoses,
} from "../insulin/display";

const POINT_SIZE = 4;
const POINT_RADIUS = POINT_SIZE / 2;
const INSULIN_LINE_WIDTH = 3;

type GlucoseGraphProps = {
    now: number;
    readings: GlucoseReading[];
    doses: InsulinDose[];
};

export default function GlucoseGraph({
    now,
    readings,
    doses,
}: GlucoseGraphProps) {
    const {config} = useAppConfig();
    const [width, setWidth] = useState(0);
    const historyMilliseconds = config.graph.historySeconds * 1000;
    const glucoseRange = config.graph.ceiling - config.graph.floor;
    const markers = config.display.showInsulinOnBoard && width > 0
        ? layoutInsulinDoses(doses, now, config.graph.historySeconds, width)
        : [];
    const markerRows = markers.reduce((rows, marker) => Math.max(rows, marker.row + 1), 0);

    return (
        <View style={{width: "100%"}}>
            <View
                onLayout={(event) => setWidth(Math.max(0, event.nativeEvent.layout.width - 2))}
                style={{
                    borderWidth: 1,
                    borderColor: "#ffffff",
                    width: "100%",
                    aspectRatio: config.graph.aspectRatio,
                }}>
            <View style={{
                flex: 1,
                overflow: "hidden",
                position: "relative",
            }}>
                {markers.map(({dose, fraction}) => (
                    <View
                        key={`guide-${dose.id}`}
                        style={{
                            position: "absolute",
                            left: `${fraction * 100}%`,
                            top: 0,
                            bottom: 0,
                            width: INSULIN_LINE_WIDTH,
                            transform: [{translateX: -INSULIN_LINE_WIDTH / 2}],
                            backgroundColor: INSULIN_COLOR,
                        }}
                    />
                ))}
                <View
                    style={{
                        position: "absolute",
                        width: "100%",
                        height: 2,
                        backgroundColor: "#ffff00",
                        top: `${(config.graph.ceiling - config.display.highThreshold) / glucoseRange * 100}%`,
                    }}
                />
                <View
                    style={{
                        position: "absolute",
                        width: "100%",
                        height: 2,
                        backgroundColor: "#ff0000",
                        top: `${(config.graph.ceiling - config.display.lowThreshold) / glucoseRange * 100}%`,
                    }}
                />

                {readings.map((reading) => {
                    const ageMilliseconds =
                        now - reading.measuredAt.getTime();

                    if (
                        !Number.isFinite(ageMilliseconds) ||
                        !Number.isFinite(reading.valueMgDl) ||
                        ageMilliseconds < 0 ||
                        ageMilliseconds > historyMilliseconds
                    ) {
                        return null;
                    }

                    const leftPercent =
                        (1 - ageMilliseconds / historyMilliseconds) * 100;
                    const topPercent =
                        (
                            config.graph.ceiling - reading.valueMgDl
                        ) / glucoseRange * 100;

                    return (
                        <View
                            key={reading.measuredAt.getTime()}
                            style={{
                                position: "absolute",
                                left: `${leftPercent}%`,
                                top: `${topPercent}%`,
                                width: POINT_SIZE,
                                height: POINT_SIZE,
                                borderRadius: POINT_RADIUS,
                                transform: [
                                    {translateX: -POINT_RADIUS},
                                    {translateY: -POINT_RADIUS},
                                ],
                                backgroundColor: "#fff",
                            }}
                        />
                    );
                })}
            </View>
            </View>
            {markerRows > 0 ? (
                <View
                    style={{
                        height: markerRows * DOSE_ROW_HEIGHT + 12,
                        marginHorizontal: 1,
                    }}
                >
                    {markers.map(({dose, fraction, labelLeft, labelWidth, row}) => (
                        <View key={dose.id}>
                            <View style={{
                                position: "absolute",
                                left: `${fraction * 100}%`,
                                top: 0,
                                height: row * DOSE_ROW_HEIGHT + 8,
                                width: INSULIN_LINE_WIDTH,
                                transform: [{translateX: -INSULIN_LINE_WIDTH / 2}],
                                backgroundColor: INSULIN_COLOR,
                            }} />
                            <View style={{
                                position: "absolute",
                                left: `${fraction * 100}%`,
                                top: row * DOSE_ROW_HEIGHT + 4,
                                width: 8,
                                height: 8,
                                borderRadius: 4,
                                transform: [{translateX: -4}],
                                backgroundColor: INSULIN_COLOR,
                            }} />
                            <Text
                                accessibilityLabel={`${formatInsulin(dose.units)} insulin at ${dose.deliveredAt.toLocaleTimeString()}`}
                                numberOfLines={1}
                                style={{
                                    position: "absolute",
                                    top: row * DOSE_ROW_HEIGHT + 14,
                                    left: labelLeft,
                                    width: labelWidth,
                                    textAlign: "center",
                                    fontSize: 12,
                                    fontWeight: "600",
                                    color: INSULIN_COLOR,
                                    backgroundColor: "#000",
                                }}
                            >
                                {formatInsulin(dose.units)}
                            </Text>
                        </View>
                    ))}
                </View>
            ) : null}
        </View>
    );
}
