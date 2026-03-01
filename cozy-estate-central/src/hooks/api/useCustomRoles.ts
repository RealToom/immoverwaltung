import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { CustomRole } from "@/lib/permissions";

export interface CustomRoleWithCount extends CustomRole {
  _count: { users: number };
}

export function useCustomRoles() {
  return useQuery<CustomRoleWithCount[]>({
    queryKey: ["admin", "roles"],
    queryFn: async () => {
      const res = await api<{ data: CustomRoleWithCount[] }>("/administration/roles");
      return res.data;
    },
  });
}

export function useCreateCustomRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; pages: string[] }) =>
      api<{ data: CustomRoleWithCount }>("/administration/roles", { method: "POST", body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "roles"] }),
  });
}

export function useUpdateCustomRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: number; name?: string; pages?: string[] }) =>
      api<{ data: CustomRoleWithCount }>(`/administration/roles/${id}`, { method: "PATCH", body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "roles"] }),
  });
}

export function useDeleteCustomRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      api(`/administration/roles/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "roles"] }),
  });
}

export function useSetUserCustomRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, customRoleId }: { userId: number; customRoleId: number | null }) =>
      api(`/administration/users/${userId}/role`, { method: "PATCH", body: { customRoleId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      qc.invalidateQueries({ queryKey: ["admin", "roles"] });
    },
  });
}
