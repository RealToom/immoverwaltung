import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { tenantApi } from "@/lib/api";

export interface TenantDocument {
  id: number;
  name: string;
  fileType: string;
  fileSize: string;
  filePath: string | null;
  requiresSignature: boolean;
  signatureType: "SIMPLE" | "SIGNATURE_PAD" | null;
  signedAt: string | null;
  createdAt: string;
}

export interface TenantUpload {
  id: number;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  category: string;
  description: string | null;
  createdAt: string;
}

export function useTenantDocuments(slug: string) {
  return useQuery({
    queryKey: ["tenant", slug, "documents"],
    queryFn: () => tenantApi<{ data: TenantDocument[] }>(slug, "/documents"),
    select: (res) => res.data,
  });
}

export function useTenantUploads(slug: string) {
  return useQuery({
    queryKey: ["tenant", slug, "uploads"],
    queryFn: () => tenantApi<{ data: TenantUpload[] }>(slug, "/uploads"),
    select: (res) => res.data,
  });
}

export function useSignDocument(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      documentId,
      type,
      signatureData,
    }: {
      documentId: number;
      type: "SIMPLE" | "SIGNATURE_PAD";
      signatureData?: string;
    }) =>
      tenantApi(slug, `/documents/${documentId}/sign`, {
        method: "POST",
        body: { type, signatureData },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tenant", slug, "documents"] }),
  });
}

export function useUploadDocument(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (formData: FormData) =>
      tenantApi<{ data: TenantUpload }>(slug, "/uploads", {
        method: "POST",
        body: formData,
        isFormData: true,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tenant", slug, "uploads"] }),
  });
}
