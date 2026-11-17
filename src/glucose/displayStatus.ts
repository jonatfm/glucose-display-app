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

    const timestamp = latestReading.measuredAt.getTime();
    if (!Number.isFinite(timestamp) || timestamp <= 0 ||
        timestamp > now + 5 * 60 * 1000) {
        return "STALE";
    }

    const ageMilliseconds = Math.max(
        now - timestamp,
        0,
    );

    return ageMilliseconds > staleAfterSeconds * 1000
        ? "STALE"
        : "LIVE";
};
