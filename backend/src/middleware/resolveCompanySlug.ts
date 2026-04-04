import type { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma.js";
import { NotFoundError } from "../lib/errors.js";

/** Resolves :slug param → req.companyId. Used on all /api/tenant/:slug/* routes. */
export async function resolveCompanySlug(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const slug = req.params.slug as string;

  const company = await prisma.company.findUnique({
    where: { slug },
    select: { id: true },
  });

  if (!company) {
    next(new NotFoundError("Hausverwaltung", slug));
    return;
  }

  req.companyId = company.id;
  next();
}
