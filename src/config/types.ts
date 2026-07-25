export type NoSourceConfig = {
    type: "none";
}

export type XdripSourceConfig = {
    type: "xdrip";
    baseUrl: string;
}

export type SourceConfig = NoSourceConfig | XdripSourceConfig;

export type AppConfig = {
    schemaVersion: 2,
    source: SourceConfig;
    polling: {
        intervalSeconds: number;
        staleAfterSeconds: number;
    };
    display: {
        unit: "mg/dL" | "mmol/L";
        keepScreenAwake: boolean;
        hideSystemUi: boolean;
        showAge: boolean;
        showDelta: boolean;
        showTrend: boolean;
        textSize: number;
        highThreshold: number;
        lowThreshold: number;
        criticalLowThreshold: number;
        align: "top" | "middle" | "bottom";
    };
    graph: {
        show: boolean;
        ceiling: number;
        floor: number;
        aspectRatio: number;
        historySeconds: number;
    };
}
