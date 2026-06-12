import { describe, it, expect } from "vitest";
import { expandRecurrence, nthOccurrence } from "../lib/recurrence.js";

const d = (s: string) => new Date(s);

describe("nthOccurrence", () => {
  it("TAEGLICH mit Intervall 1", () => {
    expect(nthOccurrence(d("2026-06-01T10:00:00Z"), "TAEGLICH", 1, 3)).toEqual(d("2026-06-04T10:00:00Z"));
  });

  it("WOECHENTLICH mit Intervall 2", () => {
    expect(nthOccurrence(d("2026-06-01T10:00:00Z"), "WOECHENTLICH", 2, 2)).toEqual(d("2026-06-29T10:00:00Z"));
  });

  it("MONATLICH klemmt Monatsende (31.01. -> 28.02. -> 31.03.)", () => {
    const start = d("2026-01-31T09:00:00Z");
    expect(nthOccurrence(start, "MONATLICH", 1, 1).getUTCDate()).toBe(28);
    expect(nthOccurrence(start, "MONATLICH", 1, 2).getUTCDate()).toBe(31);
  });

  it("JAEHRLICH klemmt 29.02. in Nicht-Schaltjahren", () => {
    const start = d("2024-02-29T09:00:00Z");
    expect(nthOccurrence(start, "JAEHRLICH", 1, 1).getUTCDate()).toBe(28);
    expect(nthOccurrence(start, "JAEHRLICH", 1, 4).getUTCDate()).toBe(29); // 2028 wieder Schaltjahr
  });
});

describe("expandRecurrence", () => {
  const weekly = {
    start: d("2026-06-01T10:00:00Z"),
    recurrenceFreq: "WOECHENTLICH" as const,
    recurrenceInterval: 1,
    recurrenceUntil: null,
  };

  it("liefert Occurrences im Fenster", () => {
    const occs = expandRecurrence(weekly, d("2026-06-01T00:00:00Z"), d("2026-06-30T23:59:59Z"));
    expect(occs).toHaveLength(5); // 01., 08., 15., 22., 29.
    expect(occs[0]).toEqual(d("2026-06-01T10:00:00Z"));
    expect(occs[4]).toEqual(d("2026-06-29T10:00:00Z"));
  });

  it("schneidet das Fenster korrekt (from mitten in der Serie)", () => {
    const occs = expandRecurrence(weekly, d("2026-06-10T00:00:00Z"), d("2026-06-30T23:59:59Z"));
    expect(occs.map((o) => o.getUTCDate())).toEqual([15, 22, 29]);
  });

  it("respektiert recurrenceUntil (inklusiv)", () => {
    const e = { ...weekly, recurrenceUntil: d("2026-06-15T10:00:00Z") };
    const occs = expandRecurrence(e, d("2026-06-01T00:00:00Z"), d("2026-12-31T00:00:00Z"));
    expect(occs).toHaveLength(3); // 01., 08., 15.
  });

  it("kappt am 2-Jahres-Horizont", () => {
    const occs = expandRecurrence(weekly, d("2026-06-01T00:00:00Z"), d("2099-01-01T00:00:00Z"));
    const last = occs[occs.length - 1];
    expect(last.getTime()).toBeLessThanOrEqual(d("2028-06-02T10:00:00Z").getTime());
  });

  it("ohne recurrenceFreq: nur der Start selbst, wenn im Fenster", () => {
    const single = { ...weekly, recurrenceFreq: null };
    expect(expandRecurrence(single, d("2026-06-01T00:00:00Z"), d("2026-06-02T00:00:00Z"))).toHaveLength(1);
    expect(expandRecurrence(single, d("2026-07-01T00:00:00Z"), d("2026-07-02T00:00:00Z"))).toHaveLength(0);
  });
});
