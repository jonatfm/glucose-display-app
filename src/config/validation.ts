import type { AppConfig } from "./types";

const isObject = (
    value: unknown,
): value is Record<string, unknown> =>
    value !== null && typeof value === "object";

const isPositiveInteger = (value: unknown): value is number =>
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 1;

export const isAppConfig = (
    value: unknown,
): value is AppConfig => {
    if (!isObject(value)) {
        return false;
    }

    const {source, polling, display} = value;

    const isValidSource =
        isObject(source) &&
        (
            source.type === "none" ||
            (
                source.type === "xdrip" &&
                typeof source.baseUrl === "string"
            )
        );

    return (
        value.schemaVersion === 1 &&
        isValidSource &&
        isObject(polling) &&
        isPositiveInteger(polling.intervalSeconds) &&
        isPositiveInteger(polling.staleAfterSeconds) &&
        isPositiveInteger(polling.historySeconds) &&
        isObject(display) &&
        (display.unit === "mg/dL" ||
            display.unit === "mmol/L") &&
        typeof display.keepScreenAwake === "boolean" &&
        typeof display.hideSystemUi === "boolean" &&
        typeof display.showAge === "boolean" &&
        typeof display.showDelta === "boolean" &&
        isPositiveInteger(display.textSize)
    );
};
