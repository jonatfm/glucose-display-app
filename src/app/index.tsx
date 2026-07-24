import { StyleSheet, Text, View } from "react-native";
import MainView from "../components/MainView";
import { AppConfigProvider, useAppConfig } from "../config/AppConfigProvider";
import { useMemo } from "react";
import { createConnector } from "../connectors/createConnector";
import { useGlucoseReadings } from "../glucose/useGlucoseReadings";

function formatGlucose(
    valueMgDl: number,
    unit: "mg/dL" | "mmol/L"
) {
    return unit === "mmol/L"
        ? (valueMgDl / 18).toFixed(1)
        : String(Math.round(valueMgDl));
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
    } = useGlucoseReadings({
        connector: isLoaded ? connector : null,
        historySeconds: config.polling.historySeconds,
        intervalSeconds: config.polling.intervalSeconds,
    });

    if (!isLoaded) {
        return (
            <View style={styles.messageContainer}>
                <Text style={styles.message}>Loading configuration...</Text>
                <Text style={styles.text}>Hold the screen for 2 seconds to go to settings</Text>
            </View>
        );
    }

    if (status === "disabled") {
        return (
            <View style={styles.messageContainer}>
                <Text style={styles.message}>No glucose source configured!</Text>
                <Text style={styles.text}>Hold the screen for 2 seconds to go to settings</Text>
            </View>
        )
    }

    if (status === "loading") {
        return (
            <View style={styles.messageContainer}>
                <Text style={styles.message}>Connecting...</Text>
                <Text style={styles.text}>Hold the screen for 2 seconds to go to settings</Text>
            </View>
        )
    }

    if (latestReading === null) {
        return (
            <View style={styles.messageContainer}>
                <Text style={[styles.message, {color: "#ff0000"}]}>{error ?? "No glucose reading available"}</Text>
                <Text style={styles.text}>Hold the screen for 2 seconds to go to settings</Text>
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
        <View>
            <Text style={styles.text}>{formatGlucose(latestReading.valueMgDl, config.display.unit)}</Text>
        </View>
    )
}

export default function App() {
    return (
        <AppConfigProvider>
            <MainView>
                <AppContent />
            </MainView>
        </AppConfigProvider>
    )
}

const styles = StyleSheet.create({
    text: {
        color: "#fff",
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
    }
})