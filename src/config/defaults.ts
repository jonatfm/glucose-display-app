import type {AppConfig, XdripSourceConfig} from "./types";

export const DEFAULT_XDRIP_SOURCE_CONFIG = {
    type: "xdrip",
    baseUrl: "http://127.0.0.1:17580",
} satisfies XdripSourceConfig;

export const DEFAULT_APP_CONFIG = {
    schemaVersion: 1,
    source: {
        type: "none",
    },
    polling: {
        intervalSeconds: 5,
        staleAfterSeconds: 60 * 10, // 10 minutes
        historySeconds: 60 * 60 * 3, // 3 hours
    },
    display: {
        unit: "mg/dL",
        keepScreenAwake: true,
        hideSystemUi: true,
        showAge: true,
        showDelta: true,
        textSize: 128,
    }
} satisfies AppConfig;
