import { prisma } from "./prisma.js";

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Returns a company slug that is unique: appends -2, -3, ... when the base
 * slug is already taken (two companies may share the same name).
 */
export async function uniqueCompanySlug(companyName: string): Promise<string> {
  const base = slugify(companyName) || "firma";
  let slug = base;
  for (let i = 2; ; i++) {
    const existing = await prisma.company.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!existing) return slug;
    slug = `${base}-${i}`;
  }
}
