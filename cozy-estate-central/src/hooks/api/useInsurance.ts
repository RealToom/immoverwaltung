import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface InsurancePolicy {
  id: number;
  name: string;
  insurer: string;
  policyNumber: string | null;
  type: string;
  status: string;
  premium: number;
  startDate: string;
  endDate: string | null;
  notes: string | null;
  propertyId: number | null;
  property: { id: number; name: string; street: string; city: string } | null;
  createdAt: string;
  updatedAt: string;
}

interface PaginatedResponse<T> {
  data: T[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export function useInsurancePolicies(propertyId?: number) {
  return useQuery({
    queryKey: ["insurance-policies", propertyId],
    queryFn: () =>
      api<PaginatedResponse<InsurancePolicy>>("/insurance", {
        params: { propertyId, limit: 100 },
      }),
  });
}

export function useCreateInsurancePolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<InsurancePolicy, "id" | "property" | "createdAt" | "updatedAt">) =>
      api<{ data: InsurancePolicy }>("/insurance", { method: "POST", body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["insurance-policies"] }),
  });
}

export function useUpdateInsurancePolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<InsurancePolicy> & { id: number }) =>
      api<{ data: InsurancePolicy }>(`/insurance/${id}`, { method: "PATCH", body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["insurance-policies"] }),
  });
}

export function useDeleteInsurancePolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api(`/insurance/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["insurance-policies"] }),
  });
}
