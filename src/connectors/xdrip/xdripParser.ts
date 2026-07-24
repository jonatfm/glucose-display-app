import { GlucoseReading } from "../../glucose/types";

type XdripReading = {
    date?: unknown;
    delta?: unknown;
    direction?: unknown;
    sgv?: unknown;
};

const toNumber = (value: unknown): number | null => {
    const parsed =
        typeof value === "number"
            ? value
            : typeof value === "string"
                ? Number(value)
                : NaN;

    return Number.isFinite(parsed) ? parsed : null;
}

const parseReading = (
    value: unknown,
) : GlucoseReading | null => {
    if (value === null || typeof value !== "object") {
        return null;
    }

    const reading = value as XdripReading;
    const glucose = toNumber(reading.sgv);
    const timestamp = toNumber(reading.date);
    const delta = toNumber(reading.delta);

    if (glucose === null || timestamp === null) {
        return null;
    }

    return {
        valueMgDl: glucose,
        deltaMgDl: delta,
        measuredAt: new Date(timestamp),
        direction:
            typeof reading.direction === "string"
                ? reading.direction as GlucoseReading["direction"]
                : null,
    };
};

export const parseXdripReadings = (
    payload: unknown,
) : GlucoseReading[] => {
    const entries = Array.isArray(payload) ? payload : [payload];

    return entries
        .map(parseReading)
        .filter(
            (reading): reading is GlucoseReading =>
                reading !== null,
        )
        .sort(
            (first, second) => {
                return first.measuredAt.getTime() - second.measuredAt.getTime();
            }
        );
};