import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface MaintenanceSchedule {
  id: number;
  title: string;
  description: string;
  category: string;
  interval: string;
  lastDone: string | null;
  nextDue: string;
  assignedTo: string | null;
  isActive: boolean;
  propertyId: number;
  property: { id: number; name: string };
}

export function useMaintenanceSchedules(propertyId?: number) {
  const query = propertyId ? `?propertyId=${propertyId}` : "";
  return useQuery({
    queryKey: ["maintenance-schedules", propertyId],
    queryFn: () =>
      api<{ data: MaintenanceSchedule[] }>(`/maintenance-schedules${query}`).then(
        (r) => r.data,
      ),
  });
}

export function useCreateMaintenanceSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      title: string;
      description?: string;
      category: string;
      interval: string;
      nextDue: string;
      assignedTo?: string;
      propertyId: number;
    }) =>
      api<{ data: MaintenanceSchedule }>("/maintenance-schedules", {
        method: "POST",
        body: JSON.stringify(data),
      }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["maintenance-schedules"] }),
  });
}

export function useUpdateMaintenanceSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number } & Record<string, unknown>) =>
      api<{ data: MaintenanceSchedule }>(`/maintenance-schedules/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["maintenance-schedules"] }),
  });
}

export function useDeleteMaintenanceSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      api(`/maintenance-schedules/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["maintenance-schedules"] }),
  });
}
