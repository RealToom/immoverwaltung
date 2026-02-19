export class AppError extends Error {
  constructor(
    public statusCode: number,
    public override message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id: number | string) {
    super(404, `${resource} mit ID ${id} nicht gefunden`);
    this.name = "NotFoundError";
  }
}

export class ValidationError extends AppError {
  constructor(details: unknown) {
    super(400, "Validierungsfehler", details);
    this.name = "ValidationError";
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Nicht authentifiziert") {
    super(401, message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Keine Berechtigung") {
    super(403, message);
    this.name = "ForbiddenError";
  }
}

export class BadRequestError extends AppError {
  constructor(message = "Ungueltige Anfrage") {
    super(400, message);
    this.name = "BadRequestError";
  }
}
