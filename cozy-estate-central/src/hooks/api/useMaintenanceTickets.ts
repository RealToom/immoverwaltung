import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface MaintenanceTicketItem {
  id: number;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  unitLabel: string;
  reportedBy: string;
  assignedTo: string | null;
  dueDate: string | null;
  cost: number | null;
  notes: string | null;
  createdAt: string;
  property: { id: number; name: string };
  unit: { id: number; number: string } | null;
}

interface PaginatedResponse<T> {
  data: T[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export function useMaintenanceTickets(
  search?: string,
  status?: string,
  priority?: string,
  category?: string,
  from?: string,
  to?: string,
) {
  return useQuery({
    queryKey: ["maintenance", search, status, priority, category, from, to],
    queryFn: () =>
      api<PaginatedResponse<MaintenanceTicketItem>>("/maintenance", {
        params: {
          search,
          status: status && status !== "alle" ? status : undefined,
          priority: priority && priority !== "alle" ? priority : undefined,
          category: category && category !== "alle" ? category : undefined,
          from: from || undefined,
          to: to || undefined,
          limit: 100,
        },
      }),
  });
}

export function useCreateMaintenanceTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api("/maintenance", { method: "POST", body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["maintenance"] });
    },
  });
}

export function useUpdateMaintenanceTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      api(`/maintenance/${id}`, { method: "PATCH", body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["maintenance"] });
    },
  });
}

export function useDeleteMaintenanceTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api(`/maintenance/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["maintenance"] });
    },
  });
}
