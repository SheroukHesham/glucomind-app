import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getUserMedications,
  getMedicationDetails,
  addUpdateMedication,
} from "@/api/medications";
import { medicationKeys } from "./keys";
import { IMedication } from "@/interfaces";
import Toast from "react-native-toast-message";

export function useMedications(userId: string) {
  return useQuery({
    queryKey: medicationKeys.getUserMedications(userId),
    queryFn: () => getUserMedications(userId),
    enabled: !!userId,
  });
}

export function useGetMedicationDetails(userId: string, medicationId: string) {
  return useQuery({
    queryKey: medicationKeys.getMedicationDetails(userId, medicationId),
    queryFn: () => getMedicationDetails(userId, medicationId),
    enabled: !!userId && !!medicationId,
  });
}

export function useUpdateMedication(userId: string, medicationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (medication: IMedication) =>
      addUpdateMedication(userId, medication),

    onSuccess: async () => {
      Toast.show({
        type: "success",
        text1: "Medication Updated Successfully.",
      });
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: medicationKeys.getUserMedications(userId),
        }),
        queryClient.invalidateQueries({
          queryKey: medicationKeys.getMedicationDetails(userId, medicationId),
        }),
      ]);
    },
  });
}
