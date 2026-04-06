import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { tenantApi } from "@/lib/api";

export interface TenantMessage {
  id: number;
  body: string;
  direction: "TENANT_TO_ADMIN" | "ADMIN_TO_TENANT";
  readAt: string | null;
  createdAt: string;
}

export function useTenantMessages(slug: string) {
  return useQuery({
    queryKey: ["tenant", slug, "messages"],
    queryFn: () => tenantApi<{ data: TenantMessage[] }>(slug, "/messages"),
    select: (res) => res.data,
  });
}

export function useSendMessage(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) =>
      tenantApi(slug, "/messages", {
        method: "POST",
        body: { body },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tenant", slug, "messages"] }),
  });
}
