import { useQuery } from "@tanstack/react-query";
import { tenantApi } from "@/lib/api";

export interface TenantFinanceEntry {
  id: number;
  date: string;
  description: string;
  amount: number;
  type: "INCOME" | "EXPENSE";
  category: string;
}

export interface TenantFinances {
  monthlyRent: number;
  entries: TenantFinanceEntry[];
}

export function useTenantFinances(slug: string) {
  return useQuery({
    queryKey: ["tenant", slug, "finances"],
    queryFn: () => tenantApi<{ data: TenantFinances }>(slug, "/finances"),
    select: (res) => res.data,
  });
}
