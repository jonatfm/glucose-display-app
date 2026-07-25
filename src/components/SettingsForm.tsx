import {
    forwardRef,
    useEffect,
    useImperativeHandle,
    useRef,
    useState,
} from "react";
import { useAppConfig } from "../config/AppConfigProvider";
import { SourceConfig } from "../config/types";
import { DEFAULT_XDRIP_SOURCE_CONFIG } from "../config/defaults";
import { createConnector } from "../connectors/createConnector";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

type SettingsFormProps = {
    visible: boolean;
    onFinished: () => void;
};

export type SettingsFormHandle = {
    save: () => Promise<void>;
};

type SourceType = SourceConfig["type"];

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

    const [sourceType, setSourceType] = useState<SourceType>("none");
    const [xdripBaseUrl, setXdripBaseUrl] = useState(DEFAULT_XDRIP_SOURCE_CONFIG.baseUrl);
    const [connectionFeedback, setConnectionFeedback] = useState<string | null>(null);
    const [isWorking, setIsWorking] = useState(false);
    const testController = useRef<AbortController | null>(null);

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
        setConnectionFeedback(null);
    }, [config.source, visible]);

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

        setIsWorking(true);
        setConnectionFeedback(null);

        try {
            const source = createDraftSource();

            await replaceConfig({
                ...config,
                source,
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
        <View style={styles.container}>
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
                        placeholder="http://127.0.0.1:17580"
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
        </View>
    )
});

export default SettingsForm;

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
        flex: 1,
        gap: 24,
        padding: 24,
    },
    field: {
        gap: 12,
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
    }
})
