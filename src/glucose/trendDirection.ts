import type { GlucoseReading } from "./types";

type TrendDirection = NonNullable<GlucoseReading["direction"]>;

const TREND_DIRECTION_SYMBOLS: Record<TrendDirection, string> = {
    DoubleUp: "↑↑",
    SingleUp: "↑",
    FortyFiveUp: "↗",
    Flat: "→",
    FortyFiveDown: "↘",
    SingleDown: "↓",
    DoubleDown: "↓↓",
};

export const getTrendDirectionSymbol = (
    direction: GlucoseReading["direction"],
): string | null =>
    direction === null
        ? null
        : TREND_DIRECTION_SYMBOLS[direction] ?? null;
