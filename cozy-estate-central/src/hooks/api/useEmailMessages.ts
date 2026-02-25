import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface EmailMessage {
  id: number; fromAddress: string; fromName: string | null; subject: string;
  receivedAt: string; isRead: boolean; isInquiry: boolean;
  inquiryStatus: "NEU" | "IN_BEARBEITUNG" | "AKZEPTIERT" | "ABGELEHNT" | null;
  suggestedEventId: number | null;
  attachments: { id: number; filename: string; mimeType: string; size: number }[];
  bodyText?: string; bodyHtml?: string;
}

export function useEmailMessages(opts?: {
  accountId?: number; isRead?: boolean; isInquiry?: boolean;
  inquiryStatus?: string; page?: number; limit?: number;
}) {
  return useQuery({
    queryKey: ["email-messages", opts],
    queryFn: () => api<{ data: EmailMessage[]; meta: { total: number; totalPages: number } }>(
      "/email-messages",
      { params: { ...opts as Record<string, unknown>, isRead: opts?.isRead?.toString(), isInquiry: opts?.isInquiry?.toString() } }
    ),
  });
}

export function useEmailMessage(id: number) {
  return useQuery({
    queryKey: ["email-message", id],
    queryFn: () => api<{ data: EmailMessage & { bodyHtml: string; bodyText: string } }>(`/email-messages/${id}`),
    enabled: !!id,
  });
}

export function useUpdateEmailMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number } & Record<string, unknown>) =>
      api(`/email-messages/${id}`, { method: "PATCH", body: data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email-messages"] });
      qc.invalidateQueries({ queryKey: ["email-message"] });
    },
  });
}

export function useReplyEmail() {
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: string }) =>
      api(`/email-messages/${id}/reply`, { method: "POST", body: { body } }),
  });
}

export function useSendDocument() {
  return useMutation({
    mutationFn: ({ id, documentId, body }: { id: number; documentId: number; body: string }) =>
      api(`/email-messages/${id}/send-document`, { method: "POST", body: { documentId, body } }),
  });
}

export function useCreateEventFromEmail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number } & Record<string, unknown>) =>
      api(`/email-messages/${id}/create-event`, { method: "POST", body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["calendar-events"] }),
  });
}

export function useSendNewEmail() {
  return useMutation({
    mutationFn: (data: { accountId: number; to: string; subject: string; body: string }) =>
      api("/email-messages/send", { method: "POST", body: data }),
  });
}
