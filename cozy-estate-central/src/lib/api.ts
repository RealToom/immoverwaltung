const TOKEN_KEY = "accessToken";

let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

async function refreshAccessToken(): Promise<string | null> {
  try {
    const res = await fetch("/api/auth/refresh", { method: "POST", credentials: "include" });
    if (!res.ok) return null;
    const json = await res.json();
    const newToken = json.data.accessToken;
    setToken(newToken);
    return newToken;
  } catch {
    return null;
  }
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  params?: Record<string, string | number | undefined>;
}

export async function api<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, params } = options;

  let url = `/api${path}`;
  if (params) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== "") {
        searchParams.set(key, String(value));
      }
    }
    const qs = searchParams.toString();
    if (qs) url += `?${qs}`;
  }

  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  if (body) {
    headers["Content-Type"] = "application/json";
  }

  let res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    credentials: "include",
  });

  // Token refresh on 401
  if (res.status === 401 && token) {
    if (!isRefreshing) {
      isRefreshing = true;
      refreshPromise = refreshAccessToken();
    }
    const newToken = await refreshPromise;
    isRefreshing = false;
    refreshPromise = null;

    if (newToken) {
      headers["Authorization"] = `Bearer ${newToken}`;
      res = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        credentials: "include",
      });
    } else {
      clearToken();
      window.location.href = "/login";
      throw new ApiError(401, "Sitzung abgelaufen. Bitte erneut anmelden.");
    }
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const json = await res.json();

  if (!res.ok) {
    throw new ApiError(res.status, json.error?.message || "Ein Fehler ist aufgetreten", json.error);
  }

  return json as T;
}

export async function uploadFile<T = unknown>(path: string, formData: FormData): Promise<T> {
  const url = `/api${path}`;

  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  // Do NOT set Content-Type - browser sets multipart boundary automatically

  let res = await fetch(url, {
    method: "POST",
    headers,
    body: formData,
    credentials: "include",
  });

  if (res.status === 401 && token) {
    if (!isRefreshing) {
      isRefreshing = true;
      refreshPromise = refreshAccessToken();
    }
    const newToken = await refreshPromise;
    isRefreshing = false;
    refreshPromise = null;

    if (newToken) {
      headers["Authorization"] = `Bearer ${newToken}`;
      res = await fetch(url, {
        method: "POST",
        headers,
        body: formData,
        credentials: "include",
      });
    } else {
      clearToken();
      window.location.href = "/login";
      throw new ApiError(401, "Sitzung abgelaufen. Bitte erneut anmelden.");
    }
  }

  const json = await res.json();

  if (!res.ok) {
    throw new ApiError(res.status, json.error?.message || "Ein Fehler ist aufgetreten", json.error);
  }

  return json as T;
}

export type ScanPhase = "idle" | "uploading" | "analyzing";

export async function uploadFileWithProgress<T = unknown>(
  path: string,
  formData: FormData,
  onPhaseChange: (phase: Exclude<ScanPhase, "idle">) => void,
): Promise<T> {
  const token = getToken();

  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api${path}`);
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.withCredentials = true;

    // Upload complete → switch to analyzing while server (Claude) processes
    xhr.upload.addEventListener("load", () => onPhaseChange("analyzing"));

    xhr.addEventListener("load", () => {
      let json: unknown;
      try {
        json = JSON.parse(xhr.responseText);
      } catch {
        reject(new ApiError(xhr.status, "Ungültige Serverantwort"));
        return;
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(json as T);
      } else {
        const msg = (json as { error?: { message?: string } })?.error?.message
          ?? "Ein Fehler ist aufgetreten";
        reject(new ApiError(xhr.status, msg));
      }
    });

    xhr.addEventListener("error", () =>
      reject(new ApiError(0, "Netzwerkfehler beim Scan")),
    );

    onPhaseChange("uploading");
    xhr.send(formData);
  });
}
