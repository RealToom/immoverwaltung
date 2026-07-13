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
  laborCostShare: number;
  suggestedPrepayment: number;
}

export function useApplyPrepaymentAdjustment() {
  return useMutation({
    mutationFn: ({ contractId, utilityPrepayment }: { contractId: number; utilityPrepayment: number }) =>
      api(`/utility-billing/contracts/${contractId}/prepayment`, {
        method: "PATCH",
        body: { utilityPrepayment },
      }),
  });
}

export interface UtilityStatement {
  year: number;
  propertyId: number;
  periodStart: string;
  periodEnd: string;
  daysInYear: number;
  totalArea: number;
  totalCosts: number;
  totalLaborCosts: number;
  co2: { energyClass: string | null; co2Emissions: number | null; landlordPercentage: number; tenantShare: number; landlordShare: number };
  heating: {
    totalCosts: number;
    consumptionBased: boolean;
    consumptionSharePercent: number | null;
    ownerShare: number;
    warning?: string;
    estimated: boolean;
    estimationNotice?: string;
    warmWater: { totalCosts: number; consumptionBased: boolean; ownerShare: number } | null;
  } | null;
  vacancy: { amount: number; vacancyDays: number; affectedUnits: string[] } | null;
  distributionKeys: Record<string, string>;
  vorwegabzug: { commercialUnits: string[]; commercialCosts: number; sharePercent: number; note: string } | null;
  items: UtilityStatementItem[];
  transactions: UtilityStatementTransaction[];
  unallocatedTransactions: UnallocatedTransaction[];
}

export function useSetDistributionKeys() {
  return useMutation({
    mutationFn: ({ propertyId, costConfiguration }: { propertyId: number; costConfiguration: Record<string, string> }) =>
      api(`/utility-billing/properties/${propertyId}/distribution-keys`, {
        method: "PATCH",
        body: { costConfiguration },
      }),
  });
}

export interface StatementDeadline {
  propertyId: number;
  propertyName: string;
  year: number;
  deadline: string;
  daysRemaining: number;
  overdue: boolean;
}

export function useStatementDeadlines() {
  return useQuery({
    queryKey: ["utility-billing", "deadlines"],
    queryFn: () => api<{ data: StatementDeadline[] }>("/utility-billing/statements/deadlines"),
  });
}

export interface PlausibilityCheck {
  year: number;
  previousYear: number;
  hasPreviousData: boolean;
  costPerSqmPerMonth: number | null;
  categoryWarnings: { category: string; current: number; previous: number; changePercent: number }[];
  benchmarkHint: string | null;
}

export function usePlausibilityChecks(propertyId: number | null, year: number, enabled: boolean) {
  return useQuery({
    queryKey: ["utility-billing", "plausibility", propertyId, year],
    queryFn: () =>
      api<{ data: PlausibilityCheck }>("/utility-billing/plausibility", { params: { propertyId, year } }),
    enabled: enabled && !!propertyId,
  });
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
  statementItemId: number | null;
  settlementStatus: string;
}

export function useUpdateSettlementStatus() {
  return useMutation({
    mutationFn: ({ itemId, settlementStatus }: { itemId: number; settlementStatus: string }) =>
      api(`/utility-billing/statements/items/${itemId}/settlement`, {
        method: "PATCH",
        body: { settlementStatus },
      }),
  });
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
