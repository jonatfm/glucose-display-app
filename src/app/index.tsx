import { Text, View } from "react-native";
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
            <View>
                <Text>Loading configuration...</Text>
            </View>
        );
    }

    if (status === "disabled") {
        return (
            <View>
                <Text>No glucose source configured</Text>
            </View>
        )
    }

    if (status === "loading") {
        return (
            <View>
                <Text>Connecting...</Text>
            </View>
        )
    }

    if (latestReading === null) {
        return (
            <View>
                <Text>{error ?? "No glucose reading available"}</Text>
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
            <Text>{formatGlucose(latestReading.valueMgDl, config.display.unit)}</Text>
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