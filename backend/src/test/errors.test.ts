import { describe, it, expect } from "vitest";
import {
  AppError,
  NotFoundError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  BadRequestError,
} from "../lib/errors.js";

describe("AppError", () => {
  it("speichert statusCode und message korrekt", () => {
    const err = new AppError(422, "Unprocessable");
    expect(err.statusCode).toBe(422);
    expect(err.message).toBe("Unprocessable");
    expect(err.name).toBe("AppError");
    expect(err).toBeInstanceOf(Error);
  });

  it("speichert details optional", () => {
    const err = new AppError(400, "Fehler", { field: "email" });
    expect(err.details).toEqual({ field: "email" });
  });
});

describe("NotFoundError", () => {
  it("hat Status 404 und korrekten Text", () => {
    const err = new NotFoundError("Immobilie", 42);
    expect(err.statusCode).toBe(404);
    expect(err.message).toContain("42");
    expect(err.name).toBe("NotFoundError");
    expect(err).toBeInstanceOf(AppError);
  });
});

describe("ValidationError", () => {
  it("hat Status 400", () => {
    const err = new ValidationError({ email: ["ungueltig"] });
    expect(err.statusCode).toBe(400);
    expect(err.details).toEqual({ email: ["ungueltig"] });
  });
});

describe("UnauthorizedError", () => {
  it("hat Status 401 mit Default-Message", () => {
    const err = new UnauthorizedError();
    expect(err.statusCode).toBe(401);
    expect(err.message).toBe("Nicht authentifiziert");
  });

  it("akzeptiert eigene Message", () => {
    const err = new UnauthorizedError("Token abgelaufen");
    expect(err.message).toBe("Token abgelaufen");
  });
});

describe("ForbiddenError", () => {
  it("hat Status 403", () => {
    const err = new ForbiddenError();
    expect(err.statusCode).toBe(403);
  });
});

describe("BadRequestError", () => {
  it("hat Status 400", () => {
    const err = new BadRequestError("Keine Datei");
    expect(err.statusCode).toBe(400);
    expect(err.message).toBe("Keine Datei");
  });
});
