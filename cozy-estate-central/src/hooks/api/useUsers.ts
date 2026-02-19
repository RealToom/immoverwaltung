import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface UserItem {
  id: number;
  name: string;
  email: string;
  role: string; // ADMIN | VERWALTER | BUCHHALTER | READONLY
  phone: string;
  isLocked: boolean;
  failedLoginAttempts: number;
  createdAt: string;
  updatedAt: string;
}

export function useUsers() {
  return useQuery({
    queryKey: ["users"],
    queryFn: () => api<{ data: UserItem[] }>("/users"),
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; email: string; password: string; role: string; phone?: string }) =>
      api("/users", { method: "POST", body: data }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: { name?: string; role?: string; phone?: string } }) =>
      api(`/users/${id}`, { method: "PATCH", body: data }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api(`/users/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });
}

export function useResetUserPassword() {
  return useMutation({
    mutationFn: (id: number) =>
      api<{ data: { temporaryPassword: string } }>(`/users/${id}/reset-password`, { method: "POST" }),
  });
}

export function useUnlockUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api(`/users/${id}/unlock`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });
}
