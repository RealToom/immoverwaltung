import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface RecurringTransaction {
  id: number;
  description: string;
  type: "EINNAHME" | "AUSGABE";
  amount: number;
  category: string;
  allocatable: boolean;
  interval: "MONATLICH" | "VIERTELJAEHRLICH" | "HALBJAEHRLICH" | "JAEHRLICH";
  dayOfMonth: number;
  startDate: string;
  endDate: string | null;
  isActive: boolean;
  lastRun: string | null;
  propertyId: number | null;
  property: { id: number; name: string } | null;
}

export interface CreateRecurringInput {
  description: string;
  type: string;
  amount: number;
  category: string;
  allocatable: boolean;
  interval: string;
  dayOfMonth: number;
  startDate: string;
  endDate?: string;
  propertyId?: number;
}

const QUERY_KEY = ["recurring-transactions"];

export function useRecurringTransactions() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: () =>
      api<{ data: RecurringTransaction[] }>("/recurring-transactions").then((r) => r.data),
  });
}

export function useCreateRecurring() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateRecurringInput) =>
      api<{ data: RecurringTransaction }>("/recurring-transactions", {
        method: "POST",
        body: JSON.stringify(data),
      }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useUpdateRecurring() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<{ description: string; amount: number; isActive: boolean; endDate: string }> }) =>
      api<{ data: RecurringTransaction }>(`/recurring-transactions/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useDeleteRecurring() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api(`/recurring-transactions/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}
