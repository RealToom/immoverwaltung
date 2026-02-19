import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ApiError } from "../lib/api";

// fetch global mocken
const fetchMock = vi.fn();
global.fetch = fetchMock;

beforeEach(() => {
  fetchMock.mockReset();
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ApiError", () => {
  it("ist eine Error-Instanz mit status und message", () => {
    const err = new ApiError(404, "Nicht gefunden");
    expect(err).toBeInstanceOf(Error);
    expect(err.status).toBe(404);
    expect(err.message).toBe("Nicht gefunden");
    expect(err.name).toBe("ApiError");
  });

  it("speichert details optional", () => {
    const err = new ApiError(400, "Validierungsfehler", { email: ["pflichtfeld"] });
    expect(err.details).toEqual({ email: ["pflichtfeld"] });
  });
});

describe("api() - Basis", () => {
  it("wirft ApiError bei 4xx-Antwort", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ error: { message: "Nicht gefunden" } }),
    });

    const { api } = await import("../lib/api");
    await expect(api("/tenants/99")).rejects.toThrow(ApiError);
  });

  it("gibt undefined zurueck bei 204 No Content", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 204,
      json: async () => ({}),
    });

    const { api } = await import("../lib/api");
    const result = await api("/some-resource/1", { method: "DELETE" });
    expect(result).toBeUndefined();
  });

  it("leitet bei 401 ohne Token nicht auf Login um", async () => {
    // Kein Token gesetzt -> kein Refresh-Versuch
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: "Nicht authentifiziert" } }),
    });

    const { api } = await import("../lib/api");
    await expect(api("/properties")).rejects.toThrow(ApiError);
    // window.location.href sollte nicht auf /login gesetzt worden sein
    // (da kein Token vorhanden war, kein Refresh versucht)
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
