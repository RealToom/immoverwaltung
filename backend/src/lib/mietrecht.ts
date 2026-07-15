/**
 * Zentrale mietrechtliche Konstanten und reine Hilfsfunktionen (deutsches Recht).
 *
 * Keine DB-/IO-Zugriffe — voll unit-testbar. Jede Konstante nennt ihre
 * Rechtsgrundlage. Hinweis: ersetzt keine Rechtsberatung; pflegebedürftige Werte
 * (v. a. der Basiszinssatz) sind markiert.
 */

const round2 = (v: number) => Math.round(v * 100) / 100;

/* ── Kaution (§ 551 BGB) ─────────────────────────────────────────────── */

/** Die Mietsicherheit darf höchstens das Dreifache der Nettokaltmiete betragen (§ 551 Abs. 1 BGB). */
export const MAX_KAUTION_MONATE = 3;

/** Maximal zulässige Kaution für eine gegebene Nettokaltmiete. */
export function maxKaution(nettokaltmiete: number): number {
  return round2(Math.max(0, nettokaltmiete) * MAX_KAUTION_MONATE);
}

/** true, wenn die Kaution die Höchstgrenze des § 551 BGB einhält (mit Rundungstoleranz). */
export function isKautionValid(deposit: number, nettokaltmiete: number): boolean {
  return deposit <= maxKaution(nettokaltmiete) + 0.005;
}

/* ── Kündigungsfristen (§ 573c BGB) ──────────────────────────────────── */

/** Ordentliche Kündigungsfrist des Mieters: stets 3 Monate (§ 573c Abs. 1 S. 1 BGB). */
export const TENANT_NOTICE_PERIOD_MONTHS = 3;

/**
 * Gesetzliche Kündigungsfrist des **Vermieters** (§ 573c Abs. 1 S. 2 BGB),
 * gestaffelt nach der Dauer der Überlassung: 3 Monate, nach 5 Jahren 6 Monate,
 * nach 8 Jahren 9 Monate.
 */
export function landlordNoticePeriodMonths(tenancyStart: Date, reference: Date = new Date()): number {
  const years = fullYearsBetween(tenancyStart, reference);
  if (years >= 8) return 9;
  if (years >= 5) return 6;
  return 3;
}

function fullYearsBetween(from: Date, to: Date): number {
  let years = to.getFullYear() - from.getFullYear();
  const anniversaryReached =
    to.getMonth() > from.getMonth() ||
    (to.getMonth() === from.getMonth() && to.getDate() >= from.getDate());
  if (!anniversaryReached) years -= 1;
  return Math.max(0, years);
}

/* ── Staffelmiete (§ 557a BGB) ───────────────────────────────────────── */

/** Zwischen zwei Staffeln muss die Miete mindestens 1 Jahr unverändert bleiben (§ 557a Abs. 2 S. 1 BGB). */
export const STAFFELMIETE_MIN_INTERVAL_MONTHS = 12;

/**
 * Prüft, ob aufeinanderfolgende Staffel-Termine den 12-Monats-Mindestabstand
 * einhalten. Wird erst wirksam, sobald einzelne Staffelstufen datenseitig
 * modelliert sind (derzeit trägt der Vertrag nur den Typ `STAFFEL`).
 */
export function staffelIntervalsValid(stepDates: Date[]): boolean {
  const sorted = [...stepDates].sort((a, b) => a.getTime() - b.getTime());
  for (let i = 1; i < sorted.length; i++) {
    if (monthsBetween(sorted[i - 1], sorted[i]) < STAFFELMIETE_MIN_INTERVAL_MONTHS) return false;
  }
  return true;
}

function monthsBetween(from: Date, to: Date): number {
  let months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  if (to.getDate() < from.getDate()) months -= 1;
  return months;
}

/* ── Verzugszinsen (§ 288 BGB) ───────────────────────────────────────── */

/**
 * Basiszinssatz nach § 247 BGB — halbjährlich (1.1./1.7.) von der Deutschen
 * Bundesbank festgesetzt.
 *
 * ⚠️ PFLEGEBEDÜRFTIG: halbjährlich aktualisieren. Zuletzt bekannt: 1,27 %
 * (Stand 01.07.2025). Perspektivisch besser in die Firmen-Einstellungen
 * auslagern, damit er ohne Deploy gepflegt werden kann.
 */
export const BASISZINSSATZ_PA = 0.0127;

/** Verzugszinsaufschlag für Verbraucher: 5 Prozentpunkte (§ 288 Abs. 1 S. 2 BGB). */
export const VERZUGSZINS_AUFSCHLAG_VERBRAUCHER_PP = 5;

/** Verzugszinssatz p. a. für Verbraucher (Mieter) = Basiszinssatz + 5 %-Punkte. */
export function verzugszinssatzPa(basiszinssatzPa: number = BASISZINSSATZ_PA): number {
  return basiszinssatzPa + VERZUGSZINS_AUFSCHLAG_VERBRAUCHER_PP / 100;
}

/**
 * Verzugszinsen (§ 288 BGB) für einen offenen Betrag, taggenau (actual/365).
 * Ein nicht-positiver Zeitraum oder Betrag ergibt 0.
 */
export function computeVerzugszinsen(
  principal: number,
  fromDate: Date,
  toDate: Date,
  satzPa: number = verzugszinssatzPa(),
): number {
  const days = Math.floor((toDate.getTime() - fromDate.getTime()) / 86_400_000);
  if (days <= 0 || principal <= 0) return 0;
  return round2((principal * satzPa * days) / 365);
}
