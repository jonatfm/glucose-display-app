import { useEffect, useState } from "react";
import type { GlucoseConnector } from "../connectors/types";
import type { InsulinData } from "./types";

type Options = {
    connector: GlucoseConnector | null;
    enabled: boolean;
    historySeconds: number;
    intervalSeconds: number;
};

const EMPTY_DATA: InsulinData = {insulinOnBoard: null, doses: []};

export const fetchInsulinData = async (
    connector: GlucoseConnector,
    historySeconds: number,
    signal: AbortSignal,
): Promise<InsulinData> => {
    const [iob, doses] = await Promise.allSettled([
        connector.getInsulinOnBoard(signal),
        historySeconds > 0
            ? connector.getInsulinDoses({historySeconds, signal})
            : Promise.resolve([]),
    ]);
    return {
        insulinOnBoard: iob.status === "fulfilled" ? iob.value : null,
        doses: doses.status === "fulfilled" ? doses.value : [],
    };
};

export function useInsulinData({
    connector, enabled, historySeconds, intervalSeconds,
}: Options): InsulinData {
    const [state, setState] = useState<{
        connector: GlucoseConnector;
        historySeconds: number;
        data: InsulinData;
    } | null>(null);

    useEffect(() => {
        setState(null);
        if (!enabled || connector === null) return;

        let active = true;
        let controller: AbortController | null = null;
        let timeout: ReturnType<typeof setTimeout> | null = null;
        const refresh = async () => {
            controller = new AbortController();
            const data = await fetchInsulinData(connector, historySeconds, controller.signal);
            if (!active) return;
            setState({connector, historySeconds, data});
            timeout = setTimeout(() => { void refresh(); }, intervalSeconds * 1000);
        };
        void refresh();

        return () => {
            active = false;
            controller?.abort();
            if (timeout !== null) clearTimeout(timeout);
        };
    }, [connector, enabled, historySeconds, intervalSeconds]);

    return enabled && state?.connector === connector &&
        state?.historySeconds === historySeconds
        ? state.data
        : EMPTY_DATA;
}
