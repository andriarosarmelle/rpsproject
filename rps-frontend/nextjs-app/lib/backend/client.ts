import { ApiResponseError, apiFetch, getApiBaseUrl } from "@/lib/api";

export class BackendConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BackendConfigurationError";
  }
}

function resolveBackendUrl(): string | null {
  return getApiBaseUrl();
}

function getRequiredBackendUrl() {
  const backendUrl = resolveBackendUrl();

  if (!backendUrl) {
    throw new BackendConfigurationError(
      "Backend API URL is not configured. Set NEXT_PUBLIC_API_URL for browser requests and API_URL for server-side requests."
    );
  }

  return backendUrl;
}

export function isBackendConfigured() {
  return Boolean(resolveBackendUrl());
}

function getAuthHeaders(customToken?: string): Record<string, string> {
  const token = customToken || null;

  return token ? { Authorization: `Bearer ${token}` } : {};
}

function mergeHeaders(initHeaders?: HeadersInit, customToken?: string) {
  const headers = new Headers(initHeaders);
  headers.set("Content-Type", "application/json");

  for (const [key, value] of Object.entries(getAuthHeaders(customToken))) {
    headers.set(key, value);
  }

  return headers;
}

function logBackendWarning(message: string) {
  if (process.env.NODE_ENV === "development") {
    console.warn(`[Backend] ${message}`);
  }
}

function getApiErrorMessage(body: string) {
  if (!body.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(body) as { message?: unknown; error?: unknown };
    const message = Array.isArray(parsed.message)
      ? parsed.message.join("; ")
      : typeof parsed.message === "string"
        ? parsed.message
        : null;

    if (message) {
      return message;
    }

    return typeof parsed.error === "string" ? parsed.error : null;
  } catch {
    return body.slice(0, 240);
  }
}

async function backendFetch<T>(path: string, init?: RequestInit) {
  const backendUrl = getRequiredBackendUrl();
  const controller = new AbortController();
  const timeoutMs = path.includes("/import-employees") ? 120000 : 30000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await apiFetch<T>(path, {
      ...init,
      signal: controller.signal,
      headers: mergeHeaders(init?.headers),
      cache: "no-store",
    });
  } catch (error) {
    clearTimeout(timeout);

    const message = error instanceof Error ? error.message : "Unknown backend fetch error";

    if (error instanceof Error && error.name === "AbortError") {
      const timeoutSec = timeoutMs / 1000;
      logBackendWarning(
        `Request timeout after ${timeoutSec}s on ${path}. Check network connectivity.`
      );
      throw new Error(
        `Delai d'attente depasse apres ${timeoutSec}s. Verifie ta connexion reseau et reessaie.`
      );
    }

    if (error instanceof ApiResponseError) {
      const errorPreview = error.body ? ` - ${error.body.slice(0, 180)}` : "";
      const apiMessage = getApiErrorMessage(error.body);
      logBackendWarning(
        `Request failed ${error.status} ${error.statusText} on ${path}${errorPreview}`
      );
      throw new Error(
        apiMessage
          ? `Backend request failed: ${error.status} ${error.statusText} - ${apiMessage}`
          : `Backend request failed: ${error.status} ${error.statusText}`,
      );
    }

    const isNetworkFailure =
      error instanceof TypeError ||
      /fetch failed|ECONNREFUSED|ENOTFOUND|EHOSTUNREACH|ETIMEDOUT/i.test(message);

    if (isNetworkFailure) {
      logBackendWarning(
        `Unable to reach backend at ${backendUrl}. Verify API is running before opening protected pages.`
      );
      throw new Error(
        `Backend unavailable at ${backendUrl}. Verify NEXT_PUBLIC_API_URL and that the API is running.`
      );
    }

    if (!message.startsWith("Backend request failed:")) {
      logBackendWarning(`Unexpected error on ${path}: ${message}`);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}


export async function getBackendCollection<T>(path: string, token?: string) {
  return backendFetch<T[]>(path, token ? { headers: mergeHeaders(undefined, token) } : undefined);
}

export async function getBackendItem<T>(path: string, token?: string) {
  return backendFetch<T>(path, token ? { headers: mergeHeaders(undefined, token) } : undefined);
}

export async function postBackend<TResponse, TBody>(path: string, body: TBody, token?: string) {
  return backendFetch<TResponse>(path, {
    method: "POST",
    body: JSON.stringify(body),
    headers: mergeHeaders(undefined, token),
  });
}

export async function patchBackend<TResponse, TBody>(path: string, body: TBody, token?: string) {
  return backendFetch<TResponse>(path, {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: mergeHeaders(undefined, token),
  });
}

export async function deleteBackend<TResponse>(path: string, token?: string) {
  return backendFetch<TResponse>(path, {
    method: "DELETE",
    headers: mergeHeaders(undefined, token),
  });
}

export function getBackendUrl() {
  return resolveBackendUrl();
}
