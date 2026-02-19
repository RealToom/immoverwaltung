import { describe, it, expect, vi } from "vitest";
import request from "supertest";

// Prisma mocken damit kein echter DB-Aufruf stattfindet
vi.mock("../lib/prisma.js", () => ({
  prisma: {
    $queryRaw: vi.fn().mockResolvedValue([{ "?column?": 1 }]),
  },
}));

describe("GET /health", () => {
  it("antwortet mit 200 und status ok wenn DB erreichbar", async () => {
    const { app } = await import("../app.js");
    const res = await request(app).get("/health");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.db).toBe("ok");
    expect(res.body).toHaveProperty("timestamp");
  });

  it("antwortet mit 503 wenn DB nicht erreichbar", async () => {
    const { prisma } = await import("../lib/prisma.js");
    vi.mocked(prisma.$queryRaw).mockRejectedValueOnce(new Error("DB down"));

    const { app } = await import("../app.js");
    const res = await request(app).get("/health");

    expect(res.status).toBe(503);
    expect(res.body.status).toBe("error");
    expect(res.body.db).toBe("unavailable");
  });
});

describe("Unbekannte Route", () => {
  it("gibt keinen 500 Fehler aus", async () => {
    const { app } = await import("../app.js");
    const res = await request(app).get("/api/nicht-vorhanden");
    expect(res.status).not.toBe(500);
  });
});
