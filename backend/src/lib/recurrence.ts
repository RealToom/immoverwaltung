export type RecurrenceFreq = "TAEGLICH" | "WOECHENTLICH" | "MONATLICH" | "JAEHRLICH";

export interface RecurringEventLike {
  start: Date;
  recurrenceFreq: RecurrenceFreq | null;
  recurrenceInterval: number;
  recurrenceUntil: Date | null;
}

const MAX_OCCURRENCES = 500;
const MAX_HORIZON_MS = 2 * 366 * 24 * 60 * 60 * 1000; // ~2 Jahre

/**
 * n-te Occurrence ab start (n=0 -> start selbst). Immer vom Original-Start aus
 * gerechnet (kein kumulativer Drift). Monats-/Jahresende wird geklemmt:
 * 31.01. + 1 Monat = 28.02., aber 31.01. + 2 Monate = 31.03.
 * Rechnet in UTC, damit das Verhalten unabhängig von der Server-Zeitzone ist.
 */
export function nthOccurrence(start: Date, freq: RecurrenceFreq, interval: number, n: number): Date {
  const steps = n * Math.max(1, interval);
  const d = new Date(start);
  switch (freq) {
    case "TAEGLICH":
      d.setUTCDate(d.getUTCDate() + steps);
      return d;
    case "WOECHENTLICH":
      d.setUTCDate(d.getUTCDate() + 7 * steps);
      return d;
    case "MONATLICH": {
      d.setUTCDate(1);
      d.setUTCMonth(start.getUTCMonth() + steps);
      const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
      d.setUTCDate(Math.min(start.getUTCDate(), lastDay));
      return d;
    }
    case "JAEHRLICH": {
      d.setUTCDate(1);
      d.setUTCFullYear(start.getUTCFullYear() + steps);
      d.setUTCMonth(start.getUTCMonth());
      const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
      d.setUTCDate(Math.min(start.getUTCDate(), lastDay));
      return d;
    }
  }
}

/**
 * Liefert alle Occurrence-Starts eines Events im Fenster [from, to].
 * recurrenceUntil ist inklusiv. Harter Horizont: 2 Jahre ab start bzw. 500 Instanzen.
 */
export function expandRecurrence(event: RecurringEventLike, from: Date, to: Date): Date[] {
  if (!event.recurrenceFreq) {
    return event.start >= from && event.start <= to ? [new Date(event.start)] : [];
  }
  const horizon = new Date(event.start.getTime() + MAX_HORIZON_MS);
  const until = event.recurrenceUntil && event.recurrenceUntil < horizon ? event.recurrenceUntil : horizon;
  const result: Date[] = [];
  for (let n = 0; n < MAX_OCCURRENCES; n++) {
    const occ = nthOccurrence(event.start, event.recurrenceFreq, event.recurrenceInterval, n);
    if (occ > until || occ > to) break;
    if (occ >= from) result.push(occ);
  }
  return result;
}
