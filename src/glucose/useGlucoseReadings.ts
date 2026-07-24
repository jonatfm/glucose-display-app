import { useEffect, useState } from "react";
import { GlucoseConnector } from "../connectors/types";
import { GlucoseReading } from "./types";

type PollingStatus =
    | "disabled"
    | "loading"
    | "live"
    | "error";

type GlucoseState = {
    readings: GlucoseReading[];
    latestReading: GlucoseReading | null;
    status: PollingStatus;
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

        setState({
            readings: [],
            latestReading: null,
            status: "loading",
            error: null,
            now: Date.now(),
        });

        const poll = async () => {
            controller = new AbortController();

            try {
                const readings = await connector.getReadings({
                    historySeconds,
                    signal: controller.signal,
                });

                if (!active) {
                    return;
                }

                setState({
                    readings,
                    latestReading: readings.at(-1) ?? null,
                    status: "live",
                    error: null,
                    now: Date.now(),
                });
            } catch (error) {
                if (!active || controller.signal.aborted) {
                    return;
                }

                setState((current) => ({
                    ...current,
                    status: "error",
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
        };
    }, [connector, historySeconds, intervalSeconds]);

    return state;
}