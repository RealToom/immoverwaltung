import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface RoomEntry {
  name: string;
  condition: "GUT" | "MAENGEL" | "DEFEKT";
  notes?: string;
}

export interface MeterEntry {
  label: string;
  value: number;
  type: string;
}

export interface HandoverProtocol {
  id: number;
  type: "EINZUG" | "AUSZUG";
  date: string;
  tenantName: string;
  notes: string | null;
  rooms: RoomEntry[];
  meterData: MeterEntry[];
  unitId: number;
  unit?: { id: number; number: string };
  companyId: number;
}

export interface CreateHandoverInput {
  type: string;
  date: string;
  tenantName: string;
  notes?: string;
  rooms: RoomEntry[];
  meterData: MeterEntry[];
  unitId: number;
}

export function useHandovers(unitId?: number) {
  return useQuery({
    queryKey: ["handovers", unitId],
    queryFn: () =>
      api<{ data: HandoverProtocol[] }>(
        `/handover-protocols${unitId ? `?unitId=${unitId}` : ""}`,
      ).then((r) => r.data),
  });
}

export function useCreateHandover(unitId?: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateHandoverInput) =>
      api<{ data: HandoverProtocol }>("/handover-protocols", {
        method: "POST",
        body: JSON.stringify(data),
      }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["handovers", unitId] }),
  });
}

export function useDeleteHandover(unitId?: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api(`/handover-protocols/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["handovers", unitId] }),
  });
}
