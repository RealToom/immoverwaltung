import { useMutation, useQueryClient } from "@tanstack/react-query";
import { tenantApi } from "@/lib/api";

export function useCreateDispute(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { reason: string; amount?: number }) =>
      tenantApi(slug, "/billing-disputes", { method: "POST", body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tenant", slug, "disputes"] }),
  });
}
