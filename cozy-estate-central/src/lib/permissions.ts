export const PAGE_KEYS = [
  "dashboard",
  "properties",
  "tenants",
  "contracts",
  "finances",
  "maintenance",
  "calendar",
  "postfach",
  "anfragen",
  "vorlagen",
  "berichte",
  "notifications",
  "import",
] as const;

export type PageKey = typeof PAGE_KEYS[number];

export interface CustomRole {
  id: number;
  name: string;
  pages: string[];
}

export function canAccess(
  user: { role: string; customRole?: CustomRole | null },
  page: PageKey
): boolean {
  if (user.role === "ADMIN") return true;
  if (user.customRole) return user.customRole.pages.includes(page);
  // Legacy roles: VERWALTER, BUCHHALTER, READONLY all have full visibility
  return true;
}
