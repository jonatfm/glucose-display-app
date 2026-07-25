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
            source.type === "none" ||
            (
                source.type === "xdrip" &&
                typeof source.baseUrl === "string"
            )
        );

    const hasValidShape = (
        value.schemaVersion === 2 &&
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
