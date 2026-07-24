import { useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import SettingsForm, { type SettingsFormHandle } from "./SettingsForm";

const SETTINGS_LONG_PRESS_DELAY_MS = 1_000;

export default function MainView({ children }: { children: React.ReactNode }) {
    const [areSettingsVisible, setAreSettingsVisible] = useState(false);
    const settingsFormRef = useRef<SettingsFormHandle>(null);

    const closeSettings = () => setAreSettingsVisible(false);

    return (
        <SafeAreaView style={styles.container}>
            <Pressable
                accessibilityHint="Hold for one second to open settings"
                delayLongPress={SETTINGS_LONG_PRESS_DELAY_MS}
                onLongPress={() => setAreSettingsVisible(true)}
                style={styles.content}
            >
                {children}
            </Pressable>

            <Modal
                animationType="fade"
                onRequestClose={closeSettings}
                presentationStyle="overFullScreen"
                transparent
                visible={areSettingsVisible}
            >
                <SafeAreaView style={styles.modalBackdrop}>
                    <View
                        accessibilityViewIsModal
                        style={styles.modal}
                    >
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Settings</Text>
                            <Pressable
                                accessibilityLabel="Close settings"
                                accessibilityRole="button"
                                hitSlop={12}
                                onPress={closeSettings}
                                style={styles.closeButton}
                            >
                                <Text style={styles.closeButtonText}>×</Text>
                            </Pressable>
                        </View>

                        <View style={styles.modalContent}>
                            <SettingsForm
                                ref={settingsFormRef}
                                onFinished={closeSettings}
                                visible={areSettingsVisible}
                            />
                        </View>
                        <View style={styles.modalFooter}>
                            <Pressable
                                accessibilityRole="button"
                                onPress={() => {
                                    void settingsFormRef.current?.save();
                                }}
                                style={styles.saveButton}
                            >
                                <Text style={styles.saveButtonText}>Save configuration</Text>
                            </Pressable>
                        </View>
                    </View>
                </SafeAreaView>
            </Modal>
        </SafeAreaView>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#000",
    },
    content: {
        flex: 1,
        padding: 16,
    },
    modalBackdrop: {
        flex: 1,
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        padding: 24,
    },
    modal: {
        flex: 1,
        overflow: "hidden",
        borderColor: "#333",
        borderRadius: 24,
        borderWidth: 1,
        backgroundColor: "#222222",
    },
    modalHeader: {
        minHeight: 72,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottomColor: "#333",
        borderBottomWidth: StyleSheet.hairlineWidth,
        paddingHorizontal: 24,
    },
    modalFooter: {
        minHeight: 72,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        borderTopColor: "#333",
        borderTopWidth: StyleSheet.hairlineWidth,
        paddingHorizontal: 24,
    },
    modalTitle: {
        color: "#fff",
        fontSize: 28,
        fontWeight: "700",
    },
    closeButton: {
        width: 48,
        height: 48,
        alignItems: "center",
        justifyContent: "center",
    },
    closeButtonText: {
        color: "#fff",
        fontSize: 40,
        fontWeight: "300",
        lineHeight: 44,
    },
    saveButton: {
        flex: 1,
        paddingVertical: 12,
        paddingHorizontal: 24,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 8,
        backgroundColor: "#fff",
    },
    saveButtonText: {
        color: "#000",
        fontSize: 16,
        fontWeight: "600",
    },
    modalContent: {
        flex: 1,
    },
})
