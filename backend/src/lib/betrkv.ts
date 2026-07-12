/**
 * BetrKV category metadata shared between the utility-billing service,
 * PDF rendering, and API responses.
 */

export const BETRKV_LABELS: Record<string, string> = {
  GRUNDSTEUER: "Grundsteuer",
  WASSERVERSORGUNG: "Wasserversorgung",
  ENTWAESSERUNG: "Entwässerung",
  HEIZUNG: "Heizung",
  WARMWASSER: "Warmwasser",
  AUFZUG: "Aufzug",
  STRASSENREINIGUNG_MUELL: "Straßenreinigung & Müllbeseitigung",
  GEBAEUDE_REINIGUNG: "Gebäudereinigung & Ungezieferbekämpfung",
  GARTENPFLEGE: "Gartenpflege",
  BELEUCHTUNG: "Beleuchtung",
  SCHORNSTEINREINIGUNG: "Schornsteinreinigung",
  VERSICHERUNGEN: "Sach- & Haftpflichtversicherungen",
  HAUSWART: "Hauswart",
  GEMEINSCHAFTS_ANTENNE: "Gemeinschaftsantenne / Kabel",
  WASCHRAUM: "Einrichtungen für die Wäschepflege",
  SONSTIGE_KOSTEN: "Sonstige Betriebskosten",
  OHNE_KATEGORIE: "Ohne Kategorie",
};

export const HEATING_BETRKV_CATEGORIES = ["HEIZUNG", "WARMWASSER"];

export interface TenantCategoryLine {
  category: string;
  label: string;
  /** Total cost of this category at property level (gross, absolute). */
  propertyTotal: number;
  /** This tenant's share of the category, in cents-exact euros. */
  tenantShare: number;
}

/**
 * Rounds a list of euro values to cents while preserving their exact sum
 * (largest-remainder method). `targetSum` must already be cents-exact.
 */
function roundPreservingSum(values: number[], targetSum: number): number[] {
  const floored = values.map((v) => Math.floor(v * 100));
  const targetCents = Math.round(targetSum * 100);
  let remainder = targetCents - floored.reduce((a, b) => a + b, 0);
  const byRemainder = values
    .map((v, i) => ({ i, frac: v * 100 - Math.floor(v * 100) }))
    .sort((a, b) => b.frac - a.frac);
  const result = [...floored];
  for (const { i } of byRemainder) {
    if (remainder <= 0) break;
    result[i] += 1;
    remainder -= 1;
  }
  return result.map((c) => c / 100);
}

/**
 * Builds the per-category cost breakdown for one tenant such that the lines
 * sum EXACTLY to the tenant's total amount. Heating categories are fed from
 * the (possibly consumption-based) heating amount, all other categories
 * proportionally from the remainder.
 */
export function buildTenantCategoryLines(
  transactions: { amount: number; betrkvCategory: string | null }[],
  itemAmount: number,
  heatingAmount: number
): TenantCategoryLine[] {
  const totals = new Map<string, number>();
  for (const tx of transactions) {
    const cat = tx.betrkvCategory ?? "OHNE_KATEGORIE";
    totals.set(cat, (totals.get(cat) ?? 0) + Math.abs(tx.amount));
  }

  const categories = [...totals.keys()];
  const isHeating = (c: string) => HEATING_BETRKV_CATEGORIES.includes(c);
  const heatingTotal = categories.filter(isHeating).reduce((s, c) => s + (totals.get(c) ?? 0), 0);
  const otherTotal = categories.filter((c) => !isHeating(c)).reduce((s, c) => s + (totals.get(c) ?? 0), 0);

  const itemAmountRounded = Math.round(itemAmount * 100) / 100;
  const heatingAmountRounded = heatingTotal > 0 ? Math.round(heatingAmount * 100) / 100 : 0;
  const otherAmount = Math.round((itemAmountRounded - heatingAmountRounded) * 100) / 100;

  const rawShares = categories.map((c) => {
    const total = totals.get(c) ?? 0;
    if (isHeating(c)) {
      return heatingTotal > 0 ? heatingAmountRounded * (total / heatingTotal) : 0;
    }
    return otherTotal > 0 ? otherAmount * (total / otherTotal) : 0;
  });

  // Round the heating group and the other group independently so each
  // group's lines sum to its exact sub-amount (and thus to itemAmount).
  const heatingIdx = categories.map((c, i) => (isHeating(c) ? i : -1)).filter((i) => i >= 0);
  const otherIdx = categories.map((c, i) => (!isHeating(c) ? i : -1)).filter((i) => i >= 0);
  const shares = new Array<number>(categories.length).fill(0);
  if (heatingIdx.length > 0) {
    const rounded = roundPreservingSum(heatingIdx.map((i) => rawShares[i]), heatingTotal > 0 ? heatingAmountRounded : 0);
    heatingIdx.forEach((i, k) => (shares[i] = rounded[k]));
  }
  if (otherIdx.length > 0) {
    const rounded = roundPreservingSum(otherIdx.map((i) => rawShares[i]), otherTotal > 0 ? otherAmount : 0);
    otherIdx.forEach((i, k) => (shares[i] = rounded[k]));
  }

  return categories.map((c, i) => ({
    category: c,
    label: BETRKV_LABELS[c] ?? c,
    propertyTotal: Math.round((totals.get(c) ?? 0) * 100) / 100,
    tenantShare: shares[i],
  }));
}
