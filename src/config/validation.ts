import type { AppConfig } from "./types";

const isObject = (
    value: unknown,
): value is Record<string, unknown> =>
    value !== null && typeof value === "object";

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
        typeof polling.intervalSeconds === "number" &&
        typeof polling.staleAfterSeconds === "number" &&
        typeof polling.historySeconds === "number" &&
        isObject(display) &&
        (display.unit === "mg/dL" ||
            display.unit === "mmol/L") &&
        typeof display.keepScreenAwake === "boolean" &&
        typeof display.hideSystemUi === "boolean"
    );
};
