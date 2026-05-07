const DEFAULT_APP_URL = "http://127.0.0.1:3001";

export class ApiResponseError extends Error {
  status: number;
  statusText: string;
  body: string;

  constructor(status: number, statusText: string, body = "") {
    super(`API error: ${status} ${statusText}`);
    this.name = "ApiResponseError";
    this.status = status;
    this.statusText = statusText;
    this.body = body;
  }
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/$/, "");
}

function ensureLeadingSlash(value: string) {
  return value.startsWith("/") ? value : `/${value}`;
}

function isAbsoluteHttpUrl(value: string | undefined | null): value is string {
  return Boolean(value && /^https?:\/\//i.test(value.trim()));
}

function joinUrl(baseUrl: string, path: string) {
  return `${trimTrailingSlash(baseUrl)}${ensureLeadingSlash(path)}`;
}

export function getApiBaseUrl(): string | null {
  const serverUrl = process.env.API_URL?.trim();
  const publicUrl = process.env.NEXT_PUBLIC_API_URL?.trim();

  if (typeof window === "undefined") {
    if (isAbsoluteHttpUrl(serverUrl)) {
      return trimTrailingSlash(serverUrl);
    }

    if (isAbsoluteHttpUrl(publicUrl)) {
      return trimTrailingSlash(publicUrl);
    }

    return null;
  }

  if (isAbsoluteHttpUrl(publicUrl)) {
    return trimTrailingSlash(publicUrl);
  }

  return null;
}

export function getApiUrl(path: string) {
  const baseUrl = getApiBaseUrl();

  if (!baseUrl) {
    throw new Error(
      "Backend API URL is not configured. Set NEXT_PUBLIC_API_URL for browser requests and API_URL for server-side requests."
    );
  }

  return joinUrl(baseUrl, path);
}

export function getAppBaseUrl() {
  if (typeof window !== "undefined" && window.location?.origin) {
    return trimTrailingSlash(window.location.origin);
  }

  const serverUrl = process.env.APP_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (isAbsoluteHttpUrl(serverUrl)) {
    return trimTrailingSlash(serverUrl);
  }

  return DEFAULT_APP_URL;
}

export function getAppUrl(path: string) {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  return joinUrl(getAppBaseUrl(), path);
}

function mergeJsonHeaders(initHeaders?: HeadersInit, body?: BodyInit | null) {
  const headers = new Headers(initHeaders);

  if (body && !(body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  // Automatically include CSRF token for non-GET requests if available
  if (typeof document !== 'undefined' && 
      initHeaders?.method !== 'GET' && 
      initHeaders?.method !== 'HEAD' && 
      initHeaders?.method !== 'OPTIONS') {
    const csrfToken = getCookie('XSRF-TOKEN') || getCookie('_csrf');
    if (csrfToken) {
      headers.set('X-CSRF-Token', csrfToken);
    }
  }

  return headers;
}

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
  return null;
}

export async function apiFetch<T>(endpoint: string, options: RequestInit = {}) {
  const response = await fetch(getApiUrl(endpoint), {
    ...options,
    headers: mergeJsonHeaders(options.headers, options.body),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new ApiResponseError(response.status, response.statusText, body);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return (await response.json()) as T;
  }

  return (await response.text()) as T;
}

export async function appFetch(path: string, options: RequestInit = {}) {
  return fetch(getAppUrl(path), options);
}