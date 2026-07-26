import type { SourceConfig } from "../config/types";
import type { GlucoseConnector } from "./types";
import { createXdripConnector } from "./xdrip/xdripConnector";
import { createNightscoutConnector } from "./nightscout/nightscoutConnector";

type CreateConnectorOptions = {
    nightscoutToken?: string;
};

export function createConnector(
    config: SourceConfig,
    options: CreateConnectorOptions = {},
) : GlucoseConnector | null {
    switch (config.type) {
        case "none":
            return null;
        case "xdrip":
            return createXdripConnector(config);
        case "nightscout":
            return createNightscoutConnector(config, {
                token: options.nightscoutToken,
            });
    }
}
