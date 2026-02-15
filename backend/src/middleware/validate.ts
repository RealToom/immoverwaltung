import type { Request, Response, NextFunction } from "express";
import type { ZodSchema } from "zod";

interface ValidationSchemas {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

export function validate(schemas: ValidationSchemas) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (schemas.body) {
        req.body = schemas.body.parse(req.body);
      }
      if (schemas.query) {
        // Express 5: req.query is read-only, just validate
        schemas.query.parse(req.query);
      }
      if (schemas.params) {
        // Express 5: req.params is read-only, just validate
        schemas.params.parse(req.params);
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
