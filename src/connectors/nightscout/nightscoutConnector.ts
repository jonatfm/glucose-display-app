import type { NightscoutSourceConfig } from "../../config/types";
import { fetchWithTimeout } from "../fetchWithTimeout";
import {
    MINIMUM_READINGS_FOR_DELTA,
    type GlucoseConnector,
} from "../types";
import { loadNightscoutToken } from "./nightscoutCredentials";
import { parseNightscoutReadings } from "./nightscoutParser";
import { createNightscoutReadingsUrl } from "./nightscoutUrl";

const REQUEST_TIMEOUT_MILLISECONDS = 10_000;

type NightscoutConnectorOptions = {
    token?: string;
};

const responseError = (status: number): Error => {
    if (status === 401 || status === 403) {
        return new Error(
            "Nightscout token is missing, invalid, revoked, or lacks read permission",
        );
    }

    if (status === 404) {
        return new Error(
            "This does not look like a compatible Nightscout server",
        );
    }

    return new Error(`Nightscout returned HTTP ${status}`);
};

export const createNightscoutConnector = (
    config: NightscoutSourceConfig,
    options: NightscoutConnectorOptions = {},
): GlucoseConnector => {
    let tokenPromise: Promise<string | null> | null = null;

    const getToken = (): Promise<string | null> => {
        if (config.authentication === "none") {
            return Promise.resolve(null);
        }

        if (options.token !== undefined) {
            return Promise.resolve(options.token.trim() || null);
        }

        tokenPromise ??= loadNightscoutToken(config.credentialId);
        return tokenPromise;
    };

    return {
        async getReadings({
            historySeconds,
            minimumReadings,
            signal,
        }) {
            const historyReadingCount =
                Math.ceil(historySeconds / 300) + 1;
            const count = Math.max(
                historyReadingCount,
                minimumReadings,
            );
            const token = await getToken();

            if (config.authentication === "access-token" &&
                token === null) {
                throw new Error(
                    "The stored Nightscout token is unavailable; replace it in settings",
                );
            }

            let response: Response;

            try {
                response = await fetchWithTimeout(
                    createNightscoutReadingsUrl(
                        config.baseUrl,
                        count,
                    ).toString(),
                    {
                        headers: {
                            Accept: "application/json",
                            ...(token === null
                                ? {}
                                : {"api-secret": token}),
                        },
                        redirect: "error",
                        signal,
                    },
                    REQUEST_TIMEOUT_MILLISECONDS,
                );
            } catch (error) {
                if (signal.aborted ||
                    (
                        error instanceof Error &&
                        error.name === "FetchTimeoutError"
                    )) {
                    throw error;
                }

                throw new Error(
                    "Nightscout could not be reached securely",
                );
            }

            if (!response.ok) {
                throw responseError(response.status);
            }

            let payload: unknown;

            try {
                payload = await response.json();
            } catch {
                throw new Error(
                    "Nightscout returned an unsupported response",
                );
            }

            const readings = parseNightscoutReadings(payload);

            if (readings.length === 0) {
                throw new Error(
                    "Connected, but Nightscout returned no usable glucose readings",
                );
            }

            return readings;
        },

        async testConnection(signal) {
            await this.getReadings({
                historySeconds: 1800,
                minimumReadings: MINIMUM_READINGS_FOR_DELTA,
                signal,
            });
        },
    };
};
