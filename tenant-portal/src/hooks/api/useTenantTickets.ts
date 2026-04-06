import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { tenantApi } from "@/lib/api";

export interface TenantTicket {
  id: number;
  title: string;
  description: string;
  category: string;
  status: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTicketInput {
  title: string;
  description: string;
  category: string;
}

export function useTenantTickets(slug: string) {
  return useQuery({
    queryKey: ["tenant", slug, "tickets"],
    queryFn: () => tenantApi<{ data: TenantTicket[] }>(slug, "/tickets"),
    select: (res) => res.data,
  });
}

export function useCreateTicket(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTicketInput) =>
      tenantApi(slug, "/tickets", {
        method: "POST",
        body: input,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tenant", slug, "tickets"] }),
  });
}
