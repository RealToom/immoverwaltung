import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

interface TenantListItem {
  id: number;
  name: string;
  email: string;
  phone: string;
  moveIn: string;
  units: {
    id: number;
    number: string;
    type: string;
    property: { id: number; name: string };
  }[];
}

interface PaginatedResponse<T> {
  data: T[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export function useTenants(search?: string, propertyId?: number) {
  return useQuery({
    queryKey: ["tenants", search, propertyId],
    queryFn: () =>
      api<PaginatedResponse<TenantListItem>>("/tenants", {
        params: {
          search,
          propertyId,
          limit: 100,
        },
      }),
  });
}

export function useCreateTenant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; email: string; phone?: string; moveIn: string; unitId?: number }) =>
      api("/tenants", { method: "POST", body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenants"] });
      queryClient.invalidateQueries({ queryKey: ["properties"] });
    },
  });
}
