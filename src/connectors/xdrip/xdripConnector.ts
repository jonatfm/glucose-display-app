import type { XdripSourceConfig } from "../../config/types";
import {
    MINIMUM_READINGS_FOR_DELTA,
    type GlucoseConnector,
} from "../types";
import { parseXdripReadings } from "./xdripParser";
import { fetchWithTimeout } from "../fetchWithTimeout";
import { fetchReadingHistory } from "../readingHistory";
import { parseInsulinDoses, parseXdripInsulinOnBoard } from "../../insulin/parser";

const REQUEST_TIMEOUT_MILLISECONDS = 10_000;

export function createXdripConnector(
    config: XdripSourceConfig,
) : GlucoseConnector {
    let readingCount = MINIMUM_READINGS_FOR_DELTA;
    const createUrl = (count: number) => {
        const url = new URL("/sgv.json", config.baseUrl);

        url.searchParams.set("count", String(count));

        return url;
    };

    const getInsulinJson = async (path: string, signal: AbortSignal): Promise<unknown> => {
        const response = await fetchWithTimeout(
            new URL(path, config.baseUrl).toString(),
            {headers: {Accept: "application/json"}, signal},
            REQUEST_TIMEOUT_MILLISECONDS,
        );
        if (!response.ok) throw new Error(`xDrip returned HTTP ${response.status}`);
        return response.json();
    };

    return {
        async getReadings({
            historySeconds,
            minimumReadings,
            signal,
        }) {
            const result = await fetchReadingHistory(
                {historySeconds, minimumReadings, signal},
                async (count) => {
                    const response = await fetchWithTimeout(
                        createUrl(count).toString(),
                        {
                            headers: {
                                Accept: "application/json",
                            },
                            signal,
                        },
                        REQUEST_TIMEOUT_MILLISECONDS,
                    );

                    if (!response.ok) {
                        throw new Error(`xDrip returned HTTP ${response.status}`);
                    }

                    const payload: unknown = await response.json();
                    const readings = parseXdripReadings(payload);

                    return {
                        readings,
                        receivedCount: Array.isArray(payload) ? payload.length : 1,
                    };
                },
                {initialCount: readingCount, canPage: false},
            );
            if (result.readings.length === 0) {
                throw new Error("xDrip returned no readings");
            }
            readingCount = result.requestedCount;
            return result.readings;
        },

        async getInsulinOnBoard(signal) {
            return parseXdripInsulinOnBoard(await getInsulinJson("/pebble", signal));
        },

        async getInsulinDoses({historySeconds, signal}) {
            const payload = await getInsulinJson("/treatments.json?count=100", signal);
            return parseInsulinDoses(payload, historySeconds);
        },

        async testConnection(signal) {
            await this.getReadings({
                historySeconds: 1800, // 30 minutes
                minimumReadings: MINIMUM_READINGS_FOR_DELTA,
                signal,
            });
        },
    };
}
