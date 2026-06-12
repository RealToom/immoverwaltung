let _accessToken: string | null = null;

export function setToken(token: string): void {
  _accessToken = token;
}

export function clearToken(): void {
  _accessToken = null;
}

export function getToken(): string | null {
  return _accessToken;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  isFormData?: boolean;
}

let _currentSlug: string | null = null;
let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

async function refreshToken(): Promise<string | null> {
  if (isRefreshing && refreshPromise) return refreshPromise;
  if (!_currentSlug) return null;
  isRefreshing = true;
  refreshPromise = fetch(`/api/tenant/${_currentSlug}/auth/refresh`, {
    method: "POST",
    credentials: "include",
  })
    .then(async (r) => {
      if (!r.ok) return null;
      const json = await r.json();
      const token = json?.data?.accessToken ?? null;
      if (token) setToken(token);
      return token;
    })
    .catch(() => null)
    .finally(() => {
      isRefreshing = false;
      refreshPromise = null;
    });
  return refreshPromise;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (_accessToken) headers["Authorization"] = `Bearer ${_accessToken}`;

  const init: RequestInit = {
    method: options.method ?? "GET",
    headers,
    credentials: "include",
  };

  if (options.body !== undefined) {
    if (options.isFormData) {
      init.body = options.body as FormData;
      // Do not set Content-Type — browser sets multipart/form-data automatically
    } else {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(options.body);
    }
  }

  let res = await fetch(path, init);

  if (res.status === 401 && _accessToken) {
    const newToken = await refreshToken();
    if (newToken) {
      headers["Authorization"] = `Bearer ${newToken}`;
      init.headers = headers;
      res = await fetch(path, init);
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, extractErrorMessage(body) ?? `HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}

/** Backend liefert { error: { message } }; Rate-Limiter liefert { error: string }. */
function extractErrorMessage(body: unknown): string | null {
  const err = (body as { error?: unknown })?.error;
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const msg = (err as { message?: unknown }).message;
    if (typeof msg === "string") return msg;
  }
  return null;
}

/** Convenience wrapper: prepends /api/tenant/:slug to path. Keeps slug for auto-refresh. */
export function tenantApi<T>(slug: string, path: string, options: RequestOptions = {}): Promise<T> {
  _currentSlug = slug;
  return api<T>(`/api/tenant/${slug}${path}`, options);
}

/** Schließt den 2FA-Login ab. mfaToken wird als Authorization-Header gesendet. */
export async function verify2fa(
  slug: string,
  mfaToken: string,
  code: string,
  rememberDevice: boolean
): Promise<{ accessToken: string }> {
  const res = await fetch(`/api/tenant/${slug}/auth/verify-2fa`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${mfaToken}`,
    },
    credentials: "include",
    body: JSON.stringify({ code, rememberDevice }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, extractErrorMessage(body) ?? `HTTP ${res.status}`);
  }

  const json = await res.json();
  const data = json?.data as { accessToken?: string } | undefined;
  if (!data?.accessToken) {
    throw new ApiError(res.status, "Ungültige Server-Antwort");
  }
  return { accessToken: data.accessToken };
}
