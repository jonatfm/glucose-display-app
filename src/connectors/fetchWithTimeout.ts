export class FetchTimeoutError extends Error {
    constructor(timeoutMilliseconds: number) {
        super(
            `Request timed out after ${timeoutMilliseconds / 1000} seconds`,
        );
        this.name = "FetchTimeoutError";
    }
}

export const fetchWithTimeout = async (
    input: Parameters<typeof fetch>[0],
    init: Parameters<typeof fetch>[1],
    timeoutMilliseconds: number,
): Promise<Response> => {
    const controller = new AbortController();
    const callerSignal = init?.signal;
    let didTimeOut = false;

    const abortFromCaller = () => {
        controller.abort();
    };

    if (callerSignal?.aborted) {
        controller.abort();
    } else {
        callerSignal?.addEventListener(
            "abort",
            abortFromCaller,
            {once: true},
        );
    }

    const timeout = setTimeout(() => {
        didTimeOut = true;
        controller.abort();
    }, timeoutMilliseconds);

    try {
        return await fetch(input, {
            ...init,
            signal: controller.signal,
        });
    } catch (error) {
        if (didTimeOut) {
            throw new FetchTimeoutError(timeoutMilliseconds);
        }

        throw error;
    } finally {
        clearTimeout(timeout);
        callerSignal?.removeEventListener(
            "abort",
            abortFromCaller,
        );
    }
};
