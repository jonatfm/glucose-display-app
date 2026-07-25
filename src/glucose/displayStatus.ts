import type { GlucoseReading } from "./types";

export type ConnectionStatus =
    | "disabled"
    | "connecting"
    | "online"
    | "offline";

export type GlucoseDisplayStatus =
    | "LIVE"
    | "STALE"
    | "OFFLINE"
    | "CONNECTING";

type GetGlucoseDisplayStatusOptions = {
    connectionStatus: ConnectionStatus;
    latestReading: GlucoseReading | null;
    now: number;
    staleAfterSeconds: number;
};

export const getGlucoseDisplayStatus = ({
    connectionStatus,
    latestReading,
    now,
    staleAfterSeconds,
}: GetGlucoseDisplayStatusOptions): GlucoseDisplayStatus | null => {
    if (connectionStatus === "disabled") {
        return null;
    }

    if (connectionStatus === "offline") {
        return "OFFLINE";
    }

    if (connectionStatus === "connecting" || latestReading === null) {
        return "CONNECTING";
    }

    const ageMilliseconds = Math.max(
        now - latestReading.measuredAt.getTime(),
        0,
    );

    return ageMilliseconds > staleAfterSeconds * 1000
        ? "STALE"
        : "LIVE";
};
