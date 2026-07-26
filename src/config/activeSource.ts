import type {
    SourceConfig,
    SourceSettings,
} from "./types";

export const getActiveSourceConfig = (
    source: SourceSettings,
): SourceConfig => {
    switch (source.selected) {
        case "none":
            return {type: "none"};
        case "xdrip":
            return source.configurations.xdrip;
        case "nightscout":
            return source.configurations.nightscout;
    }
};
