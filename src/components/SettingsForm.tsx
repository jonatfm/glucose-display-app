import {
    forwardRef,
    useEffect,
    useImperativeHandle,
    useRef,
    useState,
} from "react";
import { useAppConfig } from "../config/AppConfigProvider";
import { AppConfig, SourceConfig } from "../config/types";
import { DEFAULT_APP_CONFIG, DEFAULT_XDRIP_SOURCE_CONFIG } from "../config/defaults";
import { createConnector } from "../connectors/createConnector";
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

const POLLING_FIELD_NAMES: Record<PollingField, string> = {
    intervalSeconds: "Polling interval",
    staleAfterSeconds: "Stale threshold",
    historySeconds: "History window",
};

const DISPLAY_NUMBER_FIELD_NAMES: Record<DisplayNumberField, string> = {
    textSize: "Text size",
    highThreshold: "High threshold",
    lowThreshold: "Low threshold",
    criticalLowThreshold: "Critical low threshold",
};

const createPollingDraft = (
    polling: AppConfig["polling"],
): PollingDraft => ({
    intervalSeconds: polling.intervalSeconds.toString(),
    staleAfterSeconds: polling.staleAfterSeconds.toString(),
    historySeconds: polling.historySeconds.toString(),
});

const createDisplayNumberDraft = (
    display: AppConfig["display"],
): DisplayNumberDraft => ({
    textSize: display.textSize.toString(),
    highThreshold: display.highThreshold.toString(),
    lowThreshold: display.lowThreshold.toString(),
    criticalLowThreshold: display.criticalLowThreshold.toString(),
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
    const historySeconds = parseField("historySeconds");

    if (intervalSeconds === undefined ||
        staleAfterSeconds === undefined ||
        historySeconds === undefined) {
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
            historySeconds,
        },
    };
};

const validateDisplayNumberDraft = (
    draft: DisplayNumberDraft,
): {
    errors: DisplayNumberErrors;
    values: Record<DisplayNumberField, number> | null;
} => {
    const errors: DisplayNumberErrors = {};
    const values = {} as Record<DisplayNumberField, number>;

    for (const field of Object.keys(
        DISPLAY_NUMBER_FIELD_NAMES,
    ) as DisplayNumberField[]) {
        try {
            values[field] = parsePositiveWholeNumber(
                draft[field],
                DISPLAY_NUMBER_FIELD_NAMES[field],
            );
        } catch (error) {
            errors[field] = error instanceof Error
                ? error.message
                : "Enter a valid whole number";
        }
    }

    return {
        errors,
        values: Object.keys(errors).length === 0 ? values : null,
    };
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

const SettingsForm = forwardRef<SettingsFormHandle, SettingsFormProps>(
function SettingsForm({
    visible,
    onFinished,
}, ref) {
    const {config, replaceConfig} = useAppConfig();

    // glucose source settings
    const [sourceType, setSourceType] = useState<SourceType>("none");
    const [xdripBaseUrl, setXdripBaseUrl] = useState(DEFAULT_XDRIP_SOURCE_CONFIG.baseUrl);
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
    const [displayNumberDraft, setDisplayNumberDraft] =
        useState<DisplayNumberDraft>(
            createDisplayNumberDraft(config.display),
        );
    const [displayNumberErrors, setDisplayNumberErrors] =
        useState<DisplayNumberErrors>({});

    useEffect(() => {
        if (!visible) {
            testController.current?.abort();
            return;
        }

        setSourceType(config.source.type);
        setXdripBaseUrl(
            config.source.type === "xdrip"
                ? config.source.baseUrl
                : DEFAULT_XDRIP_SOURCE_CONFIG.baseUrl,
        );
        setPollingDraft(createPollingDraft(config.polling));
        setPollingErrors({});
        setDisplayUnit(config.display.unit);
        setDisplayKeepScreenAwake(config.display.keepScreenAwake);
        setDisplayHideSystemUi(config.display.hideSystemUi);
        setDisplayShowAge(config.display.showAge);
        setDisplayShowDelta(config.display.showDelta);
        setDisplayNumberDraft(createDisplayNumberDraft(config.display));
        setDisplayNumberErrors({});
        setConnectionFeedback(null);
    }, [config.display, config.polling, config.source, visible]);

    useEffect(
        () => () => testController.current?.abort(),
        [],
    );

    const createDraftSource = (): SourceConfig => {
        if (sourceType === "none") {
            return {
                type: "none",
            };
        }

        return parseXdripSource(xdripBaseUrl);
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
            const value = parsePositiveWholeNumber(
                displayNumberDraft[field],
                DISPLAY_NUMBER_FIELD_NAMES[field],
            );
            updateDisplayNumberField(field, value.toString());
        } catch (error) {
            setDisplayNumberErrors((current) => ({
                ...current,
                [field]: error instanceof Error
                    ? error.message
                    : "Enter a valid whole number",
            }));
        }
    };

    const testConnection = async () => {
        setIsWorking(true);
        setConnectionFeedback(null);

        testController.current?.abort();
        testController.current = new AbortController();

        try {
            const source = createDraftSource();
            const connector = createConnector(source);

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
        } = validateDisplayNumberDraft(displayNumberDraft);

        if (polling === null || displayNumbers === null) {
            setPollingErrors(errors);
            setDisplayNumberErrors(displayErrors);
            return;
        }

        setPollingErrors({});
        setDisplayNumberErrors({});
        setIsWorking(true);

        try {
            const source = createDraftSource();

            await replaceConfig({
                ...config,
                source,
                polling,
                display: {
                    unit: displayUnit,
                    keepScreenAwake: displayKeepScreenAwake,
                    hideSystemUi: displayHideSystemUi,
                    showAge: displayShowAge,
                    showDelta: displayShowDelta,
                    textSize: displayNumbers.textSize,
                    highThreshold: displayNumbers.highThreshold,
                    lowThreshold: displayNumbers.lowThreshold,
                    criticalLowThreshold:
                        displayNumbers.criticalLowThreshold,
                },
            });

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
        onFinished();
    };

    return (
        <ScrollView
            contentContainerStyle={styles.container}
            keyboardShouldPersistTaps="handled"
        >
            <Text style={styles.label}>Glucose source</Text>
            <View style={styles.sourceRow}>
                <SourceButton
                    active={sourceType === "none"}
                    label="None"
                    onPress={() => {
                        setSourceType("none");
                        setConnectionFeedback(null);
                    }}
                />
                <SourceButton
                    active={sourceType === "xdrip"}
                    label="xDrip"
                    onPress={() => {
                        setSourceType("xdrip");
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

                <NumericSettingField
                    error={pollingErrors.historySeconds}
                    hint="How much recent reading history to request. Required to fill the graph with data."
                    label="History window (seconds)"
                    onBlur={() => normalizePollingField("historySeconds")}
                    onChangeText={(text) =>
                        updatePollingField("historySeconds", text)}
                    placeholder={DEFAULT_APP_CONFIG.polling.historySeconds.toString()}
                    value={pollingDraft.historySeconds}
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
                            onPress={() => setDisplayUnit("mg/dL")}
                        />
                        <SourceButton
                            active={displayUnit === "mmol/L"}
                            label="mmol/L"
                            onPress={() => setDisplayUnit("mmol/L")}
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
                    error={displayNumberErrors.highThreshold}
                    hint="The glucose value above which the reading is considered high and appears in yellow."
                    label="High threshold"
                    onBlur={() =>
                        normalizeDisplayNumberField("highThreshold")}
                    onChangeText={(text) =>
                        updateDisplayNumberField(
                            "highThreshold",
                            text,
                        )}
                    placeholder={DEFAULT_APP_CONFIG.display.highThreshold.toString()}
                    value={displayNumberDraft.highThreshold}
                />

                <NumericSettingField
                    error={displayNumberErrors.lowThreshold}
                    hint="The glucose value below which the reading is considered low and appears in red."
                    label="Low threshold"
                    onBlur={() =>
                        normalizeDisplayNumberField("lowThreshold")}
                    onChangeText={(text) =>
                        updateDisplayNumberField("lowThreshold", text)}
                    placeholder={DEFAULT_APP_CONFIG.display.lowThreshold.toString()}
                    value={displayNumberDraft.lowThreshold}
                />

                <NumericSettingField
                    error={
                        displayNumberErrors.criticalLowThreshold
                    }
                    hint="The glucose value below which the reading is considered critically low and the background turns red."
                    label="Critical low threshold"
                    onBlur={() =>
                        normalizeDisplayNumberField(
                            "criticalLowThreshold",
                        )}
                    onChangeText={(text) =>
                        updateDisplayNumberField(
                            "criticalLowThreshold",
                            text,
                        )}
                    placeholder={DEFAULT_APP_CONFIG.display.criticalLowThreshold.toString()}
                    value={displayNumberDraft.criticalLowThreshold}
                />
            </View>
        </ScrollView>
    )
});

export default SettingsForm;

type NumericSettingFieldProps = {
    error?: string;
    hint: string;
    label: string;
    onBlur: () => void;
    onChangeText: (text: string) => void;
    placeholder: string;
    value: string;
};

function NumericSettingField({
    error,
    hint,
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
                accessibilityHint="Enter a whole number with a minimum of one"
                accessibilityLabel={label}
                inputMode="numeric"
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
