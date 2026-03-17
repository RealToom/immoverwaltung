import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface AuditLogItem {
  id: number;
  action: string;
  userId: number | null;
  ip: string | null;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface AuditLogFilters {
  page?: number;
  limit?: number;
  action?: string;
  from?: string;
  to?: string;
}

interface PaginatedResponse<T> {
  data: T[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export function useAuditLogs(filters: AuditLogFilters = {}) {
  return useQuery({
    queryKey: ["auditLogs", filters],
    queryFn: () =>
      api<PaginatedResponse<AuditLogItem>>("/audit-logs", { params: filters }),
  });
}
