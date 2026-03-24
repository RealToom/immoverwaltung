import { useMutation } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";

async function mfaFetch<T>(path: string, mfaToken: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-MFA-Token": mfaToken,
  };
  const res = await fetch(`/api${path}`, {
    method: "POST",
    headers,
    body: body ? JSON.stringify(body) : undefined,
    credentials: "include",
  });
  const json = await res.json();
  if (!res.ok) throw new ApiError(res.status, json.error?.message || "Fehler", json.error);
  return json as T;
}

// POST /api/auth/2fa/setup — sends X-MFA-Token header (no auth token yet)
export function useSetup2FA(setupToken: string) {
  return useMutation({
    mutationFn: () =>
      mfaFetch<{ data: { qrCodeDataUrl: string; secret: string } }>("/auth/2fa/setup", setupToken)
        .then((r) => r.data),
  });
}

// POST /api/auth/2fa/verify-setup — sends X-MFA-Token header
export function useVerifySetup(setupToken: string) {
  return useMutation({
    mutationFn: (code: string) =>
      mfaFetch<{ data: { backupCodes: string[]; accessToken: string } }>(
        "/auth/2fa/verify-setup",
        setupToken,
        { code },
      ).then((r) => r.data),
  });
}

// POST /api/auth/verify-2fa — sends X-MFA-Token header
export function useVerify2FA(mfaToken: string) {
  return useMutation({
    mutationFn: (code: string) =>
      mfaFetch<{ data: { accessToken: string } }>("/auth/verify-2fa", mfaToken, { code })
        .then((r) => r.data),
  });
}

// POST /api/auth/2fa/regenerate-backup-codes — uses normal Bearer auth via api()
export function useRegenerateBackupCodes() {
  return useMutation({
    mutationFn: (code: string) =>
      api<{ data: { backupCodes: string[] } }>("/auth/2fa/regenerate-backup-codes", {
        method: "POST",
        body: { code },
      }).then((r) => r.data),
  });
}
