import type { GlucoseReading } from "../glucose/types";
import type { ReadingRequest } from "./types";

type ReadingBatch = {readings: GlucoseReading[]; receivedCount: number};
type HistoryOptions = {initialCount: number; canPage: boolean};

// Grow the request until timestamps cover the window, rather than assuming
// every sensor samples at five-minute intervals. Nightscout can page further;
// xDrip's local API caps a response at 1000 readings and cannot page by date.
export const fetchReadingHistory = async (
    {historySeconds, minimumReadings, signal}: ReadingRequest,
    readBatch: (count: number, before?: number) => Promise<ReadingBatch>,
    {initialCount, canPage}: HistoryOptions,
    now = Date.now(),
): Promise<{readings: GlucoseReading[]; requestedCount: number}> => {
    const maxCount = 1000;
    let count = Math.min(maxCount, Math.max(minimumReadings,
        historySeconds > 0 ? Math.max(initialCount, Math.ceil(historySeconds / 300) + 1) : 0));
    const start = now - historySeconds * 1000;
    const byTimestamp = new Map<number, GlucoseReading>();
    let previousOldest: number | null = null;
    let before: number | undefined;

    while (true) {
        if (signal.aborted) throw new Error("Request aborted");
        const batch = await readBatch(count, before);
        for (const reading of batch.readings) {
            const time = reading.measuredAt.getTime();
            if (!byTimestamp.has(time)) byTimestamp.set(time, reading);
        }
        const readings = [...byTimestamp.values()].sort(
            (a, b) => a.measuredAt.getTime() - b.measuredAt.getTime(),
        );
        const oldest = readings[0]?.measuredAt.getTime();
        const result = {readings, requestedCount: count};

        if (historySeconds === 0 || oldest === undefined || oldest <= start ||
            batch.receivedCount < count ||
            (previousOldest !== null && oldest >= previousOldest)) {
            return result;
        }
        previousOldest = oldest;

        if (count < maxCount) {
            count = Math.min(maxCount, count * 2);
        } else if (canPage) {
            before = oldest - 1;
        } else {
            return result;
        }
    }
};
