import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";
import { AppError } from "../lib/errors.js";
import { createAuditLog } from "./audit.service.js";

// ─── Pure Helper Functions ────────────────────────────────────────────────────

/**
 * Formats a date as DDMM (DATEV Belegdatum format).
 */
export function formatDatevDate(date: Date): string {
  return (
    String(date.getDate()).padStart(2, "0") +
    String(date.getMonth() + 1).padStart(2, "0")
  );
}

/**
 * Formats a number as German decimal string with comma (absolute value).
 */
export function formatDecimalGerman(amount: number): string {
  return Math.abs(amount).toFixed(2).replace(".", ",");
}

/**
 * Builds DATEV Belegfeld 1: "TX" + 9-digit padded ID, max 12 chars.
 */
export function buildBelegfeld1(txId: number): string {
  return `TX${String(txId).padStart(9, "0")}`.slice(0, 12);
}

// ─── Settings Management ──────────────────────────────────────────────────────

export async function getOrCreateSettings(companyId: number) {
  return prisma.companyAccountingSettings.upsert({
    where: { companyId },
    create: { companyId },
    update: {},
  });
}

export async function upsertSettings(
  companyId: number,
  data: {
    beraternummer?: number | null;
    mandantennummer?: number | null;
    kontenrahmen?: "SKR03" | "SKR04";
    defaultBankAccount?: string;
    defaultIncomeAccount?: string;
    defaultExpenseAccount?: string;
    fiscalYearStart?: number;
  }
) {
  return prisma.companyAccountingSettings.upsert({
    where: { companyId },
    create: { companyId, ...data },
    update: data,
  });
}

// ─── Category Mappings ────────────────────────────────────────────────────────

export async function listMappings(companyId: number) {
  return prisma.categoryAccountMapping.findMany({
    where: { companyId },
    orderBy: { category: "asc" },
  });
}

export async function upsertMapping(
  companyId: number,
  category: string,
  accountNumber: string
) {
  return prisma.categoryAccountMapping.upsert({
    where: { companyId_category: { companyId, category } },
    create: { companyId, category, accountNumber },
    update: { accountNumber },
  });
}

// ─── Private Helpers ──────────────────────────────────────────────────────────

async function validateForExport(companyId: number) {
  const settings = await prisma.companyAccountingSettings.findUnique({
    where: { companyId },
  });

  if (!settings?.beraternummer || !settings?.mandantennummer) {
    throw new AppError(
      400,
      "DATEV-Export erfordert Beraternummer und Mandantennummer. Bitte zuerst in den Einstellungen hinterlegen."
    );
  }

  return settings;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function formatHeaderDate(date: Date): string {
  return (
    String(date.getFullYear()) +
    pad2(date.getMonth() + 1) +
    pad2(date.getDate())
  );
}

type AccountingSettings = Awaited<ReturnType<typeof validateForExport>>;

function buildHeader(
  settings: AccountingSettings,
  fromDate: Date,
  toDate: Date
): string {
  const now = new Date();
  const timestamp =
    String(now.getFullYear()) +
    pad2(now.getMonth() + 1) +
    pad2(now.getDate()) +
    pad2(now.getHours()) +
    pad2(now.getMinutes()) +
    pad2(now.getSeconds()) +
    "000";

  const wjBeginn =
    String(fromDate.getFullYear()) +
    pad2(settings.fiscalYearStart ?? 1) +
    "01";

  const fields = [
    '"EXTF"',
    "700",
    "21",
    '"Buchungsstapel"',
    "12",
    timestamp,
    '""',
    '"RE"',
    '""',
    '""',
    String(settings.beraternummer),
    String(settings.mandantennummer),
    wjBeginn,
    "4",
    formatHeaderDate(fromDate),
    formatHeaderDate(toDate),
    '"Immoverwaltung"',
    '""',
    "1",
    "0",
    "0",
    '"EUR"',
    '""',
    '""',
    '""',
    '""',
    '""',
    '""',
    '""',
    "0",
  ];

  return fields.join(";");
}

const COLUMN_HEADER =
  "Umsatz (ohne Soll/Haben-Kz);Soll/Haben-Kennzeichen;WKZ Umsatz;Kurs;Basis-Umsatz;WKZ Basis-Umsatz;Konto;Gegenkonto (ohne BU-Schlüssel);BU-Schlüssel;Belegdatum;Belegfeld 1;Belegfeld 2;Skonto;Buchungstext;Postensperre;Diverse Adressnummer;Geschäftspartnerbank;Sachverhalt;Zinssperre;Beleglink";

interface TransactionRow {
  id: number;
  date: Date;
  description: string;
  type: string;
  amount: number;
  category: string;
}

function buildDataRow(
  tx: TransactionRow,
  categoryMap: Map<string, string>,
  settings: AccountingSettings
): string {
  const amount = formatDecimalGerman(tx.amount);
  const isIncome = tx.type === "EINNAHME";
  const sh = isIncome ? "H" : "S";
  const konto =
    categoryMap.get(tx.category) ??
    (isIncome ? settings.defaultIncomeAccount : settings.defaultExpenseAccount);
  const gegenkonto = settings.defaultBankAccount;
  const belegdatum = formatDatevDate(tx.date);
  const belegfeld1 = buildBelegfeld1(tx.id);
  // Strip newlines, carriage returns, and CSV formula-injection prefixes (=, +, -, @)
  // to prevent spreadsheet formula injection when the CSV is opened in Excel/LibreOffice.
  const rawBuchungstext = tx.description
    .slice(0, 60)
    .replace(/[\r\n]/g, " ")
    .replace(/;/g, " ");
  const buchungstext = /^[=+\-@]/.test(rawBuchungstext)
    ? "'" + rawBuchungstext
    : rawBuchungstext;

  const fields = [
    amount,      // Umsatz (ohne Soll/Haben-Kz)
    sh,          // Soll/Haben-Kennzeichen
    "",          // WKZ Umsatz
    "",          // Kurs
    "",          // Basis-Umsatz
    "",          // WKZ Basis-Umsatz
    konto,       // Konto
    gegenkonto,  // Gegenkonto (ohne BU-Schlüssel)
    "",          // BU-Schlüssel
    belegdatum,  // Belegdatum
    belegfeld1,  // Belegfeld 1
    "",          // Belegfeld 2
    "",          // Skonto
    buchungstext,// Buchungstext
    "",          // Postensperre
    "",          // Diverse Adressnummer
    "",          // Geschäftspartnerbank
    "",          // Sachverhalt
    "",          // Zinssperre
    "",          // Beleglink
  ];

  return fields.join(";");
}

// ─── Public Export Function ───────────────────────────────────────────────────

/**
 * Generates a DATEV Buchungsstapel CSV export for the given date range.
 * Returns { filename, buffer } for the controller to stream as a download.
 */
export async function generateExport(
  companyId: number,
  fromDate: Date,
  toDate: Date,
  userId?: number
): Promise<{ filename: string; buffer: Buffer }> {
  const settings = await validateForExport(companyId);

  const transactions = await prisma.transaction.findMany({
    where: {
      companyId,
      date: { gte: fromDate, lte: toDate },
    },
    orderBy: { date: "asc" },
  });

  if (transactions.length === 0) {
    throw new AppError(404, "Keine Transaktionen im gewählten Zeitraum gefunden");
  }

  const mappings = await listMappings(companyId);
  const categoryMap = new Map(mappings.map((m) => [m.category, m.accountNumber]));

  const rows = [
    buildHeader(settings, fromDate, toDate),
    COLUMN_HEADER,
    ...transactions.map((tx) => buildDataRow(tx, categoryMap, settings)),
  ];

  const csv = "\uFEFF" + rows.join("\r\n") + "\r\n";
  const buffer = Buffer.from(csv, "utf8");

  const filename =
    "DATEV_Export_" +
    fromDate.toISOString().slice(0, 10) +
    "_" +
    toDate.toISOString().slice(0, 10) +
    ".csv";

  await prisma.datevExportLog.create({
    data: {
      companyId,
      fromDate,
      toDate,
      txCount: transactions.length,
      fileName: filename,
      createdBy: userId ?? null,
    },
  });

  await createAuditLog(
    "DATEV_EXPORT",
    { companyId, userId },
    {
      filename,
      txCount: transactions.length,
      fromDate: fromDate.toISOString(),
      toDate: toDate.toISOString(),
    }
  );

  logger.info(
    { companyId, txCount: transactions.length, filename },
    "[DATEV] Export erstellt"
  );

  return { filename, buffer };
}
