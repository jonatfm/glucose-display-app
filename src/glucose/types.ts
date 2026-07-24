export type GlucoseReading = {
    valueMgDl: number;
    deltaMgDl: number | null;
    measuredAt: Date;
    direction: "DoubleUp" | "SingleUp" | "FortyFiveUp" | "Flat" | "FortyFiveDown" | "SingleDown" | "DoubleDown" | null;
}