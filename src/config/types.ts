export type NoSourceConfig = {
    type: "none";
}

export type XdripSourceConfig = {
    type: "xdrip";
    baseUrl: string;
}

export type SourceConfig = NoSourceConfig | XdripSourceConfig;

export type AppConfig = {
    schemaVersion: 1,
    source: SourceConfig;
    polling: {
        intervalSeconds: number;
        staleAfterSeconds: number;
        historySeconds: number;
    };
    display: {
        unit: "mg/dL" | "mmol/L";
        keepScreenAwake: boolean;
        hideSystemUi: boolean;
    }
}
