import type { AppConfig } from "./types";
import { getGlucoseRangeIssues } from "./glucoseRanges";

const isObject = (
    value: unknown,
): value is Record<string, unknown> =>
    value !== null && typeof value === "object";

const isPositiveInteger = (value: unknown): value is number =>
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 1;

const isPositiveNumber = (value: unknown): value is number =>
    typeof value === "number" &&
    Number.isFinite(value) &&
    value > 0;

const isSafeNightscoutBaseUrl = (value: unknown): value is string => {
    if (typeof value !== "string") {
        return false;
    }

    try {
        const url = new URL(value);

        return url.protocol === "https:" &&
            url.username.length === 0 &&
            url.password.length === 0 &&
            url.search.length === 0 &&
            url.hash.length === 0;
    } catch {
        return false;
    }
};

export const isAppConfig = (
    value: unknown,
): value is AppConfig => {
    if (!isObject(value)) {
        return false;
    }

    const {source, polling, display, graph} = value;

    const isValidSource =
        isObject(source) &&
        (
            source.selected === "none" ||
            source.selected === "xdrip" ||
            source.selected === "nightscout"
        ) &&
        isObject(source.configurations) &&
        isObject(source.configurations.xdrip) &&
        source.configurations.xdrip.type === "xdrip" &&
        typeof source.configurations.xdrip.baseUrl === "string" &&
        isObject(source.configurations.nightscout) &&
        source.configurations.nightscout.type === "nightscout" &&
        (
            source.configurations.nightscout.baseUrl === "" ||
            isSafeNightscoutBaseUrl(
                source.configurations.nightscout.baseUrl,
            )
        ) &&
        (
            source.selected !== "nightscout" ||
            isSafeNightscoutBaseUrl(
                source.configurations.nightscout.baseUrl,
            )
        ) &&
        (
            (
                source.configurations.nightscout.authentication ===
                    "none" &&
                source.configurations.nightscout.credentialId === null
            ) ||
            (
                source.configurations.nightscout.authentication ===
                    "access-token" &&
                typeof source.configurations.nightscout.credentialId ===
                    "string" &&
                source.configurations.nightscout.credentialId.length > 0
            )
        );

    const hasValidShape = (
        value.schemaVersion === 4 &&
        isValidSource &&
        isObject(polling) &&
        isPositiveInteger(polling.intervalSeconds) &&
        isPositiveInteger(polling.staleAfterSeconds) &&
        isObject(display) &&
        (display.unit === "mg/dL" ||
            display.unit === "mmol/L") &&
        typeof display.keepScreenAwake === "boolean" &&
        typeof display.hideSystemUi === "boolean" &&
        typeof display.showAge === "boolean" &&
        typeof display.showDelta === "boolean" &&
        typeof display.showTrend === "boolean" &&
        isPositiveInteger(display.textSize) &&
        isPositiveInteger(display.highThreshold) &&
        isPositiveInteger(display.lowThreshold) &&
        isPositiveInteger(display.criticalLowThreshold) &&
        (display.align === "top" || display.align === "middle" || display.align === "bottom") &&
        isObject(graph) &&
        typeof graph.show === "boolean" &&
        isPositiveInteger(graph.ceiling) &&
        isPositiveInteger(graph.floor) &&
        graph.ceiling > graph.floor &&
        isPositiveNumber(graph.aspectRatio) &&
        isPositiveInteger(graph.historySeconds)
    );

    if (!hasValidShape) {
        return false;
    }

    return getGlucoseRangeIssues(
        display as AppConfig["display"],
        graph as AppConfig["graph"],
    ).length === 0;
};
