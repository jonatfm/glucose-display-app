import type { GlucoseReading } from "../../glucose/types";

const MINIMUM_GLUCOSE_MG_DL = 20;
const MAXIMUM_GLUCOSE_MG_DL = 600;
const MAXIMUM_FUTURE_SKEW_MILLISECONDS = 5 * 60 * 1000;

const DIRECTIONS = new Set<NonNullable<GlucoseReading["direction"]>>([
    "DoubleUp",
    "SingleUp",
    "FortyFiveUp",
    "Flat",
    "FortyFiveDown",
    "SingleDown",
    "DoubleDown",
]);

const toFiniteNumber = (value: unknown): number | null => {
    const parsed =
        typeof value === "number"
            ? value
            : typeof value === "string" && value.trim().length > 0
                ? Number(value)
                : NaN;

    return Number.isFinite(parsed) ? parsed : null;
};

const parseDirection = (
    value: unknown,
): GlucoseReading["direction"] =>
    typeof value === "string" &&
    DIRECTIONS.has(value as NonNullable<GlucoseReading["direction"]>)
        ? value as NonNullable<GlucoseReading["direction"]>
        : null;

export const parseNightscoutReadings = (
    payload: unknown,
    now = Date.now(),
): GlucoseReading[] => {
    if (!Array.isArray(payload)) {
        throw new Error("Nightscout returned an unsupported response");
    }

    const byTimestamp = new Map<number, Omit<GlucoseReading, "deltaMgDl">>();

    for (const entry of payload) {
        if (entry === null || typeof entry !== "object") {
            continue;
        }

        const candidate = entry as Record<string, unknown>;
        const valueMgDl = toFiniteNumber(candidate.sgv);
        const measuredAtMilliseconds =
            toFiniteNumber(candidate.date) ??
            (typeof candidate.dateString === "string"
                ? toFiniteNumber(Date.parse(candidate.dateString))
                : null);

        if (valueMgDl === null ||
            valueMgDl < MINIMUM_GLUCOSE_MG_DL ||
            valueMgDl > MAXIMUM_GLUCOSE_MG_DL ||
            measuredAtMilliseconds === null ||
            measuredAtMilliseconds <= 0 ||
            measuredAtMilliseconds > now + MAXIMUM_FUTURE_SKEW_MILLISECONDS) {
            continue;
        }

        // Nightscout normally returns newest first. Keeping the first entry
        // makes duplicate handling deterministic.
        if (!byTimestamp.has(measuredAtMilliseconds)) {
            byTimestamp.set(measuredAtMilliseconds, {
                valueMgDl,
                measuredAt: new Date(measuredAtMilliseconds),
                direction: parseDirection(candidate.direction),
            });
        }
    }

    const sorted = [...byTimestamp.values()].sort(
        (first, second) =>
            first.measuredAt.getTime() - second.measuredAt.getTime(),
    );

    return sorted.map((reading, index) => ({
        ...reading,
        deltaMgDl: index === 0
            ? null
            : reading.valueMgDl - sorted[index - 1].valueMgDl,
    }));
};
