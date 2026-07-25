import type { AppConfig } from "./types";

export type GlucoseRangeIssue =
    | "critical-above-low"
    | "low-not-below-high"
    | "floor-not-below-critical"
    | "high-not-below-ceiling";

type DisplayRanges = Pick<
    AppConfig["display"],
    "criticalLowThreshold" | "lowThreshold" | "highThreshold"
>;

type GraphRanges = Pick<
    AppConfig["graph"],
    "floor" | "ceiling"
>;

export const getGlucoseRangeIssues = (
    display: DisplayRanges,
    graph: GraphRanges,
): GlucoseRangeIssue[] => {
    const issues: GlucoseRangeIssue[] = [];

    if (display.criticalLowThreshold > display.lowThreshold) {
        issues.push("critical-above-low");
    }

    if (display.lowThreshold >= display.highThreshold) {
        issues.push("low-not-below-high");
    }

    if (graph.floor >= display.criticalLowThreshold) {
        issues.push("floor-not-below-critical");
    }

    if (display.highThreshold >= graph.ceiling) {
        issues.push("high-not-below-ceiling");
    }

    return issues;
};
