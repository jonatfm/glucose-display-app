import type { GlucoseReading } from "../glucose/types";

export type ReadingRequest = {
    historySeconds: number;
    signal: AbortSignal;
}

export interface GlucoseConnector {
    getReadings(request: ReadingRequest): Promise<GlucoseReading[]>;
    testConnection(signal: AbortSignal): Promise<void>;
}