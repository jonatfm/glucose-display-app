import type {
    AppConfig,
    NightscoutSourceConfig,
    XdripSourceConfig,
} from "./types";

export const DEFAULT_XDRIP_SOURCE_CONFIG = {
    type: "xdrip",
    baseUrl: "http://127.0.0.1:17580",
} satisfies XdripSourceConfig;

export const DEFAULT_NIGHTSCOUT_SOURCE_CONFIG = {
    type: "nightscout",
    baseUrl: "",
    authentication: "none",
    credentialId: null,
} satisfies NightscoutSourceConfig;

export const DEFAULT_APP_CONFIG = {
    schemaVersion: 4,
    source: {
        selected: "none",
        configurations: {
            xdrip: DEFAULT_XDRIP_SOURCE_CONFIG,
            nightscout: DEFAULT_NIGHTSCOUT_SOURCE_CONFIG,
        },
    },
    polling: {
        intervalSeconds: 5,
        staleAfterSeconds: 60 * 10, // 10 minutes
    },
    display: {
        unit: "mg/dL",
        keepScreenAwake: true,
        hideSystemUi: true,
        showAge: true,
        showDelta: true,
        showTrend: false,
        textSize: 128,
        highThreshold: 180,
        lowThreshold: 90,
        criticalLowThreshold: 65,
        align: "bottom",
    },
    graph: {
        show: true,
        ceiling: 400,
        floor: 40,
        aspectRatio: 1.8,
        historySeconds: 60 * 60 * 3, // 3 hours
    }
} satisfies AppConfig;
