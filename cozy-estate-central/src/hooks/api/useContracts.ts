import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

interface ContractListItem {
  id: number;
  type: string;
  startDate: string;
  endDate: string | null;
  noticePeriod: number;
  monthlyRent: number;
  deposit: number;
  status: string;
  nextReminder: string | null;
  reminderType: string | null;
  notes: string | null;
  tenant: { id: number; name: string; email: string };
  property: { id: number; name: string };
  unit: { id: number; number: string };
}

interface PaginatedResponse<T> {
  data: T[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export function useContracts(search?: string, status?: string, type?: string, propertyId?: number) {
  return useQuery({
    queryKey: ["contracts", search, status, type, propertyId],
    queryFn: () =>
      api<PaginatedResponse<ContractListItem>>("/contracts", {
        params: {
          search,
          status: status && status !== "alle" ? status : undefined,
          type: type && type !== "alle" ? type : undefined,
          propertyId,
          limit: 100,
        },
      }),
  });
}

export function useCreateContract() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api("/contracts", { method: "POST", body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
    },
  });
}
