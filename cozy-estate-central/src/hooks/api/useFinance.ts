import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, uploadFile } from "@/lib/api";

// ─── Summary ────────────────────────────────────────────────
interface FinanceSummary {
  monthlyRevenue: number;
  totalIncome: number;
  totalExpenses: number;
  netIncome: number;
}

export function useFinanceSummary() {
  return useQuery({
    queryKey: ["finance", "summary"],
    queryFn: () => api<{ data: FinanceSummary }>("/finance/summary"),
  });
}

// ─── Monthly Revenue ────────────────────────────────────────
interface MonthlyData {
  month: string; // "YYYY-MM"
  einnahmen: number;
  ausgaben: number;
  netto: number;
}

export function useMonthlyRevenue(months: number = 8) {
  return useQuery({
    queryKey: ["finance", "monthly", months],
    queryFn: () =>
      api<{ data: MonthlyData[] }>("/finance/monthly", {
        params: { months },
      }),
  });
}

// ─── Revenue by Property ────────────────────────────────────
interface PropertyRevenue {
  propertyId: number;
  propertyName: string;
  actualRevenue: number;
  potentialRevenue: number;
  occupancyRate: number;
}

export function useRevenueByProperty() {
  return useQuery({
    queryKey: ["finance", "by-property"],
    queryFn: () => api<{ data: PropertyRevenue[] }>("/finance/by-property"),
  });
}

// ─── Expense Breakdown ──────────────────────────────────────
interface ExpenseCategory {
  name: string;
  value: number;
}

export function useExpenseBreakdown() {
  return useQuery({
    queryKey: ["finance", "expense-breakdown"],
    queryFn: () => api<{ data: ExpenseCategory[] }>("/finance/expense-breakdown"),
  });
}

// ─── Transactions ───────────────────────────────────────────
interface Transaction {
  id: number;
  date: string;
  description: string;
  type: string; // "EINNAHME" | "AUSGABE"
  amount: number;
  category: string;
  allocatable: boolean;
  property: { id: number; name: string } | null;
  bankAccount: { id: number; name: string } | null;
}

interface PaginatedResponse<T> {
  data: T[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export function useTransactions(
  page: number = 1,
  limit: number = 25,
  type?: string,
  search?: string,
) {
  return useQuery({
    queryKey: ["finance", "transactions", page, limit, type, search],
    queryFn: () =>
      api<PaginatedResponse<Transaction>>("/finance/transactions", {
        params: {
          page,
          limit,
          type: type && type !== "alle" ? type.toUpperCase() : undefined,
          search,
        },
      }),
  });
}

// ─── Rent Collection (Mieteingangsquote) ─────────────────
interface RentCollectionMonth {
  month: string; // "YYYY-MM"
  puenktlich: number;
  verspaetet: number;
  ausstehend: number;
}

export function useRentCollection(months: number = 8) {
  return useQuery({
    queryKey: ["finance", "rent-collection", months],
    queryFn: () =>
      api<{ data: RentCollectionMonth[] }>("/finance/rent-collection", {
        params: { months },
      }),
  });
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api("/finance/transactions", { method: "POST", body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance"] });
    },
  });
}

// ─── Receipt Scan (KI-Belegscan) ────────────────────────────
export interface ScannedReceipt {
  amount: number | null;
  date: string | null;
  description: string | null;
  category: string | null;
  type: "EINNAHME" | "AUSGABE";
}

export function useScanReceipt() {
  return useMutation({
    mutationFn: (formData: FormData) =>
      uploadFile<{ data: ScannedReceipt }>("/finance/scan", formData),
  });
}

// ─── Update Transaction (allocatable toggle) ─────────────
export function useUpdateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: { allocatable?: boolean; category?: string } }) =>
      api(`/finance/transactions/${id}`, { method: "PATCH", body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance", "transactions"] });
    },
  });
}

// ─── Utility Statement (Nebenkostenabrechnung) ───────────
export interface UtilityStatementItem {
  unitId: number;
  unitNumber: string;
  tenantName: string;
  area: number;
  areaPercent: number;
  amount: number;
}

export interface UtilityStatement {
  year: number;
  propertyId: number;
  totalCosts: number;
  totalArea: number;
  items: UtilityStatementItem[];
}

export function useUtilityStatement(propertyId: number, year: number, enabled: boolean) {
  return useQuery({
    queryKey: ["finance", "utility-statement", propertyId, year],
    queryFn: () =>
      api<{ data: UtilityStatement }>("/finance/utility-statement", {
        params: { propertyId, year },
      }),
    enabled: enabled && !!propertyId,
  });
}

// ─── ROI Data (Rendite-Dashboard) ────────────────────────
export interface RoiProperty {
  propertyId: number;
  name: string;
  purchasePrice: number | null;
  equity: number | null;
  annualIncome: number;
  annualExpenses: number;
  netIncome: number;
  bruttorendite: number | null;
  nettorendite: number | null;
  ekRendite: number | null;
}

export function useRoiData(year: number) {
  return useQuery({
    queryKey: ["finance", "roi", year],
    queryFn: () =>
      api<{ data: RoiProperty[] }>("/finance/roi", { params: { year } }),
  });
}
