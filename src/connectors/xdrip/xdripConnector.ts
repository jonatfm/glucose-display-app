import type { XdripSourceConfig } from "../../config/types";
import type { GlucoseConnector } from "../types";
import { parseXdripReadings } from "./xdripParser";

export function createXdripConnector(
    config: XdripSourceConfig,
) : GlucoseConnector {
    const createUrl = (historyHours: number) => {
        const count = Math.ceil(historyHours * 12) + 1;
        const url = new URL("/sgv.son", config.baseUrl);

        url.searchParams.set("count", String(count));

        return url;
    };

    return {
        async getReadings({historyHours, signal}) {
            const response = await fetch(createUrl(historyHours), {
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
                historyHours: 0.5,
                signal,
            });
        },
    };
}