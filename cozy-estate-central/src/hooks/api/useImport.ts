// cozy-estate-central/src/hooks/api/useImport.ts
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface ImportError {
  row: number;
  field?: string;
  message: string;
}

export interface ImportResult {
  data: Record<string, number>;
}

export function useImportProperties() {
  return useMutation({
    mutationFn: (rows: Record<string, string>[]) =>
      api<ImportResult>("/import/properties", { method: "POST", body: rows }),
  });
}

export function useImportTenants() {
  return useMutation({
    mutationFn: (rows: Record<string, string>[]) =>
      api<ImportResult>("/import/tenants", { method: "POST", body: rows }),
  });
}

export function useImportContracts() {
  return useMutation({
    mutationFn: (rows: Record<string, string>[]) =>
      api<ImportResult>("/import/contracts", { method: "POST", body: rows }),
  });
}
