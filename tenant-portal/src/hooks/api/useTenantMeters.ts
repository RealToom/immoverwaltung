import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { tenantApi } from "@/lib/api";

export interface TenantMeter {
  id: number;
  label: string;
  type: string;
  readings: { id: number; value: number; readAt: string }[];
}

export function useTenantMeters(slug: string) {
  return useQuery({
    queryKey: ["tenant", slug, "meters"],
    queryFn: () => tenantApi<{ data: TenantMeter[] }>(slug, "/meters"),
    select: (res) => res.data,
  });
}

export function useSubmitMeterReading(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ meterId, value, readAt, note }: { meterId: number; value: number; readAt: string; note?: string }) =>
      tenantApi(slug, `/meters/${meterId}/readings`, { method: "POST", body: { value, readAt, note } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tenant", slug, "meters"] }),
  });
}

export interface ScannedMeterReading {
  value: number | null;
  unit: string | null;
}

export function useScanMeterReading(slug: string) {
  return useMutation({
    mutationFn: ({ meterId, photo }: { meterId: number; photo: File }) => {
      const form = new FormData();
      form.append("photo", photo);
      return tenantApi<{ data: ScannedMeterReading }>(slug, `/meters/${meterId}/readings/scan`, {
        method: "POST",
        body: form,
        isFormData: true,
      });
    },
  });
}
