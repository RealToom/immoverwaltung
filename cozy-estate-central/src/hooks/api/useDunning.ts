import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface DunningRecord {
  id: number;
  level: number;
  sentAt: string;
  dueDate: string;
  totalAmount: number;
  status: "OFFEN" | "BEZAHLT" | "STORNIERT";
  contractId: number;
  contract?: {
    tenant: { id: number; name: string; email: string };
    property: { id: number; name: string };
    unit: { id: number; number: string };
  };
}

export function useDunning(contractId?: number) {
  return useQuery({
    queryKey: ["dunning", contractId],
    queryFn: () =>
      api<{ data: DunningRecord[] }>(`/dunning${contractId ? `?contractId=${contractId}` : ""}`).then(
        (r) => r.data,
      ),
  });
}

export function useSendDunning() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (contractId: number) =>
      api(`/dunning/contracts/${contractId}/send`, { method: "POST" }),
    onSuccess: (_, contractId) => {
      qc.invalidateQueries({ queryKey: ["dunning"] });
      qc.invalidateQueries({ queryKey: ["dunning", contractId] });
    },
  });
}

export function useResolveDunning() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api(`/dunning/${id}/resolve`, { method: "PATCH" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dunning"] }),
  });
}
