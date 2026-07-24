import type { SourceConfig } from "../config/types";
import type { GlucoseConnector } from "./types";
import { createXdripConnector } from "./xdrip/xdripConnector";

export function createConnector(
    config: SourceConfig,
) : GlucoseConnector | null {
    switch (config.type) {
        case "none":
            return null;
        case "xdrip":
            return createXdripConnector(config);
    }
}
