import type { AppConfig } from "../config/types";

export type GlucoseUnit = AppConfig["display"]["unit"];

const MG_DL_PER_MMOL_L = 18.0182;

export const glucoseValueToMgDl = (
    value: number,
    unit: GlucoseUnit,
): number =>
    unit === "mmol/L"
        ? Math.round(value * MG_DL_PER_MMOL_L)
        : Math.round(value);

export const glucoseValueFromMgDl = (
    valueMgDl: number,
    unit: GlucoseUnit,
): number =>
    unit === "mmol/L"
        ? valueMgDl / MG_DL_PER_MMOL_L
        : valueMgDl;

export const formatGlucose = (
    valueMgDl: number,
    unit: GlucoseUnit,
): string =>
    unit === "mmol/L"
        ? glucoseValueFromMgDl(valueMgDl, unit).toFixed(1)
        : String(Math.round(valueMgDl));

export const formatGlucoseInput = (
    valueMgDl: number,
    unit: GlucoseUnit,
): string => formatGlucose(valueMgDl, unit);
