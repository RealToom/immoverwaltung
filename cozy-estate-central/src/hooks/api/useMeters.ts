import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface Meter {
  id: number;
  label: string;
  type: string;
  unitId: number | null;
  propertyId: number;
  unit: { id: number; number: string } | null;
  readings: MeterReading[];
}

export interface MeterReading {
  id: number;
  value: number;
  readAt: string;
  note: string | null;
  consumption: number | null;
}

export function useMeters(propertyId: number) {
  return useQuery({
    queryKey: ["meters", propertyId],
    queryFn: () =>
      api<{ data: Meter[] }>(`/meters?propertyId=${propertyId}`).then((r) => r.data),
  });
}

export function useMeterReadings(meterId: number) {
  return useQuery({
    queryKey: ["meter-readings", meterId],
    queryFn: () =>
      api<{ data: MeterReading[] }>(`/meters/${meterId}/readings`).then((r) => r.data),
  });
}

export function useCreateMeter(propertyId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { label: string; type: string; propertyId: number; unitId?: number }) =>
      api<{ data: Meter }>("/meters", { method: "POST", body: JSON.stringify(data) }).then(
        (r) => r.data,
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meters", propertyId] }),
  });
}

export function useAddMeterReading(meterId: number, propertyId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { value: number; readAt: string; note?: string }) =>
      api<{ data: MeterReading }>(`/meters/${meterId}/readings`, {
        method: "POST",
        body: JSON.stringify(data),
      }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meter-readings", meterId] });
      qc.invalidateQueries({ queryKey: ["meters", propertyId] });
    },
  });
}

export function useDeleteMeter(propertyId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api(`/meters/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meters", propertyId] }),
  });
}

export function useDeleteMeterReading(meterId: number, propertyId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (readingId: number) =>
      api(`/meters/${meterId}/readings/${readingId}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meter-readings", meterId] });
      qc.invalidateQueries({ queryKey: ["meters", propertyId] });
    },
  });
}
