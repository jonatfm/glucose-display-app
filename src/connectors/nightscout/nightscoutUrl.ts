export type NormalizedNightscoutInput = {
    baseUrl: string;
    token: string | null;
};

const NIGHTSCOUT_API_PATH = "api/v1/entries/sgv.json";

export const normalizeNightscoutInput = (
    input: string,
): NormalizedNightscoutInput => {
    const trimmed = input.trim();

    if (trimmed.length === 0) {
        throw new Error("Enter the Nightscout server address");
    }

    let url: URL;

    try {
        url = new URL(trimmed);
    } catch {
        throw new Error("Enter a valid Nightscout server address");
    }

    if (url.protocol !== "https:") {
        throw new Error("Nightscout must use HTTPS");
    }

    if (url.username.length > 0 || url.password.length > 0) {
        throw new Error("The Nightscout address must not contain a username or password");
    }

    if (url.hash.length > 0) {
        throw new Error("The Nightscout address must not contain a fragment");
    }

    const queryKeys = [...url.searchParams.keys()];
    const hasOnlyTokenQuery =
        queryKeys.every((key) => key === "token") &&
        queryKeys.filter((key) => key === "token").length <= 1;

    if (!hasOnlyTokenQuery) {
        throw new Error("The Nightscout address contains unsupported query parameters");
    }

    const token = url.searchParams.get("token")?.trim() || null;
    url.search = "";

    let path = url.pathname.replace(/\/+$/, "");
    const apiPathIndex = path.toLowerCase().indexOf("/api/v1/");

    if (apiPathIndex >= 0) {
        path = path.slice(0, apiPathIndex);
    }

    url.pathname = path.length === 0 ? "/" : `${path}/`;

    return {
        baseUrl: url.toString().replace(/\/$/, ""),
        token,
    };
};

export const createNightscoutReadingsUrl = (
    baseUrl: string,
    count: number,
): URL => {
    const normalized = normalizeNightscoutInput(baseUrl);
    const url = new URL(
        `${normalized.baseUrl.replace(/\/$/, "")}/${NIGHTSCOUT_API_PATH}`,
    );

    url.searchParams.set("count", String(count));
    return url;
};
