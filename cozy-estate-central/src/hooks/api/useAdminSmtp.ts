import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface SmtpSettings {
  id: number;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  fromAddress: string;
  fromName: string;
}

export interface SmtpInput {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password?: string;
  fromAddress: string;
  fromName: string;
}

export function useAdminSmtp() {
  return useQuery<SmtpSettings | null>({
    queryKey: ["admin", "smtp"],
    queryFn: async () => {
      const res = await api<{ data: SmtpSettings | null }>("/administration/smtp");
      return res.data;
    },
  });
}

export function useSaveSmtp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SmtpInput) =>
      api<{ data: SmtpSettings }>("/administration/smtp", { method: "PUT", body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "smtp"] }),
  });
}

export function useTestSmtp() {
  return useMutation({
    mutationFn: () =>
      api<{ data: { success: boolean; message: string } }>("/administration/smtp/test", {
        method: "POST",
      }),
  });
}
