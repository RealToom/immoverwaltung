import { useQuery } from "@tanstack/react-query";
import { tenantApi, tenantDownload } from "@/lib/api";

export interface TenantUtilityCategory {
  category: string;
  label: string;
  amount: number;
}

export interface TenantUtilitySummary {
  year: number;
  totalCosts: number;
  totalPrepaid: number;
  balance: number;
  isRefund: boolean;
  settlementStatus: string | null;
  settledAt: string | null;
  categories: TenantUtilityCategory[];
}

export function useTenantUtility(slug: string, year?: number) {
  return useQuery({
    queryKey: ["tenant", slug, "utility", year],
    queryFn: () => tenantApi<{ data: TenantUtilitySummary }>(slug, year ? `/utility?year=${year}` : "/utility"),
    select: (res) => res.data,
  });
}

export interface TenantReceipt {
  transactionId: number;
  description: string;
  amount: number;
  date: string;
  betrkvCategory: string | null;
  document: { id: number; name: string; fileType: string; fileSize: string } | null;
}

export interface TenantReceiptsResponse {
  year: number;
  receipts: TenantReceipt[];
}

export function useTenantReceipts(slug: string, year?: number) {
  return useQuery({
    queryKey: ["tenant", slug, "receipts", year],
    queryFn: () =>
      tenantApi<{ data: TenantReceiptsResponse }>(slug, year ? `/utility/receipts?year=${year}` : "/utility/receipts"),
    select: (res) => res.data,
  });
}

/** § 259 BGB: downloads a receipt (Beleg) for the tenant's own property/year. */
export function downloadReceipt(slug: string, documentId: number, filename: string) {
  return tenantDownload(slug, `/utility/receipts/${documentId}/download`, filename);
}
