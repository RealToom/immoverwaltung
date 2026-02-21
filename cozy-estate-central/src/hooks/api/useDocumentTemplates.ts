import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface DocumentTemplate {
  id: number;
  name: string;
  category: string;
  content: string;
  companyId: number;
  createdAt: string;
  updatedAt: string;
}

export function useDocumentTemplates() {
  return useQuery({
    queryKey: ["document-templates"],
    queryFn: () =>
      api<{ data: DocumentTemplate[] }>("/document-templates").then((r) => r.data),
  });
}

export function useCreateDocumentTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; category: string; content: string }) =>
      api<{ data: DocumentTemplate }>("/document-templates", {
        method: "POST",
        body: JSON.stringify(data),
      }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["document-templates"] }),
  });
}

export function useUpdateDocumentTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number; name?: string; category?: string; content?: string }) =>
      api<{ data: DocumentTemplate }>(`/document-templates/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["document-templates"] }),
  });
}

export function useDeleteDocumentTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      api(`/document-templates/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["document-templates"] }),
  });
}

export function useRenderDocumentTemplate() {
  return useMutation({
    mutationFn: async ({
      id,
      variables,
    }: {
      id: number;
      variables: Record<string, string>;
    }) => {
      const token = localStorage.getItem("accessToken");
      const res = await fetch(`/api/document-templates/${id}/render`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token ?? ""}`,
        },
        body: JSON.stringify({ variables }),
      });
      if (!res.ok) throw new Error("Rendering fehlgeschlagen");
      return res.blob();
    },
  });
}
