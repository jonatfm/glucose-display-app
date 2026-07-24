import type { XdripSourceConfig } from "../../config/types";
import type { GlucoseConnector } from "../types";
import { parseXdripReadings } from "./xdripParser";

export function createXdripConnector(
    config: XdripSourceConfig,
) : GlucoseConnector {
    const createUrl = (historySeconds: number) => {
        const count = Math.ceil(historySeconds / 300) + 1;
        const url = new URL("/sgv.json", config.baseUrl);

        url.searchParams.set("count", String(count));

        return url;
    };

    return {
        async getReadings({historySeconds, signal}) {
            const response = await fetch(createUrl(historySeconds), {
                headers: {
                    Accept: "application/json",
                },
                signal,
            });

            if (!response.ok) {
                throw new Error(`xDrip returned HTTP ${response.status}`);
            }

            const payload: unknown = await response.json();
            const readings = parseXdripReadings(payload);

            if (readings.length === 0) {
                throw new Error("xDrip returned no readings");
            }
            
            return readings;
        },

        async testConnection(signal) {
            await this.getReadings({
                historySeconds: 1800, // 30 minutes
                signal,
            });
        },
    };
}