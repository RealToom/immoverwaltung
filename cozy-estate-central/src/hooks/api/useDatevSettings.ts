import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface DatevSettings {
  beraternummer: number | null;
  mandantennummer: number | null;
  kontenrahmen: "SKR03" | "SKR04";
  defaultBankAccount: string | null;
  defaultIncomeAccount: string | null;
  defaultExpenseAccount: string | null;
  fiscalYearStart: number;
}

export function useDatevSettings() {
  return useQuery<DatevSettings>({
    queryKey: ["datev", "settings"],
    queryFn: async () => {
      const res = await api<{ data: DatevSettings }>("/finance/datev/settings");
      return res.data;
    },
  });
}

export function useUpdateDatevSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<DatevSettings>) =>
      api("/finance/datev/settings", { method: "PUT", body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["datev", "settings"] }),
  });
}
