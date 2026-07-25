import type { GlucoseReading } from "../glucose/types";

export const MINIMUM_READINGS_FOR_DELTA = 2;

export type ReadingRequest = {
    historySeconds: number;
    minimumReadings: number;
    signal: AbortSignal;
}

export interface GlucoseConnector {
    getReadings(request: ReadingRequest): Promise<GlucoseReading[]>;
    testConnection(signal: AbortSignal): Promise<void>;
}
