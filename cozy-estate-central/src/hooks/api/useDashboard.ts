import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

interface DashboardStats {
  properties: number;
  totalUnits: number;
  occupiedUnits: number;
  vacantUnits: number;
  tenants: number;
  monthlyRevenue: number;
  openTickets: number;
  urgentTickets: number;
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
