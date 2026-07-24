import { AppConfig } from "./types";

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

    return (
        value.schemaVersion === 1 &&
        isObject(source) &&
        source.type === "xdrip" &&
        typeof source.baseUrl === "string" &&
        isObject(polling) &&
        typeof polling.intervalSeconds === "number" &&
        typeof polling.staleAfterSeconds === "number" &&
        typeof polling.historySeconds === "number" &&
        isObject(display) &&
        (display.unit === "mg/dl" ||
            display.unit === "mmol/L") &&
        typeof display.keepScreenAwake === "boolean" &&
        typeof display.hideSystemUi === "boolean"
    );
};