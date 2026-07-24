import { SourceConfig } from "../config/types";
import { GlucoseConnector } from "./types";
import { createXdripConnector } from "./xdrip/xdripConnector";

export function createConnector(
    config: SourceConfig,
) : GlucoseConnector {
    switch (config.type) {
        case "xdrip":
            return createXdripConnector(config);
    }
}