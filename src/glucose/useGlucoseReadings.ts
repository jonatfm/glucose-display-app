import { useEffect, useState } from "react";
import {
    MINIMUM_READINGS_FOR_DELTA,
    type GlucoseConnector,
} from "../connectors/types";
import { GlucoseReading } from "./types";
import type { ConnectionStatus } from "./displayStatus";

type GlucoseState = {
    readings: GlucoseReading[];
    latestReading: GlucoseReading | null;
    status: ConnectionStatus;
    error: string | null;
    now: number;
};

type UseGlucoseReadingsOptions = {
    connector: GlucoseConnector | null;
    historySeconds: number;
    intervalSeconds: number;
};

const EMPTY_STATE: GlucoseState = {
    readings: [],
    latestReading: null,
    status: "disabled",
    error: null,
    now: Date.now(),
};

export function useGlucoseReadings({
    connector,
    historySeconds,
    intervalSeconds,
}: UseGlucoseReadingsOptions): GlucoseState {
    const [state, setState] = useState<GlucoseState>(EMPTY_STATE);

    useEffect(() => {
        if (connector === null) {
            setState({
                ...EMPTY_STATE,
                now: Date.now(),
            });

            return;
        }

        let active = true;
        let controller: AbortController | null = null;
        let timeout: ReturnType<typeof setTimeout> | null = null;
        const clock = setInterval(() => {
            setState((current) => ({
                ...current,
                now: Date.now(),
            }));
        }, 1000);

        setState({
            readings: [],
            latestReading: null,
            status: "connecting",
            error: null,
            now: Date.now(),
        });

        const poll = async () => {
            controller = new AbortController();

            setState((current) => current.latestReading === null
                ? {
                    ...current,
                    status: "connecting",
                    error: null,
                    now: Date.now(),
                }
                : current);

            try {
                const readings = await connector.getReadings({
                    historySeconds,
                    minimumReadings: MINIMUM_READINGS_FOR_DELTA,
                    signal: controller.signal,
                });

                if (!active) {
                    return;
                }

                setState({
                    readings,
                    latestReading: readings.at(-1) ?? null,
                    status: "online",
                    error: null,
                    now: Date.now(),
                });
            } catch (error) {
                if (!active || controller.signal.aborted) {
                    return;
                }

                setState((current) => ({
                    ...current,
                    status: "offline",
                    error:
                        error instanceof Error
                            ? error.message
                            : "Unable to retrieve glucose readings",
                    now: Date.now(),
                }));
            } finally {
                if (active) {
                    timeout = setTimeout(
                        poll,
                        Math.max(intervalSeconds, 1) * 1000,
                    );
                }
            }
        };

        void poll();

        return () => {
            active = false;
            controller?.abort();

            if (timeout !== null) {
                clearTimeout(timeout);
            }

            clearInterval(clock);
        };
    }, [connector, historySeconds, intervalSeconds]);

    return state;
}
