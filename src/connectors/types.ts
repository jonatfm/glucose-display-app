import type { GlucoseReading } from "../glucose/types";
import type { InsulinDose, InsulinOnBoard } from "../insulin/types";

export const MINIMUM_READINGS_FOR_DELTA = 2;

export type ReadingRequest = {
    historySeconds: number;
    minimumReadings: number;
    signal: AbortSignal;
}

export interface GlucoseConnector {
    getReadings(request: ReadingRequest): Promise<GlucoseReading[]>;
    getInsulinOnBoard(signal: AbortSignal): Promise<InsulinOnBoard | null>;
    getInsulinDoses(request: Pick<ReadingRequest, "historySeconds" | "signal">): Promise<InsulinDose[]>;
    testConnection(signal: AbortSignal): Promise<void>;
}
