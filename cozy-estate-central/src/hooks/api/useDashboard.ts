import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { LayoutItem } from "@/components/dashboard/types";

interface DashboardStats {
  properties: number;
  totalUnits: number;
  occupiedUnits: number;
  vacantUnits: number;
  tenants: number;
  monthlyRevenue: number;
  openTickets: number;
  urgentTickets: number;
  setupStatus: {
    smtpSet: boolean;
    nordigenSet: boolean;
    anthropicSet: boolean;
  };
}

export function useDashboardStats() {
  return useQuery({
    queryKey: ["dashboard", "stats"],
    queryFn: () => api<{ data: DashboardStats }>("/dashboard/stats"),
  });
}

// ─── Recent Activity ────────────────────────────────────────
export interface ActivityItem {
  type: "payment" | "tenant" | "maintenance";
  text: string;
  detail: string;
  time: string;
  createdAt: string;
}

export function useRecentActivity() {
  return useQuery({
    queryKey: ["dashboard", "recent-activity"],
    queryFn: () => api<{ data: ActivityItem[] }>("/dashboard/recent-activity"),
  });
}

// ─── Dashboard Layout ───────────────────────────────────────
export function useDashboardLayout() {
  return useQuery({
    queryKey: ["dashboard", "layout"],
    queryFn: () => api<{ data: LayoutItem[] }>("/dashboard/layout"),
  });
}

export function useSaveDashboardLayout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (widgets: LayoutItem[]) =>
      api<{ data: LayoutItem[] }>("/dashboard/layout", { method: "PUT", body: { widgets } }),
    onSuccess: (res) => {
      qc.setQueryData(["dashboard", "layout"], res);
    },
  });
}

// ─── Revenue Series ─────────────────────────────────────────
export interface RevenuePoint {
  month: string;
  label: string;
  total: number;
}

export function useRevenueSeries() {
  return useQuery({
    queryKey: ["dashboard", "revenue-series"],
    queryFn: () => api<{ data: RevenuePoint[] }>("/dashboard/revenue-series"),
  });
}

// ─── Expiring Energy Certificates ───────────────────────────
export interface ExpiringCertificate {
  id: number;
  propertyName: string;
  energyClass: string;
  validUntil: string;
}

export function useExpiringCertificates() {
  return useQuery({
    queryKey: ["dashboard", "expiring-certificates"],
    queryFn: () => api<{ data: ExpiringCertificate[] }>("/dashboard/expiring-certificates"),
  });
}
