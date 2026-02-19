import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

// ─── Profile ────────────────────────────────────────────────
interface UserProfile {
  id: number;
  email: string;
  name: string;
  role: string;
  phone: string;
  bio: string;
  companyId: number;
  company: {
    id: number;
    name: string;
  };
}

export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: () => api<{ data: UserProfile }>("/auth/me"),
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name?: string; phone?: string; bio?: string }) =>
      api("/auth/me", { method: "PATCH", body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}

// ─── Notification Preferences ───────────────────────────────
interface NotificationPrefs {
  emailVertrag: boolean;
  emailWartung: boolean;
  emailFinanzen: boolean;
  pushVertrag: boolean;
  pushWartung: boolean;
  pushFinanzen: boolean;
  reminderDays: number;
  digestFrequency: string;
}

export function useNotificationPrefs() {
  return useQuery({
    queryKey: ["notificationPrefs"],
    queryFn: () => api<{ data: NotificationPrefs }>("/auth/me/notifications"),
  });
}

export function useUpdateNotificationPrefs() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<NotificationPrefs>) =>
      api("/auth/me/notifications", { method: "PATCH", body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notificationPrefs"] });
    },
  });
}

// ─── Company Settings ───────────────────────────────────────
interface CompanySettings {
  id: number;
  name: string;
  slug: string;
  address: string;
  taxNumber: string;
  website: string;
  currency: string;
  language: string;
  dateFormat: string;
  itemsPerPage: number;
}

export function useCompanySettings() {
  return useQuery({
    queryKey: ["companySettings"],
    queryFn: () => api<{ data: CompanySettings }>("/company"),
  });
}

export function useUpdateCompanySettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Omit<CompanySettings, "id" | "slug">>) =>
      api("/company", { method: "PATCH", body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companySettings"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}
