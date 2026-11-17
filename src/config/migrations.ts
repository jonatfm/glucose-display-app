import {
    DEFAULT_NIGHTSCOUT_SOURCE_CONFIG,
    DEFAULT_XDRIP_SOURCE_CONFIG,
} from "./defaults";

const isObject = (
    value: unknown,
): value is Record<string, unknown> =>
    value !== null && typeof value === "object";

export const migrateAppConfig = (value: unknown): unknown => {
    if (!isObject(value)) {
        return value;
    }

    let migrated = value;

    if (migrated.schemaVersion === 1 &&
        isObject(migrated.display)) {
        migrated = {
            ...migrated,
            schemaVersion: 2,
            display: {
                ...migrated.display,
                showTrend: false,
            },
        };
    }

    if (migrated.schemaVersion === 2) {
        migrated = {
            ...migrated,
            schemaVersion: 3,
        };
    }

    if (migrated.schemaVersion === 3 &&
        isObject(migrated.source)) {
        const previousSource = migrated.source;

        migrated = {
            ...migrated,
            schemaVersion: 4,
            source: {
                selected:
                    previousSource.type === "none" ||
                    previousSource.type === "xdrip" ||
                    previousSource.type === "nightscout"
                        ? previousSource.type
                        : "none",
                configurations: {
                    xdrip: previousSource.type === "xdrip"
                        ? previousSource
                        : DEFAULT_XDRIP_SOURCE_CONFIG,
                    nightscout: previousSource.type === "nightscout"
                        ? previousSource
                        : DEFAULT_NIGHTSCOUT_SOURCE_CONFIG,
                },
            },
        };
    }

    if (migrated.schemaVersion === 4 &&
        isObject(migrated.display)) {
        migrated = {
            ...migrated,
            schemaVersion: 5,
            display: {
                ...migrated.display,
                showInsulinOnBoard: false,
            },
        };
    }

    if (migrated.schemaVersion === 5 && isObject(migrated.display)) {
        migrated = {
            ...migrated,
            schemaVersion: 6,
            display: {...migrated.display, decimalSeparator: "."},
        };
    }

    return migrated;
};
