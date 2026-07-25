import { View } from "react-native";
import { useAppConfig } from "../config/AppConfigProvider";
import type { GlucoseReading } from "../glucose/types";

const POINT_SIZE = 4;
const POINT_RADIUS = POINT_SIZE / 2;

type GlucoseGraphProps = {
    now: number;
    readings: GlucoseReading[];
};

export default function GlucoseGraph({
    now,
    readings,
}: GlucoseGraphProps) {
    const {config} = useAppConfig();
    const historyMilliseconds = config.graph.historySeconds * 1000;
    const glucoseRange = config.graph.ceiling - config.graph.floor;

    return (
        <View style={{
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
    );
}
