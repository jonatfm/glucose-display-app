import {
    createContext,
    type PropsWithChildren,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";

import { DEFAULT_APP_CONFIG } from "./defaults";
import {
    clearAppConfig,
    loadAppConfig,
    saveAppConfig,
} from "./storage";
import type { AppConfig } from "./types";
import { deleteNightscoutToken } from "../connectors/nightscout/nightscoutCredentials";

type AppConfigContextValue = {
    config: AppConfig;
    isLoaded: boolean;
    replaceConfig: (config: AppConfig) => Promise<void>;
    resetConfig: () => Promise<void>;
};

const AppConfigContext = createContext<AppConfigContextValue | null>(null);

export function AppConfigProvider({
    children,
}: PropsWithChildren) {
    const [config, setConfig] = useState<AppConfig>(DEFAULT_APP_CONFIG);

    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        let active = true;

        loadAppConfig().then((storedConfig) => {
            if (active) {
                setConfig(storedConfig);
                setIsLoaded(true);
            }
        });

        return () => {
            active = false;
        };
    }, []);

    const replaceConfig = useCallback(
        async (nextConfig: AppConfig) => {
            await saveAppConfig(nextConfig);
            setConfig(nextConfig);
        },
        [],
    );

    const resetConfig = useCallback(async () => {
        const nightscout =
            config.source.configurations.nightscout;
        const credentialId =
            nightscout.authentication === "access-token"
            ? nightscout.credentialId
            : null;

        await clearAppConfig();
        setConfig(DEFAULT_APP_CONFIG);

        if (credentialId !== null) {
            try {
                await deleteNightscoutToken(credentialId);
            } catch (error) {
                console.warn("Could not remove Nightscout token", error);
            }
        }
    }, [config.source.configurations.nightscout]);

    const value = useMemo(
        () => ({
            config,
            isLoaded,
            replaceConfig,
            resetConfig,
        }),
        [config, isLoaded, replaceConfig, resetConfig],
    );

    return (
        <AppConfigContext.Provider value={value}>
            {children}
        </AppConfigContext.Provider>
    );
}

export const useAppConfig = () => {
    const context = useContext(AppConfigContext);

    if (context === null) {
        throw new Error(
            "useAppConfig must be used inside AppConfigProvider",
        );
    }

    return context;
};
