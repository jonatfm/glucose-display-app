import type { InsulinDose, InsulinOnBoard } from "./types";

const asObject = (value: unknown): Record<string, unknown> | null =>
    value !== null && typeof value === "object" && !Array.isArray(value)
        ? value as Record<string, unknown>
        : null;

const asNumber = (value: unknown): number | null => {
    const number = typeof value === "number"
        ? value
        : typeof value === "string" && value.trim() !== ""
            ? Number(value)
            : NaN;
    return Number.isFinite(number) ? number : null;
};

const asTimestamp = (value: unknown): number | null => {
    const timestamp = asNumber(value) ??
        (typeof value === "string" ? Date.parse(value) : NaN);
    return Number.isFinite(timestamp) && timestamp > 0 &&
        Number.isFinite(new Date(timestamp).getTime())
        ? timestamp
        : null;
};

export const parseInsulinDoses = (
    payload: unknown,
    historySeconds: number,
    now = Date.now(),
): InsulinDose[] => {
    if (!Array.isArray(payload)) {
        throw new Error("Unsupported insulin treatment response");
    }

    const doses = new Map<string, InsulinDose>();
    for (const item of payload) {
        const entry = asObject(item);
        if (entry === null || entry.isValid === false) continue;
        const units = asNumber(entry.insulin);
        const timestamp = asTimestamp(entry.timestamp) ??
            asTimestamp(entry.created_at) ?? asTimestamp(entry.date);

        // Only recorded positive doses are markers. Basal rates, carbs,
        // announcements and future/scheduled treatments are not doses.
        if (units === null || units <= 0 || timestamp === null ||
            timestamp > now || timestamp < now - historySeconds * 1000) {
            continue;
        }

        const id = typeof entry._id === "string" && entry._id !== ""
            ? entry._id
            : `${timestamp}:${units}`;
        if (!doses.has(id)) {
            doses.set(id, {id, units, deliveredAt: new Date(timestamp)});
        }
    }
    return [...doses.values()].sort(
        (a, b) => a.deliveredAt.getTime() - b.deliveredAt.getTime(),
    );
};

// Read the source's own IOB calculation; dose totals are not active insulin.
export const parseNightscoutInsulinOnBoard = (
    payload: unknown,
    now = Date.now(),
): InsulinOnBoard | null => {
    const iob = asObject(asObject(payload)?.iob);
    const units = asNumber(iob?.iob);
    const timestamp = asTimestamp(iob?.mills);
    // A treatment-derived IOB has no mills: Nightscout calculates it now.
    if (units === null || (iob?.mills !== undefined && timestamp === null)) {
        return null;
    }
    return {units, measuredAt: new Date(timestamp ?? now)};
};

export const parseXdripInsulinOnBoard = (
    payload: unknown,
): InsulinOnBoard | null => {
    const root = asObject(payload);
    const bg = Array.isArray(root?.bgs) ? asObject(root.bgs[0]) : null;
    const status = Array.isArray(root?.status)
        ? asObject(root.status[0])
        : null;
    // xDrip computes IOB at request time, independently of the glucose age.
    const timestamp = asTimestamp(status?.now);
    const units = asNumber(bg?.iob);
    return units !== null && timestamp !== null
        ? {units, measuredAt: new Date(timestamp)}
        : null;
};
