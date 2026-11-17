export type NoSourceConfig = {
    type: "none";
}

export type XdripSourceConfig = {
    type: "xdrip";
    baseUrl: string;
}

export type NightscoutSourceConfig = {
    type: "nightscout";
    baseUrl: string;
} & (
    | {
        authentication: "none";
        credentialId: null;
    }
    | {
        authentication: "access-token";
        credentialId: string;
    }
);

export type SourceConfig =
    | NoSourceConfig
    | XdripSourceConfig
    | NightscoutSourceConfig;

export type SourceType = SourceConfig["type"];
export type DecimalSeparator = "." | ",";

type ConnectorSourceConfig =
    Exclude<SourceConfig, NoSourceConfig>;

export type ConnectorConfigurations = {
    [Type in ConnectorSourceConfig["type"]]:
        Extract<ConnectorSourceConfig, {type: Type}>;
};

export type SourceSettings = {
    selected: SourceType;
    configurations: ConnectorConfigurations;
};

export type AppConfig = {
    schemaVersion: 6,
    source: SourceSettings;
    polling: {
        intervalSeconds: number;
        staleAfterSeconds: number;
    };
    display: {
        unit: "mg/dL" | "mmol/L";
        decimalSeparator: DecimalSeparator;
        keepScreenAwake: boolean;
        hideSystemUi: boolean;
        showAge: boolean;
        showDelta: boolean;
        showInsulinOnBoard: boolean;
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
