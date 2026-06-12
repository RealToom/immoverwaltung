import { describe, it, expect } from "vitest";
import { createCalendarEventSchema, updateCalendarEventSchema } from "../schemas/calendar.schema.js";

describe("createCalendarEventSchema — neue Felder", () => {
  const base = { title: "Begehung", start: "2026-07-01T10:00:00Z" };

  it("akzeptiert Wiederholung mit Preset-Erinnerung und Verknüpfungen", () => {
    const result = createCalendarEventSchema.safeParse({
      ...base,
      recurrenceFreq: "MONATLICH",
      recurrenceInterval: 3,
      recurrenceUntil: "2027-07-01T00:00:00Z",
      reminderMinutes: 1440,
      propertyId: 5,
      tenantId: 7,
      visitorName: "Max Muster",
      visitorContact: "+49 170 1234567",
    });
    expect(result.success).toBe(true);
  });

  it("lehnt unbekannte recurrenceFreq ab", () => {
    expect(createCalendarEventSchema.safeParse({ ...base, recurrenceFreq: "STUENDLICH" }).success).toBe(false);
  });

  it("lehnt reminderMinutes außerhalb der Presets ab", () => {
    expect(createCalendarEventSchema.safeParse({ ...base, reminderMinutes: 17 }).success).toBe(false);
  });

  it("lehnt recurrenceInterval über 99 ab", () => {
    expect(createCalendarEventSchema.safeParse({ ...base, recurrenceFreq: "TAEGLICH", recurrenceInterval: 100 }).success).toBe(false);
  });

  it("update-Schema akzeptiert reminderMinutes: null (Erinnerung entfernen)", () => {
    expect(updateCalendarEventSchema.safeParse({ reminderMinutes: null }).success).toBe(true);
  });
});
