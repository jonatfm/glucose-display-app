import { Platform, StyleSheet, Text, View } from "react-native";
import MainView from "../components/MainView";
import { AppConfigProvider, useAppConfig } from "../config/AppConfigProvider";
import { useMemo } from "react";
import { createConnector } from "../connectors/createConnector";
import { useGlucoseReadings } from "../glucose/useGlucoseReadings";
import { useKeepAwake } from "expo-keep-awake";
import { NavigationBar } from "expo-navigation-bar";
import { StatusBar } from "expo-status-bar";
import GlucoseGraph from "../components/GlucoseGraph";
import { formatGlucose } from "../glucose/units";
import { getGlucoseDisplayStatus } from "../glucose/displayStatus";
import { getTrendDirectionSymbol } from "../glucose/trendDirection";

const DISPLAY_JUSTIFY_CONTENT = {
    top: "flex-start",
    middle: "center",
    bottom: "flex-end",
} as const;

function KeepScreenAwake() {
    useKeepAwake();
    return null;
}

function DisplayEffects() {
    const {config} = useAppConfig();

    return (
        <>
            {config.display.keepScreenAwake
                ? <KeepScreenAwake />
                : null}
            <StatusBar
                hidden={config.display.hideSystemUi}
                style="light"
            />
            {Platform.OS === "android" ? (
                <NavigationBar
                    hidden={config.display.hideSystemUi}
                    style="dark"
                />
            ) : null}
        </>
    );
}

function AppContent() {
    const {config, isLoaded} = useAppConfig();

    const connector = useMemo(
        () => createConnector(config.source),
        [config.source]
    );

    const {
        latestReading,
        status,
        error,
        now,
        readings
    } = useGlucoseReadings({
        connector: isLoaded ? connector : null,
        historySeconds: config.graph.historySeconds,
        intervalSeconds: config.polling.intervalSeconds,
    });

    const displayStatus = getGlucoseDisplayStatus({
        connectionStatus: status,
        latestReading,
        now,
        staleAfterSeconds: config.polling.staleAfterSeconds,
    });

    if (!isLoaded) {
        return (
            <View style={styles.messageContainer}>
                <Text style={styles.message}>Loading configuration...</Text>
                <Text style={styles.text}>Hold the screen to go to settings</Text>
            </View>
        );
    }

    if (status === "disabled") {
        return (
            <View style={styles.messageContainer}>
                <Text style={styles.message}>No glucose source configured!</Text>
                <Text style={styles.text}>Hold the screen to go to settings</Text>
            </View>
        )
    }

    if (status === "connecting" && latestReading === null) {
        return (
            <View style={styles.messageContainer}>
                <Text style={styles.message}>Connecting...</Text>
                <Text style={styles.statusText}>CONNECTING</Text>
                <Text style={styles.text}>Hold the screen to go to settings</Text>
            </View>
        )
    }

    if (latestReading === null) {
        return (
            <View style={styles.messageContainer}>
                <Text style={[styles.message, {color: "#ff0000"}]}>{error ?? "No glucose reading available"}</Text>
                <Text style={styles.statusText}>
                    {displayStatus ?? "OFFLINE"}
                </Text>
                <Text style={styles.text}>Hold the screen to go to settings</Text>
            </View>
        )
    }

    const ageSeconds = Math.max(
        Math.floor(
            (now - latestReading.measuredAt.getTime()) / 1000,
        ),
        0,
    );

    const isStale = ageSeconds > config.polling.staleAfterSeconds;
    const trendDirection = getTrendDirectionSymbol(
        latestReading.direction,
    );

    return (
        <View
            style={[
                styles.displayContainer,
                {
                    justifyContent:
                        DISPLAY_JUSTIFY_CONTENT[config.display.align],
                },
            ]}
        >
            <View style={[
                styles.bloodsugarContainer,
                latestReading.valueMgDl <= config.display.criticalLowThreshold && {backgroundColor: "#ff0000", borderRadius: 16},
            ]}>
                <Text style={styles.statusText}>
                    {displayStatus}
                </Text>
                <Text
                    style={[
                        styles.text,
                        isStale && styles.staleText,
                        {
                            fontSize: config.display.textSize,
                        },
                        latestReading.valueMgDl >= config.display.highThreshold && {color: "#ffff00"},
                        latestReading.valueMgDl <= config.display.lowThreshold && latestReading.valueMgDl > config.display.criticalLowThreshold && {color: "#ff0000"},
                    ]}
                >
                    {formatGlucose(
                        latestReading.valueMgDl,
                        config.display.unit,
                    )}
                    {!config.display.showTrend ||
                    trendDirection === null
                        ? null
                        : ` ${trendDirection}`}
                </Text>
                <View style={{flexDirection: "row", gap: config.display.textSize / 3}}>
                    {config.display.showAge ? (
                        <Text style={[styles.text, {fontSize: config.display.textSize / 4}]}>
                            {Math.floor(ageSeconds / 60)}m
                        </Text>
                    ) : null}
                    {config.display.showDelta &&
                    latestReading.deltaMgDl !== null ? (
                        <Text style={[styles.text, {fontSize: config.display.textSize / 4}]}>
                            Δ {latestReading.deltaMgDl >= 0 ? '+' : ''}{formatGlucose(
                                latestReading.deltaMgDl,
                                config.display.unit,
                            )}
                        </Text>
                    ) : null}
                </View>
            </View>

            {config.graph.show ? (
                <GlucoseGraph now={now} readings={readings} />
            ) : null}
        </View>
    )
}

export default function App() {
    return (
        <AppConfigProvider>
            <DisplayEffects />
            <MainView>
                <AppContent />
            </MainView>
        </AppConfigProvider>
    )
}

const styles = StyleSheet.create({
    text: {
        color: "#fff",
        fontWeight: "bold",
    },
    staleText: {
        color: "#fff",
        textDecorationLine: "line-through",
    },
    message: {
        color: "#fff",
        fontSize: 18,
        fontWeight: "bold",
    },
    statusText: {
        color: "#fff",
    },
    messageContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 16,
    },
    displayContainer: {
        flex: 1,
        marginVertical: 16,
    },
    bloodsugarContainer: {
        padding: 16,
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
    }
})
