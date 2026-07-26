import {
    forwardRef,
    useEffect,
    useImperativeHandle,
    useRef,
    useState,
} from "react";
import { useAppConfig } from "../config/AppConfigProvider";
import type {
    AppConfig,
    NightscoutSourceConfig,
    SourceConfig,
} from "../config/types";
import {
    DEFAULT_APP_CONFIG,
    DEFAULT_NIGHTSCOUT_SOURCE_CONFIG,
    DEFAULT_XDRIP_SOURCE_CONFIG,
} from "../config/defaults";
import {
    getGlucoseRangeIssues,
    type GlucoseRangeIssue,
} from "../config/glucoseRanges";
import { createConnector } from "../connectors/createConnector";
import {
    createCredentialId,
    deleteNightscoutToken,
    storeNightscoutToken,
} from "../connectors/nightscout/nightscoutCredentials";
import { normalizeNightscoutInput } from "../connectors/nightscout/nightscoutUrl";
import {
    formatGlucoseInput,
    glucoseValueToMgDl,
    type GlucoseUnit,
} from "../glucose/units";
import {
    Pressable,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    View,
} from "react-native";

type SettingsFormProps = {
    visible: boolean;
    onFinished: () => void;
};

export type SettingsFormHandle = {
    save: () => Promise<void>;
};

type SourceType = SourceConfig["type"];
type NightscoutAuthentication =
    NightscoutSourceConfig["authentication"];
type PollingField = keyof AppConfig["polling"];
type PollingDraft = Record<PollingField, string>;
type PollingErrors = Partial<Record<PollingField, string>>;
type DisplayNumberField =
    | "textSize"
    | "highThreshold"
    | "lowThreshold"
    | "criticalLowThreshold";
type DisplayNumberDraft = Record<DisplayNumberField, string>;
type DisplayNumberErrors = Partial<Record<DisplayNumberField, string>>;
type GraphNumberField =
    | "ceiling"
    | "floor"
    | "aspectRatio"
    | "historyHours";
type GraphNumberDraft = Record<GraphNumberField, string>;
type GraphNumberErrors = Partial<Record<GraphNumberField, string>>;

const POLLING_FIELD_NAMES: Record<PollingField, string> = {
    intervalSeconds: "Polling interval",
    staleAfterSeconds: "Stale threshold",
};

const DISPLAY_NUMBER_FIELD_NAMES: Record<DisplayNumberField, string> = {
    textSize: "Text size",
    highThreshold: "High threshold",
    lowThreshold: "Low threshold",
    criticalLowThreshold: "Critical low threshold",
};

const GRAPH_NUMBER_FIELD_NAMES: Record<GraphNumberField, string> = {
    ceiling: "Graph ceiling",
    floor: "Graph floor",
    aspectRatio: "Graph aspect ratio",
    historyHours: "Graph history window",
};

const createPollingDraft = (
    polling: AppConfig["polling"],
): PollingDraft => ({
    intervalSeconds: polling.intervalSeconds.toString(),
    staleAfterSeconds: polling.staleAfterSeconds.toString(),
});

const createDisplayNumberDraft = (
    display: AppConfig["display"],
    unit: GlucoseUnit,
): DisplayNumberDraft => ({
    textSize: display.textSize.toString(),
    highThreshold: formatGlucoseInput(display.highThreshold, unit),
    lowThreshold: formatGlucoseInput(display.lowThreshold, unit),
    criticalLowThreshold: formatGlucoseInput(
        display.criticalLowThreshold,
        unit,
    ),
});

const createGraphNumberDraft = (
    graph: AppConfig["graph"],
    unit: GlucoseUnit,
): GraphNumberDraft => ({
    ceiling: formatGlucoseInput(graph.ceiling, unit),
    floor: formatGlucoseInput(graph.floor, unit),
    aspectRatio: graph.aspectRatio.toString(),
    historyHours: (graph.historySeconds / 3600).toString(),
});

const parsePositiveWholeNumber = (
    text: string,
    fieldName: string,
): number => {
    const trimmed = text.trim();

    if (!/^\d+$/.test(trimmed)) {
        throw new Error(`${fieldName} must be a whole number`);
    }

    const value = Number(trimmed);

    if (!Number.isSafeInteger(value) || value < 1) {
        throw new Error(`${fieldName} must be at least 1`);
    }

    return value;
};

const validatePollingDraft = (
    draft: PollingDraft,
): {
    errors: PollingErrors;
    polling: AppConfig["polling"] | null;
} => {
    const errors: PollingErrors = {};

    const parseField = (field: PollingField): number | undefined => {
        try {
            return parsePositiveWholeNumber(
                draft[field],
                POLLING_FIELD_NAMES[field],
            );
        } catch (error) {
            errors[field] = error instanceof Error
                ? error.message
                : "Enter a valid number of seconds";
            return undefined;
        }
    };

    const intervalSeconds = parseField("intervalSeconds");
    const staleAfterSeconds = parseField("staleAfterSeconds");

    if (intervalSeconds === undefined ||
        staleAfterSeconds === undefined) {
        return {
            errors,
            polling: null,
        };
    }

    return {
        errors,
        polling: {
            intervalSeconds,
            staleAfterSeconds,
        },
    };
};

const validateDisplayNumberDraft = (
    draft: DisplayNumberDraft,
    unit: GlucoseUnit,
): {
    errors: DisplayNumberErrors;
    values: Record<DisplayNumberField, number> | null;
} => {
    const errors: DisplayNumberErrors = {};
    const values = {} as Record<DisplayNumberField, number>;

    try {
        values.textSize = parsePositiveWholeNumber(
            draft.textSize,
            DISPLAY_NUMBER_FIELD_NAMES.textSize,
        );
    } catch (error) {
        errors.textSize = error instanceof Error
            ? error.message
            : "Enter a valid whole number";
    }

    for (const field of [
        "highThreshold",
        "lowThreshold",
        "criticalLowThreshold",
    ] as const) {
        try {
            const value = unit === "mmol/L"
                ? parsePositiveFloat(
                    draft[field],
                    DISPLAY_NUMBER_FIELD_NAMES[field],
                )
                : parsePositiveWholeNumber(
                    draft[field],
                    DISPLAY_NUMBER_FIELD_NAMES[field],
                );

            values[field] = glucoseValueToMgDl(value, unit);
        } catch (error) {
            errors[field] = error instanceof Error
                ? error.message
                : `Enter a valid value in ${unit}`;
        }
    }

    return {
        errors,
        values: Object.keys(errors).length === 0 ? values : null,
    };
};

const parsePositiveFloat = (
    text: string,
    fieldName: string,
): number => {
    const trimmed = text.trim().replace(",", ".");

    if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(trimmed)) {
        throw new Error(`${fieldName} must be a number`);
    }

    const value = Number(trimmed);

    if (!Number.isFinite(value) || value <= 0) {
        throw new Error(`${fieldName} must be greater than 0`);
    }

    return value;
};

const validateGraphNumberDraft = (
    draft: GraphNumberDraft,
    unit: GlucoseUnit,
): {
    errors: GraphNumberErrors;
    graph: Omit<AppConfig["graph"], "show"> | null;
} => {
    const errors: GraphNumberErrors = {};
    const parseGlucoseValue = (
        field: "ceiling" | "floor",
    ): number | undefined => {
        try {
            const value = unit === "mmol/L"
                ? parsePositiveFloat(
                    draft[field],
                    GRAPH_NUMBER_FIELD_NAMES[field],
                )
                : parsePositiveWholeNumber(
                    draft[field],
                    GRAPH_NUMBER_FIELD_NAMES[field],
                );

            return glucoseValueToMgDl(value, unit);
        } catch (error) {
            errors[field] = error instanceof Error
                ? error.message
                : `Enter a valid value in ${unit}`;
            return undefined;
        }
    };

    const ceiling = parseGlucoseValue("ceiling");
    const floor = parseGlucoseValue("floor");
    let aspectRatio: number | undefined;
    let historyHours: number | undefined;
    let historySeconds: number | undefined;

    try {
        aspectRatio = parsePositiveFloat(
            draft.aspectRatio,
            GRAPH_NUMBER_FIELD_NAMES.aspectRatio,
        );
    } catch (error) {
        errors.aspectRatio = error instanceof Error
            ? error.message
            : "Enter a valid number";
    }

    try {
        historyHours = parsePositiveFloat(
            draft.historyHours,
            GRAPH_NUMBER_FIELD_NAMES.historyHours,
        );
        historySeconds = Math.round(historyHours * 3600);

        if (historySeconds < 1) {
            throw new Error(
                "Graph history window must be at least one second",
            );
        }
    } catch (error) {
        errors.historyHours = error instanceof Error
            ? error.message
            : "Enter a valid number";
    }

    if (ceiling !== undefined &&
        floor !== undefined &&
        ceiling <= floor) {
        errors.ceiling = "Graph ceiling must be above the graph floor";
        errors.floor = "Graph floor must be below the graph ceiling";
    }

    if (ceiling === undefined ||
        floor === undefined ||
        aspectRatio === undefined ||
        historySeconds === undefined ||
        Object.keys(errors).length > 0) {
        return {errors, graph: null};
    }

    return {
        errors,
        graph: {
            ceiling,
            floor,
            aspectRatio,
            historySeconds,
        },
    };
};

const addGlucoseRangeError = (
    issue: GlucoseRangeIssue,
    displayErrors: DisplayNumberErrors,
    graphErrors: GraphNumberErrors,
) => {
    switch (issue) {
        case "critical-above-low":
            displayErrors.criticalLowThreshold =
                "Critical low threshold must not exceed the low threshold";
            displayErrors.lowThreshold =
                "Low threshold must not be below the critical low threshold";
            break;
        case "low-not-below-high":
            displayErrors.lowThreshold =
                "Low threshold must be below the high threshold";
            displayErrors.highThreshold =
                "High threshold must be above the low threshold";
            break;
        case "floor-not-below-critical":
            graphErrors.floor =
                "Graph floor must be below the critical low threshold";
            displayErrors.criticalLowThreshold =
                "Critical low threshold must be above the graph floor";
            break;
        case "high-not-below-ceiling":
            displayErrors.highThreshold =
                "High threshold must be below the graph ceiling";
            graphErrors.ceiling =
                "Graph ceiling must be above the high threshold";
            break;
    }
};

const parseXdripSource = (
    baseUrl: string,
): SourceConfig => {
    const trimmed = baseUrl.trim();

    if (trimmed.length === 0) {
        throw new Error("Enter the xDrip server address");
    }

    const url = new URL(trimmed);

    if (url.protocol !== "http:" &&
        url.protocol !== "https:") {
            throw new Error("The address must use HTTP or HTTPS");
        };
    
    return {
        type: "xdrip",
        baseUrl: url.origin,
    };
};

type DraftSource = {
    source: SourceConfig;
    nightscoutToken: string | null;
};

const SettingsForm = forwardRef<SettingsFormHandle, SettingsFormProps>(
function SettingsForm({
    visible,
    onFinished,
}, ref) {
    const {config, replaceConfig} = useAppConfig();

    // glucose source settings
    const [sourceType, setSourceType] = useState<SourceType>("none");
    const [xdripBaseUrl, setXdripBaseUrl] = useState(DEFAULT_XDRIP_SOURCE_CONFIG.baseUrl);
    const [nightscoutBaseUrl, setNightscoutBaseUrl] =
        useState(DEFAULT_NIGHTSCOUT_SOURCE_CONFIG.baseUrl);
    const [nightscoutAuthentication, setNightscoutAuthentication] =
        useState<NightscoutAuthentication>("none");
    const [nightscoutTokenDraft, setNightscoutTokenDraft] = useState("");
    const [connectionFeedback, setConnectionFeedback] = useState<string | null>(null);
    const [isWorking, setIsWorking] = useState(false);
    const testController = useRef<AbortController | null>(null);

    // polling settings
    const [pollingDraft, setPollingDraft] = useState<PollingDraft>(
        createPollingDraft(config.polling),
    );
    const [pollingErrors, setPollingErrors] = useState<PollingErrors>({});

    // display settings
    const [displayUnit, setDisplayUnit] = useState(config.display.unit);
    const [displayKeepScreenAwake, setDisplayKeepScreenAwake] = useState(config.display.keepScreenAwake);
    const [displayHideSystemUi, setDisplayHideSystemUi] = useState(config.display.hideSystemUi);
    const [displayShowAge, setDisplayShowAge] = useState(config.display.showAge);
    const [displayShowDelta, setDisplayShowDelta] = useState(config.display.showDelta);
    const [displayShowTrend, setDisplayShowTrend] = useState(config.display.showTrend);
    const [displayNumberDraft, setDisplayNumberDraft] =
        useState<DisplayNumberDraft>(
            createDisplayNumberDraft(config.display, config.display.unit),
        );
    const [displayNumberErrors, setDisplayNumberErrors] =
        useState<DisplayNumberErrors>({});
    const [displayAlign, setDisplayAlign] = useState(config.display.align);

    // graph settings
    const [graphShow, setGraphShow] = useState(config.graph.show);
    const [graphNumberDraft, setGraphNumberDraft] =
        useState<GraphNumberDraft>(
            createGraphNumberDraft(config.graph, config.display.unit),
        );
    const [graphNumberErrors, setGraphNumberErrors] =
        useState<GraphNumberErrors>({});

    useEffect(() => {
        if (!visible) {
            testController.current?.abort();
            setNightscoutTokenDraft("");
            return;
        }

        setSourceType(config.source.selected);
        setXdripBaseUrl(
            config.source.configurations.xdrip.baseUrl,
        );
        setNightscoutBaseUrl(
            config.source.configurations.nightscout.baseUrl,
        );
        setNightscoutAuthentication(
            config.source.configurations.nightscout.authentication,
        );
        setNightscoutTokenDraft("");
        setPollingDraft(createPollingDraft(config.polling));
        setPollingErrors({});
        setDisplayUnit(config.display.unit);
        setDisplayKeepScreenAwake(config.display.keepScreenAwake);
        setDisplayHideSystemUi(config.display.hideSystemUi);
        setDisplayShowAge(config.display.showAge);
        setDisplayShowDelta(config.display.showDelta);
        setDisplayShowTrend(config.display.showTrend);
        setDisplayNumberDraft(
            createDisplayNumberDraft(config.display, config.display.unit),
        );
        setDisplayNumberErrors({});
        setDisplayAlign(config.display.align);
        setGraphShow(config.graph.show);
        setGraphNumberDraft(
            createGraphNumberDraft(config.graph, config.display.unit),
        );
        setGraphNumberErrors({});
        setConnectionFeedback(null);
    }, [config.display, config.polling, config.source, config.graph, visible]);

    useEffect(
        () => () => testController.current?.abort(),
        [],
    );

    const createDraftSource = (): DraftSource => {
        if (sourceType === "none") {
            return {
                source: {type: "none"},
                nightscoutToken: null,
            };
        }

        if (sourceType === "xdrip") {
            return {
                source: parseXdripSource(xdripBaseUrl),
                nightscoutToken: null,
            };
        }

        const normalized = normalizeNightscoutInput(nightscoutBaseUrl);
        const nightscoutToken =
            normalized.token ??
            (nightscoutTokenDraft.trim() || null);

        if (nightscoutAuthentication === "none" &&
            nightscoutToken !== null) {
            throw new Error(
                "Select access-token authentication to use the pasted token",
            );
        }

        if (nightscoutAuthentication === "none") {
            return {
                source: {
                    type: "nightscout",
                    baseUrl: normalized.baseUrl,
                    authentication: "none",
                    credentialId: null,
                },
                nightscoutToken: null,
            };
        }

        const storedNightscout =
            config.source.configurations.nightscout;
        const existingCredentialId =
            storedNightscout.authentication === "access-token"
                ? storedNightscout.credentialId
                : null;

        if (nightscoutToken === null &&
            existingCredentialId === null) {
            throw new Error("Enter a Nightscout access token");
        }

        return {
            source: {
                type: "nightscout",
                baseUrl: normalized.baseUrl,
                authentication: "access-token",
                credentialId: existingCredentialId ?? "pending",
            },
            nightscoutToken,
        };
    };

    const updateNightscoutBaseUrl = (text: string) => {
        setConnectionFeedback(null);

        if (!/[?&]token=/i.test(text)) {
            setNightscoutBaseUrl(text);
            return;
        }

        try {
            const normalized = normalizeNightscoutInput(text);
            setNightscoutBaseUrl(normalized.baseUrl);

            if (normalized.token !== null) {
                setNightscoutAuthentication("access-token");
                setNightscoutTokenDraft(normalized.token);
            }
        } catch {
            setNightscoutBaseUrl(text.replace(/[?#].*$/, ""));
            setNightscoutTokenDraft("");
            setConnectionFeedback("Enter a valid Nightscout token link");
        }
    };

    const updatePollingField = (
        field: PollingField,
        text: string,
    ) => {
        setPollingDraft((current) => ({
            ...current,
            [field]: text,
        }));
        setPollingErrors((current) => {
            if (current[field] === undefined) {
                return current;
            }

            const next = {...current};
            delete next[field];
            return next;
        });
    };

    const normalizePollingField = (field: PollingField) => {
        try {
            const value = parsePositiveWholeNumber(
                pollingDraft[field],
                POLLING_FIELD_NAMES[field],
            );
            updatePollingField(field, value.toString());
        } catch (error) {
            setPollingErrors((current) => ({
                ...current,
                [field]: error instanceof Error
                    ? error.message
                    : "Enter a valid number of seconds",
            }));
        }
    };

    const updateDisplayNumberField = (
        field: DisplayNumberField,
        text: string,
    ) => {
        setDisplayNumberDraft((current) => ({
            ...current,
            [field]: text,
        }));
        setDisplayNumberErrors((current) => {
            if (current[field] === undefined) {
                return current;
            }

            const next = {...current};
            delete next[field];
            return next;
        });
    };

    const normalizeDisplayNumberField = (
        field: DisplayNumberField,
    ) => {
        try {
            if (field === "textSize") {
                const value = parsePositiveWholeNumber(
                    displayNumberDraft[field],
                    DISPLAY_NUMBER_FIELD_NAMES[field],
                );
                updateDisplayNumberField(field, value.toString());
                return;
            }

            const value = displayUnit === "mmol/L"
                ? parsePositiveFloat(
                    displayNumberDraft[field],
                    DISPLAY_NUMBER_FIELD_NAMES[field],
                )
                : parsePositiveWholeNumber(
                    displayNumberDraft[field],
                    DISPLAY_NUMBER_FIELD_NAMES[field],
                );
            updateDisplayNumberField(
                field,
                formatGlucoseInput(
                    glucoseValueToMgDl(value, displayUnit),
                    displayUnit,
                ),
            );
        } catch (error) {
            setDisplayNumberErrors((current) => ({
                ...current,
                [field]: error instanceof Error
                    ? error.message
                    : "Enter a valid whole number",
            }));
        }
    };

    const updateGraphNumberField = (
        field: GraphNumberField,
        text: string,
    ) => {
        setGraphNumberDraft((current) => ({
            ...current,
            [field]: text,
        }));
        setGraphNumberErrors((current) => {
            if (current[field] === undefined) {
                return current;
            }

            const next = {...current};
            delete next[field];
            return next;
        });
    };

    const normalizeGraphNumberField = (
        field: GraphNumberField,
    ) => {
        try {
            if (field === "ceiling" || field === "floor") {
                const value = displayUnit === "mmol/L"
                    ? parsePositiveFloat(
                        graphNumberDraft[field],
                        GRAPH_NUMBER_FIELD_NAMES[field],
                    )
                    : parsePositiveWholeNumber(
                        graphNumberDraft[field],
                        GRAPH_NUMBER_FIELD_NAMES[field],
                    );
                updateGraphNumberField(
                    field,
                    formatGlucoseInput(
                        glucoseValueToMgDl(value, displayUnit),
                        displayUnit,
                    ),
                );
                return;
            }

            const value = parsePositiveFloat(
                graphNumberDraft[field],
                GRAPH_NUMBER_FIELD_NAMES[field],
            );
            updateGraphNumberField(field, value.toString());
        } catch (error) {
            setGraphNumberErrors((current) => ({
                ...current,
                [field]: error instanceof Error
                    ? error.message
                    : "Enter a valid number",
            }));
        }
    };

    const changeDisplayUnit = (nextUnit: GlucoseUnit) => {
        if (nextUnit === displayUnit) {
            return;
        }

        const convertDraftValue = (
            text: string,
            fieldName: string,
        ): string => {
            try {
                const value = parsePositiveFloat(text, fieldName);
                const valueMgDl = glucoseValueToMgDl(
                    value,
                    displayUnit,
                );
                return formatGlucoseInput(valueMgDl, nextUnit);
            } catch {
                return text;
            }
        };

        setDisplayNumberDraft((current) => ({
            ...current,
            highThreshold: convertDraftValue(
                current.highThreshold,
                DISPLAY_NUMBER_FIELD_NAMES.highThreshold,
            ),
            lowThreshold: convertDraftValue(
                current.lowThreshold,
                DISPLAY_NUMBER_FIELD_NAMES.lowThreshold,
            ),
            criticalLowThreshold: convertDraftValue(
                current.criticalLowThreshold,
                DISPLAY_NUMBER_FIELD_NAMES.criticalLowThreshold,
            ),
        }));
        setGraphNumberDraft((current) => ({
            ...current,
            ceiling: convertDraftValue(
                current.ceiling,
                GRAPH_NUMBER_FIELD_NAMES.ceiling,
            ),
            floor: convertDraftValue(
                current.floor,
                GRAPH_NUMBER_FIELD_NAMES.floor,
            ),
        }));
        setDisplayNumberErrors({});
        setGraphNumberErrors({});
        setDisplayUnit(nextUnit);
    };

    const testConnection = async () => {
        setIsWorking(true);
        setConnectionFeedback(null);

        testController.current?.abort();
        testController.current = new AbortController();

        try {
            const {source, nightscoutToken} = createDraftSource();
            const connector = createConnector(source, {
                nightscoutToken: nightscoutToken ?? undefined,
            });

            if (connector === null) {
                throw new Error("Select a connector before testing");
            }

            await connector.testConnection(testController.current.signal);

            setConnectionFeedback("Connection successful!");
        } catch (error) {
            if (!testController.current?.signal.aborted) {
                setConnectionFeedback(
                    error instanceof Error
                        ? error.message
                        : "Connection test failed",
                );
            }
        } finally {
            setIsWorking(false);
        }
    };

    const save = async () => {
        if (isWorking) {
            return;
        }

        setConnectionFeedback(null);
        const {errors, polling} = validatePollingDraft(pollingDraft);
        const {
            errors: displayErrors,
            values: displayNumbers,
        } = validateDisplayNumberDraft(displayNumberDraft, displayUnit);
        const {
            errors: graphErrors,
            graph,
        } = validateGraphNumberDraft(graphNumberDraft, displayUnit);

        if (displayNumbers !== null && graph !== null) {
            for (const issue of getGlucoseRangeIssues(
                {
                    criticalLowThreshold:
                        displayNumbers.criticalLowThreshold,
                    lowThreshold: displayNumbers.lowThreshold,
                    highThreshold: displayNumbers.highThreshold,
                },
                graph,
            )) {
                addGlucoseRangeError(
                    issue,
                    displayErrors,
                    graphErrors,
                );
            }
        }

        if (polling === null ||
            displayNumbers === null ||
            graph === null ||
            Object.keys(displayErrors).length > 0 ||
            Object.keys(graphErrors).length > 0) {
            setPollingErrors(errors);
            setDisplayNumberErrors(displayErrors);
            setGraphNumberErrors(graphErrors);
            return;
        }

        setPollingErrors({});
        setDisplayNumberErrors({});
        setGraphNumberErrors({});
        setIsWorking(true);

        try {
            const {
                source: draftSource,
                nightscoutToken,
            } = createDraftSource();
            let source = draftSource;
            let newCredentialId: string | null = null;

            if (source.type === "nightscout" &&
                source.authentication === "access-token" &&
                nightscoutToken !== null) {
                newCredentialId = createCredentialId();
                await storeNightscoutToken(
                    newCredentialId,
                    nightscoutToken,
                );
                source = {
                    ...source,
                    credentialId: newCredentialId,
                };
            }

            const configurations = {
                ...config.source.configurations,
                ...(source.type === "xdrip"
                    ? {xdrip: source}
                    : {}),
                ...(source.type === "nightscout"
                    ? {nightscout: source}
                    : {}),
            };

            try {
                await replaceConfig({
                    ...config,
                    source: {
                        selected: sourceType,
                        configurations,
                    },
                    polling,
                    display: {
                        unit: displayUnit,
                        keepScreenAwake: displayKeepScreenAwake,
                        hideSystemUi: displayHideSystemUi,
                        showAge: displayShowAge,
                        showDelta: displayShowDelta,
                        showTrend: displayShowTrend,
                        textSize: displayNumbers.textSize,
                        highThreshold: displayNumbers.highThreshold,
                        lowThreshold: displayNumbers.lowThreshold,
                        criticalLowThreshold:
                            displayNumbers.criticalLowThreshold,
                        align: displayAlign,
                    },
                    graph: {
                        show: graphShow,
                        ...graph,
                    },
                });
            } catch (error) {
                if (newCredentialId !== null) {
                    try {
                        await deleteNightscoutToken(newCredentialId);
                    } catch (cleanupError) {
                        console.warn(
                            "Could not roll back the new Nightscout token",
                            cleanupError,
                        );
                    }
                }

                throw error;
            }

            const previousNightscout =
                config.source.configurations.nightscout;
            const oldCredentialId =
                previousNightscout.authentication === "access-token"
                    ? previousNightscout.credentialId
                    : null;
            const nextNightscout = configurations.nightscout;
            const nextCredentialId =
                nextNightscout.authentication === "access-token"
                    ? nextNightscout.credentialId
                    : null;

            if (oldCredentialId !== null &&
                oldCredentialId !== nextCredentialId) {
                try {
                    await deleteNightscoutToken(oldCredentialId);
                } catch (error) {
                    console.warn(
                        "Could not remove the previous Nightscout token",
                        error,
                    );
                }
            }

            setNightscoutTokenDraft("");
            onFinished();
        } catch (error) {
            setConnectionFeedback(
                error instanceof Error
                    ? error.message
                    : "Could not save settings",
            );
        } finally {
            setIsWorking(false);
        }
    };

    useImperativeHandle(ref, () => ({
        save,
    }));

    const cancel = () => {
        testController.current?.abort();
        setNightscoutTokenDraft("");
        onFinished();
    };

    return (
        <ScrollView
            contentContainerStyle={styles.container}
            keyboardShouldPersistTaps="handled"
        >
            <Text style={styles.label}>Glucose source</Text>
            <View
                accessibilityRole="radiogroup"
                style={styles.sourceRow}
            >
                <SourceButton
                    active={sourceType === "none"}
                    label="None"
                    onPress={() => {
                        setSourceType("none");
                        setNightscoutTokenDraft("");
                        setConnectionFeedback(null);
                    }}
                />
                <SourceButton
                    active={sourceType === "xdrip"}
                    label="xDrip"
                    onPress={() => {
                        setSourceType("xdrip");
                        setNightscoutTokenDraft("");
                        setConnectionFeedback(null);
                    }}
                />
                <SourceButton
                    active={sourceType === "nightscout"}
                    label="Nightscout"
                    onPress={() => {
                        setSourceType("nightscout");
                        setConnectionFeedback(null);
                    }}
                />
            </View>

            {sourceType === "xdrip" ? (
                <View style={styles.field}>
                    <Text style={styles.label}>xDrip server address</Text>

                    <TextInput
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardType="url"
                        onChangeText={setXdripBaseUrl}
                        placeholder={DEFAULT_XDRIP_SOURCE_CONFIG.baseUrl}
                        placeholderTextColor="#888"
                        style={styles.input}
                        value={xdripBaseUrl}
                    />

                    <Pressable
                        disabled={isWorking}
                        onPress={testConnection}
                        style={styles.secondaryButton}
                    >
                        <Text style={styles.buttonText}>
                            {isWorking
                                ? "Testing..."
                                : "Test connection"}
                        </Text>
                    </Pressable>
                </View>
            ) : null}

            {sourceType === "nightscout" ? (
                <View style={styles.field}>
                    <Text style={styles.label}>
                        Nightscout server address
                    </Text>
                    <TextInput
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardType="url"
                        onChangeText={updateNightscoutBaseUrl}
                        placeholder="https://example.com"
                        placeholderTextColor="#888"
                        style={styles.input}
                        value={nightscoutBaseUrl}
                    />
                    <Text style={styles.inputHint}>
                        HTTPS is required. Reverse-proxy paths and Nightscout
                        token links are supported.
                    </Text>

                    <Text style={styles.label}>Authentication</Text>
                    <View
                        accessibilityRole="radiogroup"
                        style={styles.sourceRow}
                    >
                        <SourceButton
                            active={nightscoutAuthentication === "none"}
                            label="Public"
                            onPress={() => {
                                setNightscoutAuthentication("none");
                                setNightscoutTokenDraft("");
                                setConnectionFeedback(null);
                            }}
                        />
                        <SourceButton
                            active={
                                nightscoutAuthentication === "access-token"
                            }
                            label="Access token"
                            onPress={() => {
                                setNightscoutAuthentication("access-token");
                                setConnectionFeedback(null);
                            }}
                        />
                    </View>

                    {nightscoutAuthentication === "access-token" ? (
                        <>
                            <Text style={styles.label}>
                                Read-only access token
                            </Text>
                            <TextInput
                                autoCapitalize="none"
                                autoComplete="off"
                                autoCorrect={false}
                                onChangeText={setNightscoutTokenDraft}
                                placeholder={
                                    config.source.configurations.nightscout
                                        .authentication ===
                                        "access-token"
                                        ? "Token stored — enter to replace"
                                        : "Enter token"
                                }
                                placeholderTextColor="#888"
                                secureTextEntry
                                style={styles.input}
                                textContentType="none"
                                value={nightscoutTokenDraft}
                            />
                            <Text style={styles.inputHint}>
                                Stored in the device Keychain or Keystore,
                                never in app settings or request URLs.
                            </Text>
                        </>
                    ) : (
                        <Text style={styles.inputHint}>
                            Public mode sends no credential. Glucose data
                            remains sensitive, so use a trusted server.
                        </Text>
                    )}

                    <Pressable
                        disabled={isWorking}
                        onPress={testConnection}
                        style={styles.secondaryButton}
                    >
                        <Text style={styles.buttonText}>
                            {isWorking
                                ? "Testing..."
                                : "Test connection"}
                        </Text>
                    </Pressable>
                </View>
            ) : null}

            {connectionFeedback !== null ? (
                <Text style={styles.feedback}>
                    {connectionFeedback}
                </Text>
            ) : null}

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Polling</Text>

                <NumericSettingField
                    error={pollingErrors.intervalSeconds}
                    hint="How often to request new glucose readings."
                    label="Polling interval (seconds)"
                    onBlur={() => normalizePollingField("intervalSeconds")}
                    onChangeText={(text) =>
                        updatePollingField("intervalSeconds", text)}
                    placeholder={DEFAULT_APP_CONFIG.polling.intervalSeconds.toString()}
                    value={pollingDraft.intervalSeconds}
                />

                <NumericSettingField
                    error={pollingErrors.staleAfterSeconds}
                    hint="A reading older than this is shown as stale."
                    label="Stale threshold (seconds)"
                    onBlur={() => normalizePollingField("staleAfterSeconds")}
                    onChangeText={(text) =>
                        updatePollingField("staleAfterSeconds", text)}
                    placeholder={DEFAULT_APP_CONFIG.polling.staleAfterSeconds.toString()}
                    value={pollingDraft.staleAfterSeconds}
                />

            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Display</Text>

                <View style={styles.field}>
                    <Text style={styles.label}>Glucose unit</Text>
                    <View
                        accessibilityRole="radiogroup"
                        style={styles.sourceRow}
                    >
                        <SourceButton
                            active={displayUnit === "mg/dL"}
                            label="mg/dL"
                            onPress={() => changeDisplayUnit("mg/dL")}
                        />
                        <SourceButton
                            active={displayUnit === "mmol/L"}
                            label="mmol/L"
                            onPress={() => changeDisplayUnit("mmol/L")}
                        />
                    </View>
                </View>

                <View style={styles.field}>
                    <Text style={styles.label}>Glucose screen alignment</Text>
                    <View
                        accessibilityRole="radiogroup"
                        style={styles.sourceRow}
                    >
                        <SourceButton
                            active={displayAlign === "top"}
                            label="Top"
                            onPress={() => setDisplayAlign("top")}
                        />
                        <SourceButton
                            active={displayAlign === "middle"}
                            label="Middle"
                            onPress={() => setDisplayAlign("middle")}
                        />
                        <SourceButton
                            active={displayAlign === "bottom"}
                            label="Bottom"
                            onPress={() => setDisplayAlign("bottom")}
                        />
                    </View>
                </View>

                <SettingSwitch
                    hint="Prevent the display from sleeping while the app is open."
                    label="Keep screen awake"
                    onValueChange={setDisplayKeepScreenAwake}
                    value={displayKeepScreenAwake}
                />

                <SettingSwitch
                    hint="Hide the status and navigation bars for a distraction-free display."
                    label="Hide system UI"
                    onValueChange={setDisplayHideSystemUi}
                    value={displayHideSystemUi}
                />

                <SettingSwitch
                    hint="Show the age of the latest reading in minutes."
                    label="Show reading age"
                    onValueChange={setDisplayShowAge}
                    value={displayShowAge}
                />

                <SettingSwitch
                    hint="Show the delta (change) of the latest reading compared to the previous one."
                    label="Show reading delta"
                    onValueChange={setDisplayShowDelta}
                    value={displayShowDelta}
                />

                <SettingSwitch
                    hint="Show the latest trend direction next to the glucose value."
                    label="Show trend direction"
                    onValueChange={setDisplayShowTrend}
                    value={displayShowTrend}
                />

                <NumericSettingField
                    error={displayNumberErrors.textSize}
                    hint="The size of the text in the display. Larger values make the text easier to read."
                    label="Text size"
                    onBlur={() =>
                        normalizeDisplayNumberField("textSize")}
                    onChangeText={(text) =>
                        updateDisplayNumberField("textSize", text)}
                    placeholder={DEFAULT_APP_CONFIG.display.textSize.toString()}
                    value={displayNumberDraft.textSize}
                />

                <NumericSettingField
                    accessibilityHint={`Enter a positive glucose value in ${displayUnit}`}
                    error={displayNumberErrors.highThreshold}
                    hint={`Readings at or above this ${displayUnit} value appear in yellow.`}
                    inputMode={displayUnit === "mmol/L"
                        ? "decimal"
                        : "numeric"}
                    label={`High threshold (${displayUnit})`}
                    onBlur={() =>
                        normalizeDisplayNumberField("highThreshold")}
                    onChangeText={(text) =>
                        updateDisplayNumberField(
                            "highThreshold",
                            text,
                        )}
                    placeholder={formatGlucoseInput(
                        DEFAULT_APP_CONFIG.display.highThreshold,
                        displayUnit,
                    )}
                    value={displayNumberDraft.highThreshold}
                />

                <NumericSettingField
                    accessibilityHint={`Enter a positive glucose value in ${displayUnit}`}
                    error={displayNumberErrors.lowThreshold}
                    hint={`Readings at or below this ${displayUnit} value appear in red.`}
                    inputMode={displayUnit === "mmol/L"
                        ? "decimal"
                        : "numeric"}
                    label={`Low threshold (${displayUnit})`}
                    onBlur={() =>
                        normalizeDisplayNumberField("lowThreshold")}
                    onChangeText={(text) =>
                        updateDisplayNumberField("lowThreshold", text)}
                    placeholder={formatGlucoseInput(
                        DEFAULT_APP_CONFIG.display.lowThreshold,
                        displayUnit,
                    )}
                    value={displayNumberDraft.lowThreshold}
                />

                <NumericSettingField
                    accessibilityHint={`Enter a positive glucose value in ${displayUnit}`}
                    error={
                        displayNumberErrors.criticalLowThreshold
                    }
                    hint={`Readings at or below this ${displayUnit} value use the critical-low background.`}
                    inputMode={displayUnit === "mmol/L"
                        ? "decimal"
                        : "numeric"}
                    label={`Critical low threshold (${displayUnit})`}
                    onBlur={() =>
                        normalizeDisplayNumberField(
                            "criticalLowThreshold",
                        )}
                    onChangeText={(text) =>
                        updateDisplayNumberField(
                            "criticalLowThreshold",
                            text,
                        )}
                    placeholder={formatGlucoseInput(
                        DEFAULT_APP_CONFIG.display.criticalLowThreshold,
                        displayUnit,
                    )}
                    value={displayNumberDraft.criticalLowThreshold}
                />
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Graph</Text>
                <SettingSwitch
                    hint="Toggle if the glucose graph should be displayed."
                    label="Show glucose graph"
                    onValueChange={setGraphShow}
                    value={graphShow}
                />

                {graphShow ? (
                    <>
                        <NumericSettingField
                            accessibilityHint={`Enter a positive glucose value in ${displayUnit}`}
                            error={graphNumberErrors.ceiling}
                            hint={`The highest ${displayUnit} value shown on the graph.`}
                            inputMode={displayUnit === "mmol/L"
                                ? "decimal"
                                : "numeric"}
                            label={`Ceiling (${displayUnit})`}
                            onBlur={() => normalizeGraphNumberField("ceiling")}
                            onChangeText={(text) =>
                                updateGraphNumberField("ceiling", text)}
                            placeholder={formatGlucoseInput(
                                DEFAULT_APP_CONFIG.graph.ceiling,
                                displayUnit,
                            )}
                            value={graphNumberDraft.ceiling}
                        />

                        <NumericSettingField
                            accessibilityHint={`Enter a positive glucose value in ${displayUnit}`}
                            error={graphNumberErrors.floor}
                            hint={`The lowest ${displayUnit} value shown on the graph.`}
                            inputMode={displayUnit === "mmol/L"
                                ? "decimal"
                                : "numeric"}
                            label={`Floor (${displayUnit})`}
                            onBlur={() => normalizeGraphNumberField("floor")}
                            onChangeText={(text) =>
                                updateGraphNumberField("floor", text)}
                            placeholder={formatGlucoseInput(
                                DEFAULT_APP_CONFIG.graph.floor,
                                displayUnit,
                            )}
                            value={graphNumberDraft.floor}
                        />

                        <NumericSettingField
                            accessibilityHint="Enter a positive decimal number"
                            error={graphNumberErrors.aspectRatio}
                            hint="The graph width divided by its height."
                            inputMode="decimal"
                            label="Aspect ratio"
                            onBlur={() =>
                                normalizeGraphNumberField("aspectRatio")}
                            onChangeText={(text) =>
                                updateGraphNumberField("aspectRatio", text)}
                            placeholder={DEFAULT_APP_CONFIG.graph.aspectRatio.toString()}
                            value={graphNumberDraft.aspectRatio}
                        />

                        <NumericSettingField
                            accessibilityHint="Enter a positive number of hours"
                            error={graphNumberErrors.historyHours}
                            hint="How many hours of recent data are shown and requested for the graph."
                            inputMode="decimal"
                            label="History window (hours)"
                            onBlur={() =>
                                normalizeGraphNumberField("historyHours")}
                            onChangeText={(text) =>
                                updateGraphNumberField("historyHours", text)}
                            placeholder={(DEFAULT_APP_CONFIG.graph.historySeconds / 3600).toString()}
                            value={graphNumberDraft.historyHours}
                        />
                    </>
                ) : null}
            </View>
        </ScrollView>
    )
});

export default SettingsForm;

type NumericSettingFieldProps = {
    accessibilityHint?: string;
    error?: string;
    hint: string;
    inputMode?: "decimal" | "numeric";
    label: string;
    onBlur: () => void;
    onChangeText: (text: string) => void;
    placeholder: string;
    value: string;
};

function NumericSettingField({
    accessibilityHint = "Enter a whole number with a minimum of one",
    error,
    hint,
    inputMode = "numeric",
    label,
    onBlur,
    onChangeText,
    placeholder,
    value,
}: NumericSettingFieldProps) {
    return (
        <View style={styles.field}>
            <Text style={styles.label}>{label}</Text>
            <TextInput
                accessibilityHint={accessibilityHint}
                accessibilityLabel={label}
                inputMode={inputMode}
                onBlur={onBlur}
                onChangeText={onChangeText}
                placeholder={placeholder}
                placeholderTextColor="#888"
                style={[
                    styles.input,
                    error !== undefined && styles.inputInvalid,
                ]}
                value={value}
            />
            <Text
                accessibilityLiveRegion="polite"
                style={[
                    styles.inputHint,
                    error !== undefined && styles.inputError,
                ]}
            >
                {error ?? hint}
            </Text>
        </View>
    );
}

type SettingSwitchProps = {
    hint: string;
    label: string;
    onValueChange: (value: boolean) => void;
    value: boolean;
};

function SettingSwitch({
    hint,
    label,
    onValueChange,
    value,
}: SettingSwitchProps) {
    return (
        <View style={styles.switchRow}>
            <View style={styles.switchCopy}>
                <Text style={styles.label}>{label}</Text>
                <Text style={styles.inputHint}>{hint}</Text>
            </View>
            <Switch
                accessibilityLabel={label}
                ios_backgroundColor="#555"
                onValueChange={onValueChange}
                trackColor={{false: "#555", true: "#fff"}}
                value={value}
            />
        </View>
    );
}

type SourceButtonProps = {
    active: boolean;
    label: string;
    onPress: () => void;
};

function SourceButton({
    active,
    label,
    onPress,
}: SourceButtonProps) {
    return (
        <Pressable
            accessibilityRole="radio"
            accessibilityState={{selected: active}}
            onPress={onPress}
            style={[
                styles.sourceButton,
                active && styles.sourceButtonActive,
            ]}
        >
            <Text
                style={[
                    styles.buttonText,
                    active && styles.primaryButtonText,
                ]}
            >
                {label}
            </Text>
        </Pressable>
    )
}

const styles = StyleSheet.create({
    container: {
        gap: 24,
        padding: 24,
        paddingBottom: 40,
    },
    field: {
        gap: 12,
    },
    section: {
        gap: 20,
    },
    sectionTitle: {
        color: "#fff",
        fontSize: 20,
        fontWeight: "700",
    },
    label: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "bold",
    },
    sourceRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 12,
    },
    sourceButton: {
        backgroundColor: "#444",
        borderRadius: 8,
        paddingHorizontal: 20,
        paddingVertical: 12,
    },
    sourceButtonActive: {
        backgroundColor: "#fff",
    },
    input: {
        backgroundColor: "#111",
        borderColor: "#555",
        borderRadius: 8,
        borderWidth: 1,
        color: "#fff",
        fontSize: 16,
        padding: 12,
    },
    actions: {
        flexDirection: "row",
        gap: 12,
        justifyContent: "flex-end",
        marginTop: "auto",
    },
    primaryButton: {
        backgroundColor: "#fff",
        borderRadius: 8,
        paddingHorizontal: 20,
        paddingVertical: 12,
    },
    secondaryButton: {
        backgroundColor: "#444",
        borderRadius: 8,
        paddingHorizontal: 20,
        paddingVertical: 12,
    },
    buttonText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "bold",
    },
    primaryButtonText: {
        color: "#000",
    },
    feedback: {
        color: "#ccc",
        fontSize: 15,
    },
    inputHint: {
        color: "#aaa",
        fontSize: 14,
    },
    inputError: {
        color: "#ff8a8a",
    },
    inputInvalid: {
        borderColor: "#ff8a8a",
    },
    switchRow: {
        alignItems: "center",
        flexDirection: "row",
        gap: 16,
        justifyContent: "space-between",
        minHeight: 56,
    },
    switchCopy: {
        flex: 1,
        gap: 4,
    }
})
