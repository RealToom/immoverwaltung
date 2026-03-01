import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const BASE = "/api/superadmin";

async function superadminFetch<T>(
  path: string,
  token: string | null,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers as Record<string, string> | undefined),
    },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message ?? "Fehler");
  return json as T;
}

interface DbStats {
  companies: number;
  users: number;
  properties: number;
  tenants: number;
  contracts: number;
}

interface ServerStats {
  memory: { total: number; used: number; free: number };
  disk: { total: number; used: number; free: number };
  lastBackup: string | null;
  uptime: number;
}

export interface SuperAdminStats {
  db: DbStats;
  server: ServerStats;
}

export interface SuperAdminCompany {
  id: number;
  name: string;
  createdAt: string;
  _count: { users: number; properties: number; tenants: number; contracts: number };
}

export function useSuperAdminStats(token: string | null) {
  return useQuery({
    queryKey: ["superadmin", "stats"],
    queryFn: () =>
      superadminFetch<{ data: SuperAdminStats }>("/stats", token),
    enabled: !!token,
  });
}

export function useSuperAdminCompanies(token: string | null) {
  return useQuery({
    queryKey: ["superadmin", "companies"],
    queryFn: () =>
      superadminFetch<{ data: SuperAdminCompany[] }>("/companies", token),
    enabled: !!token,
  });
}

export function useSuperAdminLogin() {
  return useMutation({
    mutationFn: (password: string) =>
      superadminFetch<{ data: { token: string } }>("/login", null, {
        method: "POST",
        body: JSON.stringify({ password }),
      }),
  });
}

export function useCreateCompany(token: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      companyName: string;
      adminEmail: string;
      adminPassword: string;
      adminName?: string;
    }) =>
      superadminFetch("/companies", token, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["superadmin"] }),
  });
}

export function useResetCompanyPassword(token: string | null) {
  return useMutation({
    mutationFn: ({
      companyId,
      email,
      newPassword,
    }: {
      companyId: number;
      email: string;
      newPassword: string;
    }) =>
      superadminFetch(`/companies/${companyId}/reset-password`, token, {
        method: "POST",
        body: JSON.stringify({ email, newPassword }),
      }),
  });
}

export function useDeleteCompany(token: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (companyId: number) =>
      superadminFetch(`/companies/${companyId}`, token, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["superadmin"] }),
  });
}
