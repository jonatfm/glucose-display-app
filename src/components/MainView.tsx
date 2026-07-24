import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const SETTINGS_LONG_PRESS_DELAY_MS = 1_000;

export default function MainView({ children }: { children: React.ReactNode }) {
    const [areSettingsVisible, setAreSettingsVisible] = useState(false);

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

                        <View style={styles.modalContent} />
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
    modalContent: {
        flex: 1,
    },
})
