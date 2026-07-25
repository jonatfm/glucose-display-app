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

const DISPLAY_JUSTIFY_CONTENT = {
    top: "flex-start",
    middle: "center",
    bottom: "flex-end",
} as const;

function formatGlucose(
    valueMgDl: number,
    unit: "mg/dL" | "mmol/L"
) {
    return unit === "mmol/L"
        ? (valueMgDl / 18).toFixed(1)
        : String(Math.round(valueMgDl));
}

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

    if (status === "loading") {
        return (
            <View style={styles.messageContainer}>
                <Text style={styles.message}>Connecting...</Text>
                <Text style={styles.text}>Hold the screen to go to settings</Text>
            </View>
        )
    }

    if (latestReading === null) {
        return (
            <View style={styles.messageContainer}>
                <Text style={[styles.message, {color: "#ff0000"}]}>{error ?? "No glucose reading available"}</Text>
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
                </Text>
                <View style={{flexDirection: "row", gap: config.display.textSize / 3}}>
                    {config.display.showAge ? (
                        <Text style={[styles.text, {fontSize: config.display.textSize / 4}]}>
                            {Math.floor(ageSeconds / 60)}m
                        </Text>
                    ) : null}
                    {config.display.showDelta && latestReading.deltaMgDl ? (
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
