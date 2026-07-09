import { useQuery } from "@tanstack/react-query";
import { tenantApi } from "@/lib/api";

export interface TenantUtilityCategory {
  category: string;
  amount: number;
}

export interface TenantUtilitySummary {
  year: number;
  totalCosts: number;
  balance: number;
  isRefund: boolean;
  categories: TenantUtilityCategory[];
}

export function useTenantUtility(slug: string, year?: number) {
  return useQuery({
    queryKey: ["tenant", slug, "utility", year],
    queryFn: () => tenantApi<{ data: TenantUtilitySummary }>(slug, year ? `/utility?year=${year}` : "/utility"),
    select: (res) => res.data,
  });
}
