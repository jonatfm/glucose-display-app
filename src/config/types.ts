export type XdripSourceConfig = {
    type: "xdrip";
    baseUrl: string;
}

export type SourceConfig = XdripSourceConfig;

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