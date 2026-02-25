import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";
import { AppError } from "../lib/errors.js";

const NORDIGEN_BASE = "https://bankaccountdata.gocardless.com/api/v2";

// ── In-memory token cache ────────────────────────────────────────────────────
let tokenCache: { token: string; expiresAt: number } | null = null;
let tokenInFlight: Promise<string> | null = null;

export async function getAccessToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt) {
    return tokenCache.token;
  }
  if (tokenInFlight) return tokenInFlight;

  const secretId = env.NORDIGEN_SECRET_ID;
  const secretKey = env.NORDIGEN_SECRET_KEY;
  if (!secretId || !secretKey) {
    throw new AppError(503, "Nordigen-Zugangsdaten nicht konfiguriert (NORDIGEN_SECRET_ID / NORDIGEN_SECRET_KEY)");
  }

  tokenInFlight = (async () => {
    try {
      const res = await fetch(`${NORDIGEN_BASE}/token/new/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ secret_id: secretId, secret_key: secretKey }),
      });

      if (!res.ok) {
        tokenCache = null;
        logger.error({ status: res.status }, "[NORDIGEN] Token-Anfrage fehlgeschlagen");
        throw new AppError(502, "Nordigen-Authentifizierung fehlgeschlagen");
      }

      const data = (await res.json()) as { access: string; access_expires: number };
      const expires = typeof data.access_expires === "number" && data.access_expires > 0
        ? data.access_expires
        : 86400;
      tokenCache = { token: data.access, expiresAt: Date.now() + (expires - 300) * 1000 };

      logger.info("[NORDIGEN] Neues Access-Token abgerufen");
      return tokenCache.token;
    } finally {
      tokenInFlight = null;
    }
  })();
  return tokenInFlight;
}

/** @internal — only for use in tests */
export function resetTokenCacheForTesting(): void {
  tokenCache = null;
  tokenInFlight = null;
}

// ── Helper: authenticated fetch ──────────────────────────────────────────────
async function nordigenFetch(path: string, options: RequestInit = {}): Promise<unknown> {
  const token = await getAccessToken();
  const res = await fetch(`${NORDIGEN_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      ...((options.headers as Record<string, string>) ?? {}),
    },
  });

  if (!res.ok) {
    logger.error({ status: res.status, path }, "[NORDIGEN] API-Fehler");
    throw new AppError(502, `Nordigen API-Fehler: HTTP ${res.status}`);
  }

  return res.json();
}

// ── IBAN masking ─────────────────────────────────────────────────────────────

export function maskIban(iban: string): string {
  if (iban.length < 8) return "****";
  return iban.slice(0, 4) + "****" + iban.slice(-4);
}

// ── Public API ───────────────────────────────────────────────────────────────

export interface NordigenInstitution {
  id: string;
  name: string;
  bic: string;
  transaction_total_days: string;
  logo: string;
}

export async function listInstitutions(countryCode: string): Promise<NordigenInstitution[]> {
  const data = await nordigenFetch(`/institutions/?country=${encodeURIComponent(countryCode)}`);
  return data as NordigenInstitution[];
}

export interface NordigenRequisition {
  id: string;
  link: string;
  status: string;
  accounts: string[];
}

export async function createRequisition(
  institutionId: string,
  redirectUrl: string,
  reference: string
): Promise<{ id: string; link: string }> {
  const data = await nordigenFetch("/requisitions/", {
    method: "POST",
    body: JSON.stringify({
      redirect: redirectUrl,
      institution_id: institutionId,
      reference,
    }),
  });
  return data as { id: string; link: string };
}

export async function getRequisitionStatus(requisitionId: string): Promise<NordigenRequisition> {
  const data = await nordigenFetch(`/requisitions/${requisitionId}/`);
  return data as NordigenRequisition;
}

export interface NordigenAccountDetails {
  iban: string;
  currency: string;
  name?: string;
}

export async function getAccountDetails(accountId: string): Promise<NordigenAccountDetails> {
  const data = (await nordigenFetch(`/accounts/${accountId}/details/`)) as { account: NordigenAccountDetails };
  return data.account;
}

export interface NordigenTransaction {
  transactionId: string;
  bookingDate: string;
  valueDate?: string;
  transactionAmount: { amount: string; currency: string };
  remittanceInformationUnstructured?: string;
  remittanceInformationStructured?: string;
  creditorName?: string;
  creditorAccount?: { iban?: string };
  debtorName?: string;
  debtorAccount?: { iban?: string };
}

export async function getTransactions(
  accountId: string,
  dateFrom: string,
  dateTo: string
): Promise<NordigenTransaction[]> {
  const data = (await nordigenFetch(
    `/accounts/${accountId}/transactions/?date_from=${dateFrom}&date_to=${dateTo}`
  )) as { transactions: { booked: NordigenTransaction[] } };
  return data.transactions.booked ?? [];
}
