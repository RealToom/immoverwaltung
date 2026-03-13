import { describe, it, expect, vi, afterEach } from "vitest";
import request from "supertest";

// Mocking Prisma robust for dynamic imports
vi.mock("../lib/prisma.js", () => {
  let isDown = false;
  return {
    prisma: {
      $queryRaw: vi.fn().mockImplementation(() => {
        if (isDown) return Promise.reject(new Error("DB DOWN"));
        return Promise.resolve([{ "?column?": 1 }]);
      }),
    },
    __setDbDown: (val: boolean) => { isDown = val; }
  };
});

describe("GET /health", () => {
  afterEach(async () => {
    const mod = await import("../lib/prisma.js") as any;
    mod.__setDbDown(false);
  });

  it("antwortet mit 200 und status ok wenn DB erreichbar", async () => {
    const { app } = await import("../app.js");
    const res = await request(app).get("/health");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.db).toBe("ok");
  });

  it("antwortet mit 503 wenn DB nicht erreichbar", async () => {
    const mod = await import("../lib/prisma.js") as any;
    mod.__setDbDown(true);

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
