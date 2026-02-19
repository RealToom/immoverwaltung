import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

interface PropertyListItem {
  id: number;
  name: string;
  street: string;
  zip: string;
  city: string;
  address: string;
  status: string;
  totalUnits: number;
  occupiedUnits: number;
  maintenanceUnits: number;
  monthlyRevenue: number;
  createdAt: string;
  updatedAt: string;
}

interface PaginatedResponse<T> {
  data: T[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

interface PropertyDetail {
  id: number;
  name: string;
  street: string;
  zip: string;
  city: string;
  address: string;
  status: string;
  purchasePrice: number | null;
  equity: number | null;
  units: {
    id: number;
    number: string;
    floor: number;
    area: number;
    rent: number;
    type: string;
    status: string;
    tenant: { id: number; name: string; email: string; phone: string } | null;
  }[];
  documents: {
    id: number;
    name: string;
    fileType: string;
    fileSize: string;
    createdAt: string;
  }[];
}

export function useProperties(search?: string, status?: string) {
  return useQuery({
    queryKey: ["properties", search, status],
    queryFn: () =>
      api<PaginatedResponse<PropertyListItem>>("/properties", {
        params: {
          search,
          status: status && status !== "alle" ? status : undefined,
          limit: 100,
        },
      }),
  });
}

export function useProperty(id: number | undefined) {
  return useQuery({
    queryKey: ["property", id],
    queryFn: () => api<{ data: PropertyDetail }>(`/properties/${id}`),
    enabled: !!id,
  });
}

export function useCreateProperty() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; street: string; zip: string; city: string; status?: string }) =>
      api("/properties", { method: "POST", body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["properties"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useUpdateProperty(propertyId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name?: string; street?: string; zip?: string; city?: string; status?: string; purchasePrice?: number | null; equity?: number | null }) =>
      api(`/properties/${propertyId}`, { method: "PATCH", body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["property", propertyId] });
      queryClient.invalidateQueries({ queryKey: ["properties"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useCreateUnit(propertyId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { number: string; floor: number; area: number; rent: number; type?: string; status?: string; tenantId?: number | null }) =>
      api(`/properties/${propertyId}/units`, { method: "POST", body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["property", propertyId] });
      queryClient.invalidateQueries({ queryKey: ["properties"] });
    },
  });
}

export function useUpdateUnit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ unitId, data }: { unitId: number; data: Record<string, unknown> }) =>
      api(`/units/${unitId}`, { method: "PATCH", body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["property"] });
      queryClient.invalidateQueries({ queryKey: ["properties"] });
      queryClient.invalidateQueries({ queryKey: ["tenants"] });
    },
  });
}
