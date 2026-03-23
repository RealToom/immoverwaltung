import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface EnergyPassport {
  id: number;
  certificateType: "VERBRAUCH" | "BEDARF";
  energyClass: string;
  primaryEnergyDemand: number | null;
  finalEnergyDemand: number | null;
  energyCarrier: string | null;
  issuedAt: string;
  validUntil: string;
  certificateNumber: string | null;
  propertyId: number;
}

export interface UnitConsumption {
  unitId: number;
  unitNumber: string;
  consumption: {
    STROM: number[];
    GAS: number[];
    WASSER: number[];
    WAERME: number[];
  };
}

export interface ConsumptionData {
  year: number;
  units: UnitConsumption[];
}

export function useConsumption(propertyId: number | null, year: number) {
  return useQuery({
    queryKey: ["consumption", propertyId, year],
    queryFn: () =>
      api<{ data: ConsumptionData }>("/energy/consumption", {
        params: { propertyId: propertyId!, year },
      }).then((r) => r.data),
    enabled: !!propertyId,
    staleTime: 60_000,
  });
}

export function useEnergyPassport(propertyId: number | null) {
  return useQuery({
    queryKey: ["energyPassport", propertyId],
    queryFn: () =>
      api<{ data: EnergyPassport | null }>(`/energy/passport/${propertyId}`).then((r) => r.data),
    enabled: !!propertyId,
  });
}

export function useUpsertEnergyPassport(propertyId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<EnergyPassport, "id" | "propertyId">) =>
      api<{ data: EnergyPassport }>(`/energy/passport/${propertyId}`, {
        method: "PUT",
        body: data,
      }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["energyPassport", propertyId] });
    },
  });
}
