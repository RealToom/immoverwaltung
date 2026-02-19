import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, uploadFile } from "@/lib/api";

interface Document {
  id: number;
  name: string;
  fileType: string;
  fileSize: string;
  filePath: string | null;
  propertyId: number | null;
  tenantId: number | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Property Documents ──────────────────────────────────────

export function useUploadDocument(propertyId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (formData: FormData) =>
      uploadFile<{ data: Document }>(`/properties/${propertyId}/documents`, formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["property", propertyId] });
    },
  });
}

export function useDeleteDocument(propertyId?: number, tenantId?: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (docId: number) =>
      api(`/documents/${docId}`, { method: "DELETE" }),
    onSuccess: () => {
      if (propertyId) queryClient.invalidateQueries({ queryKey: ["property", propertyId] });
      if (tenantId) queryClient.invalidateQueries({ queryKey: ["tenantDocuments", tenantId] });
    },
  });
}

export function useDownloadDocument() {
  return useMutation({
    mutationFn: async ({ docId, docName }: { docId: number; docName: string }) => {
      const token = localStorage.getItem("accessToken");
      const res = await fetch(`/api/documents/${docId}/download`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: "include",
      });
      if (!res.ok) throw new Error("Download fehlgeschlagen");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = docName;
      a.click();
      URL.revokeObjectURL(url);
    },
  });
}

export function getPreviewUrl(docId: number): string {
  return `/api/documents/${docId}/preview`;
}

export function usePreviewDocument() {
  return useMutation({
    mutationFn: async (docId: number) => {
      const token = localStorage.getItem("accessToken");
      const res = await fetch(`/api/documents/${docId}/preview`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: "include",
      });
      if (!res.ok) throw new Error("Vorschau fehlgeschlagen");
      const blob = await res.blob();
      return { url: URL.createObjectURL(blob), mimeType: blob.type };
    },
  });
}

// ─── Tenant Documents ────────────────────────────────────────

export function useTenantDocuments(tenantId: number | undefined) {
  return useQuery<{ data: Document[] }>({
    queryKey: ["tenantDocuments", tenantId],
    queryFn: () => api(`/tenants/${tenantId}/documents`),
    enabled: !!tenantId,
  });
}

export function useUploadTenantDocument(tenantId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (formData: FormData) =>
      uploadFile<{ data: Document }>(`/tenants/${tenantId}/documents`, formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenantDocuments", tenantId] });
    },
  });
}
