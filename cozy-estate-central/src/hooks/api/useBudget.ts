import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, getToken } from "@/lib/api";

export interface MaintenanceBudget {
  id: number;
  year: number;
  plannedAmount: number;
  actualAmount: number;
  notes: string | null;
  propertyId: number;
  property: { id: number; name: string; street: string; city: string } | null;
  createdAt: string;
  updatedAt: string;
}

export function useBudgets(propertyId?: number, year?: number) {
  return useQuery({
    queryKey: ["budgets", propertyId, year],
    queryFn: () =>
      api<{ data: MaintenanceBudget[] }>("/maintenance-budgets", {
        params: { propertyId, year },
      }).then((r) => r.data),
    enabled: !!propertyId,
  });
}

export function useBudgetSummary(year: number) {
  return useQuery({
    queryKey: ["budget-summary", year],
    queryFn: () =>
      api<{ data: MaintenanceBudget[] }>("/maintenance-budgets/summary", {
        params: { year },
      }).then((r) => r.data),
  });
}

export function useUpsertBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { propertyId: number; year: number; plannedAmount: number; notes?: string | null }) =>
      api<{ data: MaintenanceBudget }>("/maintenance-budgets", { method: "POST", body: data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["budgets"] });
      qc.invalidateQueries({ queryKey: ["budget-summary"] });
    },
  });
}

export function useDeleteBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api(`/maintenance-budgets/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["budgets"] });
      qc.invalidateQueries({ queryKey: ["budget-summary"] });
    },
  });
}

export function useDownloadHandoverPdf() {
  return async (id: number, name: string) => {
    const token = getToken();
    const res = await fetch(`/api/handover-protocols/${id}/pdf`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: "include",
    });
    if (!res.ok) throw new Error("PDF konnte nicht generiert werden");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };
}
