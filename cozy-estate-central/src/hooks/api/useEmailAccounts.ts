import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface EmailAccount {
  id: number; label: string; email: string; imapHost: string; imapPort: number;
  smtpHost: string; smtpPort: number; isActive: boolean; lastSync: string | null;
  allowedRoles: string[];
}

export function useEmailAccounts() {
  return useQuery({
    queryKey: ["email-accounts"],
    queryFn: () => api<{ data: EmailAccount[] }>("/email-accounts"),
  });
}

export function useCreateEmailAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api("/email-accounts", { method: "POST", body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["email-accounts"] }),
  });
}

export function useDeleteEmailAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api(`/email-accounts/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["email-accounts"] }),
  });
}

export function useSyncEmailAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api(`/email-accounts/${id}/sync`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["email-messages"] }),
  });
}
