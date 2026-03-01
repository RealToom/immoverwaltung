import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface BankAccount {
    id: number;
    name: string;
    iban: string;
    bic: string;
    balance: number;
    lastSync: string;
    status: "connected" | "error";
    companyId: number;
    createdAt: string;
    updatedAt: string;
}

export function useBankAccounts() {
    return useQuery({
        queryKey: ["bank-accounts"],
        queryFn: () => api<{ data: BankAccount[] }>(`/bank-accounts`).then((res) => res.data),
    });
}

export function useCreateBankAccount() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: { name: string; iban: string; bic?: string }) =>
            api<{ data: BankAccount }>(`/bank-accounts`, {
                method: "POST",
                body: data,
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
        },
    });
}

export function useDeleteBankAccount() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: number) =>
            api(`/bank-accounts/${id}`, {
                method: "DELETE",
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
        },
    });
}

export function useSyncBankAccount() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: number) =>
            api<{ data: BankAccount }>(`/bank-accounts/${id}/sync`, {
                method: "POST",
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
        },
    });
}

export interface CsvTransaction {
    date: string;
    description: string;
    amount: number;
    iban: string;
}

export function useImportTransactions() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (transactions: CsvTransaction[]) =>
            api<{ data: { imported: number } }>(`/bank-accounts/import`, {
                method: "POST",
                body: { transactions },
            }),
        onSuccess: () => {
            // Invalidate both bank accounts (balances might change) and finance queries (transactions added)
            queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
            queryClient.invalidateQueries({ queryKey: ["finance", "transactions"] });
            queryClient.invalidateQueries({ queryKey: ["finance", "summary"] });
        },
    });
}
