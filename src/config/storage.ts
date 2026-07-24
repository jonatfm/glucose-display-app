import AsyncStorage from "@react-native-async-storage/async-storage";
import { DEFAULT_APP_CONFIG } from "./defaults";
import type { AppConfig } from "./types";
import { isAppConfig } from "./validation";

const STORAGE_KEY = "car-glucose-display.config.v1";

export const loadAppConfig =
    async (): Promise<AppConfig> => {
        try {
            const stored = await AsyncStorage.getItem(STORAGE_KEY);

            if (stored === null) {
                return DEFAULT_APP_CONFIG;
            }

            const parsed: unknown = JSON.parse(stored);

            return isAppConfig(parsed)
                ? parsed
                : DEFAULT_APP_CONFIG;
        } catch (error) {
            console.warn("Could not load configuration", error);
            return DEFAULT_APP_CONFIG;
        }
    };

export const saveAppConfig = async (
    config: AppConfig,
): Promise<void> => {
    await AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(config),
    );
};

export const clearAppConfig = async (): Promise<void> => {
    await AsyncStorage.removeItem(STORAGE_KEY);
}