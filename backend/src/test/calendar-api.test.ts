import { describe, it, expect, vi, beforeEach } from "vitest";
import { createCalendarEventSchema, updateCalendarEventSchema } from "../schemas/calendar.schema.js";

const { mockEventFindMany, mockEventCreate, mockPropFindFirst, mockTenantFindFirst } = vi.hoisted(() => ({
  mockEventFindMany: vi.fn(),
  mockEventCreate: vi.fn(),
  mockPropFindFirst: vi.fn(),
  mockTenantFindFirst: vi.fn(),
}));

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    calendarEvent: { findMany: mockEventFindMany, create: mockEventCreate, findFirst: vi.fn(), update: vi.fn(), delete: vi.fn() },
    contract: { findMany: vi.fn().mockResolvedValue([]) },
    maintenanceTicket: { findMany: vi.fn().mockResolvedValue([]) },
    rentPayment: { findMany: vi.fn().mockResolvedValue([]) },
    property: { findFirst: mockPropFindFirst },
    tenant: { findFirst: mockTenantFindFirst },
  },
}));

import { listEvents, createEvent } from "../services/calendar.service.js";

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

describe("listEvents — Recurrence-Expansion", () => {
  beforeEach(() => vi.clearAllMocks());

  it("expandiert wiederkehrende Events zu virtuellen Instanzen mit seriesId", async () => {
    const recurring = {
      id: 9, title: "Begehung", start: new Date("2026-06-01T10:00:00Z"), end: new Date("2026-06-01T11:00:00Z"),
      allDay: false, type: "MANUELL", companyId: 1,
      recurrenceFreq: "WOECHENTLICH", recurrenceInterval: 1, recurrenceUntil: null,
    };
    // 1. Aufruf: einmalige Events, 2. Aufruf: wiederkehrende
    mockEventFindMany.mockResolvedValueOnce([]).mockResolvedValueOnce([recurring]);

    const events = await listEvents(1, new Date("2026-06-01T00:00:00Z"), new Date("2026-06-15T23:59:59Z"));
    const instances = events.filter((e) => (e as { seriesId?: number }).seriesId === 9);
    expect(instances).toHaveLength(3); // 01., 08., 15.
    expect((instances[0] as { id: string }).id).toBe("evt-9-2026-06-01");
    // Dauer bleibt 1h
    const first = instances[0] as { start: Date; end: Date };
    expect(first.end.getTime() - first.start.getTime()).toBe(60 * 60 * 1000);
  });
});

describe("createEvent — Ownership-Validierung", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lehnt propertyId fremder Firma mit 404 ab", async () => {
    mockPropFindFirst.mockResolvedValueOnce(null);
    await expect(
      createEvent(1, 1, { title: "X", start: new Date(), propertyId: 99 })
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(mockEventCreate).not.toHaveBeenCalled();
  });

  it("legt Event mit gültiger propertyId an", async () => {
    mockPropFindFirst.mockResolvedValueOnce({ id: 5 });
    mockEventCreate.mockResolvedValueOnce({ id: 1 });
    await createEvent(1, 1, { title: "X", start: new Date(), propertyId: 5 });
    expect(mockPropFindFirst).toHaveBeenCalledWith({ where: { id: 5, companyId: 1 }, select: { id: true } });
    expect(mockEventCreate).toHaveBeenCalled();
  });
});
