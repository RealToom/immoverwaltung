// ─── Property Status ─────────────────────────────────────────
const propertyStatusMap: Record<string, string> = {
  AKTIV: "aktiv",
  WARTUNG: "wartung",
};
const propertyStatusReverse: Record<string, string> = {
  aktiv: "AKTIV",
  wartung: "WARTUNG",
};
export const mapPropertyStatus = (s: string) => propertyStatusMap[s] ?? s;
export const toBackendPropertyStatus = (s: string) => propertyStatusReverse[s] ?? s;

// ─── Unit Status ─────────────────────────────────────────────
const unitStatusMap: Record<string, string> = {
  VERMIETET: "vermietet",
  FREI: "frei",
  WARTUNG: "wartung",
};
export const mapUnitStatus = (s: string) => unitStatusMap[s] ?? s;

// ─── Unit Type ──────────────────────────────────────────────
const unitTypeMap: Record<string, string> = {
  WOHNUNG: "Wohnung",
  GARAGE: "Garage",
  STELLPLATZ: "Stellplatz",
};
const unitTypeReverse: Record<string, string> = {
  Wohnung: "WOHNUNG",
  Garage: "GARAGE",
  Stellplatz: "STELLPLATZ",
};
export const mapUnitType = (s: string) => unitTypeMap[s] ?? s;
export const toBackendUnitType = (s: string) => unitTypeReverse[s] ?? s;

// ─── Contract Type ───────────────────────────────────────────
const contractTypeMap: Record<string, string> = {
  WOHNRAUM: "Wohnraum",
  GEWERBE: "Gewerbe",
  STAFFEL: "Staffel",
  INDEX: "Index",
};
const contractTypeReverse: Record<string, string> = {
  Wohnraum: "WOHNRAUM",
  Gewerbe: "GEWERBE",
  Staffel: "STAFFEL",
  Index: "INDEX",
};
export const mapContractType = (s: string) => contractTypeMap[s] ?? s;
export const toBackendContractType = (s: string) => contractTypeReverse[s] ?? s;

// ─── Contract Status ─────────────────────────────────────────
const contractStatusMap: Record<string, string> = {
  AKTIV: "aktiv",
  GEKUENDIGT: "gekuendigt",
  AUSLAUFEND: "auslaufend",
  ENTWURF: "entwurf",
};
const contractStatusReverse: Record<string, string> = {
  aktiv: "AKTIV",
  gekuendigt: "GEKUENDIGT",
  "gekündigt": "GEKUENDIGT",
  auslaufend: "AUSLAUFEND",
  entwurf: "ENTWURF",
};
export const mapContractStatus = (s: string) => contractStatusMap[s] ?? s;
export const toBackendContractStatus = (s: string) => contractStatusReverse[s] ?? s;

// ─── Reminder Type ───────────────────────────────────────────
const reminderTypeMap: Record<string, string> = {
  KUENDIGUNGSFRIST: "Kündigungsfrist",
  VERTRAGSVERLAENGERUNG: "Vertragsverlängerung",
  MIETANPASSUNG: "Mietanpassung",
  KAUTIONSRUECKZAHLUNG: "Kautionsrückzahlung",
};
export const mapReminderType = (s: string | null) => (s ? reminderTypeMap[s] ?? s : null);

// ─── Maintenance Category ────────────────────────────────────
const maintenanceCategoryMap: Record<string, string> = {
  SANITAER: "Sanitär",
  ELEKTRIK: "Elektrik",
  HEIZUNG: "Heizung",
  GEBAEUDE: "Gebäude",
  AUSSENANLAGE: "Außenanlage",
  SONSTIGES: "Sonstiges",
};
const maintenanceCategoryReverse: Record<string, string> = {
  "Sanitär": "SANITAER",
  Elektrik: "ELEKTRIK",
  Heizung: "HEIZUNG",
  "Gebäude": "GEBAEUDE",
  "Außenanlage": "AUSSENANLAGE",
  Sonstiges: "SONSTIGES",
};
export const mapMaintenanceCategory = (s: string) => maintenanceCategoryMap[s] ?? s;
export const toBackendMaintenanceCategory = (s: string) => maintenanceCategoryReverse[s] ?? s;

// ─── Maintenance Priority ────────────────────────────────────
const maintenancePriorityMap: Record<string, string> = {
  NIEDRIG: "niedrig",
  MITTEL: "mittel",
  HOCH: "hoch",
  DRINGEND: "dringend",
};
const maintenancePriorityReverse: Record<string, string> = {
  niedrig: "NIEDRIG",
  mittel: "MITTEL",
  hoch: "HOCH",
  dringend: "DRINGEND",
};
export const mapMaintenancePriority = (s: string) => maintenancePriorityMap[s] ?? s;
export const toBackendMaintenancePriority = (s: string) => maintenancePriorityReverse[s] ?? s;

// ─── Maintenance Status ──────────────────────────────────────
const maintenanceStatusMap: Record<string, string> = {
  OFFEN: "offen",
  IN_BEARBEITUNG: "in_bearbeitung",
  WARTEND: "wartend",
  ERLEDIGT: "erledigt",
};
const maintenanceStatusReverse: Record<string, string> = {
  offen: "OFFEN",
  in_bearbeitung: "IN_BEARBEITUNG",
  wartend: "WARTEND",
  erledigt: "ERLEDIGT",
};
export const mapMaintenanceStatus = (s: string) => maintenanceStatusMap[s] ?? s;
export const toBackendMaintenanceStatus = (s: string) => maintenanceStatusReverse[s] ?? s;

// ─── Date Formatting ─────────────────────────────────────────
export function formatDate(isoDate: string | null | undefined): string {
  if (!isoDate) return "–";
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function parseDate(germanDate: string): string {
  // DD.MM.YYYY -> ISO
  const parts = germanDate.split(".");
  if (parts.length !== 3) return germanDate;
  const [day, month, year] = parts;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T00:00:00.000Z`;
}

// ─── Currency Formatting ─────────────────────────────────────
export function formatCurrency(amount: number): string {
  return `€ ${amount.toLocaleString("de-DE")}`;
}

// ─── Month Abbreviation (for Charts) ────────────────────────
const MONTH_ABBR = ["Jan", "Feb", "Mrz", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

export function formatChartMonth(yearMonth: string): string {
  // "YYYY-MM" -> "Jan", "Feb", etc.
  const month = parseInt(yearMonth.split("-")[1], 10);
  return MONTH_ABBR[(month - 1) % 12] ?? yearMonth;
}

// ─── Transaction Type ───────────────────────────────────────
const transactionTypeMap: Record<string, string> = {
  EINNAHME: "Einnahme",
  AUSGABE: "Ausgabe",
};
export const mapTransactionType = (s: string) => transactionTypeMap[s] ?? s;
export const toBackendTransactionType = (s: string) =>
  s === "einnahme" ? "EINNAHME" : s === "ausgabe" ? "AUSGABE" : s.toUpperCase();
