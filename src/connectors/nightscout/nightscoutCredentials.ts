import * as SecureStore from "expo-secure-store";

const KEY_PREFIX = "nightscout-token.";
const KEYCHAIN_SERVICE = "car-glucose-display.nightscout";

const options: SecureStore.SecureStoreOptions = {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    keychainService: KEYCHAIN_SERVICE,
};

const keyFor = (credentialId: string) => `${KEY_PREFIX}${credentialId}`;

const assertAvailable = async () => {
    if (!await SecureStore.isAvailableAsync()) {
        throw new Error(
            "Secure token storage is unavailable on this device",
        );
    }
};

export const createCredentialId = (): string => {
    const random = Math.random().toString(36).slice(2);
    return `${Date.now().toString(36)}-${random}`;
};

export const storeNightscoutToken = async (
    credentialId: string,
    token: string,
): Promise<void> => {
    const normalized = token.trim();

    if (normalized.length === 0) {
        throw new Error("Enter a Nightscout access token");
    }

    await assertAvailable();
    await SecureStore.setItemAsync(
        keyFor(credentialId),
        normalized,
        options,
    );
};

export const loadNightscoutToken = async (
    credentialId: string,
): Promise<string | null> => {
    await assertAvailable();
    return SecureStore.getItemAsync(keyFor(credentialId), options);
};

export const deleteNightscoutToken = async (
    credentialId: string,
): Promise<void> => {
    await assertAvailable();
    await SecureStore.deleteItemAsync(keyFor(credentialId), options);
};
