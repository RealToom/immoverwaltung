import { describe, it, expect } from "vitest";
import {
  maxKaution,
  isKautionValid,
  landlordNoticePeriodMonths,
  staffelIntervalsValid,
  verzugszinssatzPa,
  computeVerzugszinsen,
} from "../lib/mietrecht.js";

describe("Kaution (§ 551 BGB)", () => {
  it("erlaubt höchstens drei Nettokaltmieten", () => {
    expect(maxKaution(1000)).toBe(3000);
    expect(isKautionValid(3000, 1000)).toBe(true);
    expect(isKautionValid(2999.99, 1000)).toBe(true);
    expect(isKautionValid(3000.01, 1000)).toBe(false);
    expect(isKautionValid(4500, 1000)).toBe(false);
  });

  it("behandelt 0-Kaution und 0-Miete robust", () => {
    expect(isKautionValid(0, 1000)).toBe(true);
    expect(maxKaution(0)).toBe(0);
  });
});

describe("Vermieter-Kündigungsfrist (§ 573c Abs. 1 S. 2 BGB)", () => {
  const ref = new Date(2026, 0, 1);
  it("staffelt 3 / 6 / 9 Monate nach Mietdauer", () => {
    expect(landlordNoticePeriodMonths(new Date(2024, 0, 1), ref)).toBe(3); // 2 Jahre
    expect(landlordNoticePeriodMonths(new Date(2021, 0, 1), ref)).toBe(6); // genau 5 Jahre
    expect(landlordNoticePeriodMonths(new Date(2018, 0, 1), ref)).toBe(9); // genau 8 Jahre
    expect(landlordNoticePeriodMonths(new Date(2019, 5, 1), ref)).toBe(6); // 6,5 Jahre
  });

  it("gibt kurz vor dem Jahrestag noch die niedrigere Stufe", () => {
    // Start 02.01.2021, Stichtag 01.01.2026 → noch keine vollen 5 Jahre → 3 Monate
    expect(landlordNoticePeriodMonths(new Date(2021, 0, 2), ref)).toBe(3);
  });
});

describe("Staffelmiete-Mindestabstand (§ 557a Abs. 2 BGB)", () => {
  it("akzeptiert 12-Monats-Abstände (auch unsortiert)", () => {
    expect(
      staffelIntervalsValid([new Date(2026, 0, 1), new Date(2024, 0, 1), new Date(2025, 0, 1)]),
    ).toBe(true);
  });
  it("lehnt zu enge Abstände ab", () => {
    expect(staffelIntervalsValid([new Date(2024, 0, 1), new Date(2024, 6, 1)])).toBe(false);
  });
});

describe("Verzugszinsen (§ 288 BGB)", () => {
  it("berechnet 5 %-Punkte über Basiszinssatz", () => {
    expect(verzugszinssatzPa(0.0127)).toBeCloseTo(0.0627, 6);
  });

  it("rechnet taggenau (actual/365)", () => {
    // 365 Tage, 5 % p. a., 1.000 € → 50,00 €
    const from = new Date(Date.UTC(2023, 0, 1));
    const to = new Date(Date.UTC(2024, 0, 1));
    expect(computeVerzugszinsen(1000, from, to, 0.05)).toBe(50);
  });

  it("liefert 0 bei nicht-positivem Zeitraum oder Betrag", () => {
    const d = new Date(Date.UTC(2024, 0, 1));
    expect(computeVerzugszinsen(1000, d, d, 0.05)).toBe(0);
    expect(computeVerzugszinsen(1000, new Date(Date.UTC(2024, 1, 1)), d, 0.05)).toBe(0);
    expect(computeVerzugszinsen(0, d, new Date(Date.UTC(2025, 0, 1)), 0.05)).toBe(0);
  });
});
