import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";

export type SubscriptionStatus = "TRIAL" | "ACTIVE" | "PAST_DUE" | "CANCELED" | "MANUAL";
export type PlanType = "TRIAL" | "PRO" | "BUSINESS";

export interface BillingStatus {
  subscriptionStatus: SubscriptionStatus;
  planType: PlanType;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  manualOverride: boolean;
}

export function useBillingStatus(options?: { refetchInterval?: number | false }) {
  return useQuery<{ data: BillingStatus }>({
    queryKey: ["billing", "status"],
    queryFn: () => api("/billing/status"),
    staleTime: 30_000,
    refetchInterval: options?.refetchInterval ?? false,
  });
}

export function useCreateCheckout() {
  return useMutation({
    mutationFn: (plan: "PRO" | "BUSINESS") =>
      api<{ data: { url: string } }>("/billing/checkout", {
        method: "POST",
        body: { plan },
      }),
  });
}

export function useCreatePortalSession() {
  return useMutation({
    mutationFn: () =>
      api<{ data: { url: string } }>("/billing/portal", { method: "POST" }),
  });
}
