import type { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { NotFoundError } from "../lib/errors.js";

export async function getBrandingHandler(req: Request, res: Response) {
  const slug = req.params.slug as string;

  const company = await prisma.company.findUnique({
    where: { slug },
    select: { name: true, slug: true, logoUrl: true, primaryColor: true },
  });

  if (!company) {
    throw new NotFoundError("Hausverwaltung", slug);
  }

  res.json({ data: company });
}
