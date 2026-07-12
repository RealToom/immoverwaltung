import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface UtilityStatementTransaction {
  id: number;
  description: string;
  amount: number;
  betrkvCategory: string | null;
  maintenanceWarning: string | null;
  co2TaxAmount: number | null;
}

export interface UnallocatedTransaction {
  id: number;
  date: string;
  description: string;
  amount: number;
  category: string;
}

export interface UtilityStatementItem {
  contractId: number;
  unitId: number;
  tenantId: number;
  unitNumber: string;
  tenantName: string;
  area: number;
  occupancyDays: number;
  amount: number;
  heatingAmount: number;
  totalPrepaid: number;
  balance: number;
  isRefund: boolean;
}

export interface UtilityStatement {
  year: number;
  propertyId: number;
  daysInYear: number;
  totalArea: number;
  totalCosts: number;
  co2: { energyClass: string | null; co2Emissions: number | null; landlordPercentage: number; tenantShare: number; landlordShare: number };
  heating: {
    totalCosts: number;
    consumptionBased: boolean;
    consumptionSharePercent: number | null;
    ownerShare: number;
    warning?: string;
  } | null;
  vacancy: { amount: number; vacancyDays: number; affectedUnits: string[] } | null;
  items: UtilityStatementItem[];
  transactions: UtilityStatementTransaction[];
  unallocatedTransactions: UnallocatedTransaction[];
}

export function useGenerateUtilityStatement() {
  return useMutation({
    mutationFn: (data: { propertyId: number; year: number }) =>
      api<{ data: UtilityStatement }>("/utility-billing/statements/generate", {
        method: "POST",
        body: data,
      }),
  });
}

export interface UtilityDispute {
  id: number;
  reason: string;
  status: string;
  year: number | null;
  amount: number | null;
  createdAt: string;
  contract: { tenant: { id: number; name: string } };
}

export function useUtilityDisputes(status?: string) {
  return useQuery({
    queryKey: ["utility-billing", "disputes", status],
    queryFn: () => api<{ data: UtilityDispute[] }>("/utility-billing/disputes", { params: { status } }),
  });
}

export function useUpdateDisputeStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      api(`/utility-billing/disputes/${id}`, { method: "PATCH", body: { status } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["utility-billing", "disputes"] }),
  });
}

export interface FinalizedStatementItem extends UtilityStatementItem {
  documentId: number | null;
}

export interface FinalizeStatementResult {
  propertyId: number;
  year: number;
  generatedCount: number;
  items: FinalizedStatementItem[];
}

export function useFinalizeStatement() {
  return useMutation({
    mutationFn: (data: { propertyId: number; year: number }) =>
      api<{ data: FinalizeStatementResult }>("/utility-billing/statements/finalize", {
        method: "POST",
        body: data,
      }),
  });
}
