import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface CalendarEvent {
  id: string | number;
  title: string;
  start: string;
  end?: string | null;
  allDay: boolean;
  type: "MANUELL" | "AUTO_VERTRAG" | "AUTO_WARTUNG" | "AUTO_MIETE" | "AUTO_EMAIL";
  color?: string;
  sourceId?: number;
  description?: string;
}

export function useCalendarEvents(from?: Date, to?: Date) {
  return useQuery({
    queryKey: ["calendar-events", from?.toISOString(), to?.toISOString()],
    queryFn: () => api<{ data: CalendarEvent[] }>("/calendar", {
      params: { from: from?.toISOString(), to: to?.toISOString() },
    }),
  });
}

export function useCreateCalendarEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api("/calendar", { method: "POST", body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["calendar-events"] }),
  });
}

export function useUpdateCalendarEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number } & Record<string, unknown>) =>
      api(`/calendar/${id}`, { method: "PATCH", body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["calendar-events"] }),
  });
}

export function useDeleteCalendarEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api(`/calendar/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["calendar-events"] }),
  });
}
