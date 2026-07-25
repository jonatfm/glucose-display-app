const isObject = (
    value: unknown,
): value is Record<string, unknown> =>
    value !== null && typeof value === "object";

export const migrateAppConfig = (value: unknown): unknown => {
    if (!isObject(value) ||
        value.schemaVersion !== 1 ||
        !isObject(value.display)) {
        return value;
    }

    return {
        ...value,
        schemaVersion: 2,
        display: {
            ...value.display,
            showTrend: false,
        },
    };
};
