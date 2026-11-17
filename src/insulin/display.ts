import type { InsulinDose, InsulinOnBoard } from "./types";
import type { DecimalSeparator } from "../config/types";

export const INSULIN_COLOR = "#4da6ff";

export const formatInsulin = (
    units: number,
    decimalSeparator: DecimalSeparator = ".",
): string => `${String(Number(units.toFixed(2))).replace(".", decimalSeparator)} U`;

export const isInsulinOnBoardFresh = (
    iob: InsulinOnBoard | null,
    now: number,
    staleAfterSeconds: number,
): iob is InsulinOnBoard => iob !== null &&
    Number.isFinite(iob.units) &&
    Number.isFinite(iob.measuredAt.getTime()) &&
    iob.measuredAt.getTime() <= now + 5 * 60 * 1000 &&
    now - iob.measuredAt.getTime() <= staleAfterSeconds * 1000;

const LABEL_WIDTH = 64;
export const DOSE_ROW_HEIGHT = 26;

// Keep each dose's amount, dot and guide at its own time. Stagger labels
// into separate rows when neighbouring amounts would overlap.
export const layoutInsulinDoses = (
    doses: InsulinDose[],
    now: number,
    historySeconds: number,
    width: number,
) => {
    if (!Number.isFinite(width) || width <= 0 || historySeconds <= 0) return [];
    const rowEnds: number[] = [];
    return doses
        .filter((dose) => {
            const age = now - dose.deliveredAt.getTime();
            return Number.isFinite(age) && age >= 0 &&
                age <= historySeconds * 1000 &&
                Number.isFinite(dose.units) && dose.units > 0;
        })
        .sort((a, b) => a.deliveredAt.getTime() - b.deliveredAt.getTime())
        .map((dose) => {
            const fraction = 1 -
                (now - dose.deliveredAt.getTime()) / (historySeconds * 1000);
            const labelWidth = Math.min(LABEL_WIDTH, width);
            const labelLeft = Math.max(0, Math.min(
                fraction * width - labelWidth / 2,
                width - labelWidth,
            ));
            let row = rowEnds.findIndex((end) => labelLeft >= end + 4);
            if (row === -1) row = rowEnds.length;
            rowEnds[row] = labelLeft + labelWidth;
            return {dose, fraction, labelLeft, labelWidth, row};
        });
};
