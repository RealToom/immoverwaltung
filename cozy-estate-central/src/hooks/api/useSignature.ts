import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useSendForSignature(contractId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { templateId: number; signerEmail?: string; signerName?: string }) =>
      api<{ data: { signatureRequestId: string; status: string } }>(
        `/contracts/${contractId}/signature`,
        { method: "POST", body: data },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contracts"] });
    },
  });
}

export async function downloadSignedDocument(contractId: number, tenantName: string): Promise<void> {
  const token = localStorage.getItem("accessToken");
  const res = await fetch(`/api/contracts/${contractId}/signature/document`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: "include",
  });
  if (!res.ok) throw new Error("Signiertes Dokument nicht verfügbar");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Mietvertrag-${contractId}-${tenantName}-signed.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
