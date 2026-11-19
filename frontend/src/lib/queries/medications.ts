import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getUserMedications,
  getMedicationDetails,
  addUpdateMedication,
  deleteMedication,
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

export function useGetMedicationDetails(
  userId: string,
  medicationId: string,
  enabled = true,
) {
  return useQuery({
    queryKey: medicationKeys.getMedicationDetails(userId, medicationId),
    queryFn: () => getMedicationDetails(userId, medicationId),
    enabled: !!userId && !!medicationId && enabled,
  });
}

export function useUpdateMedication(userId: string, medicationId?: string) {
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

export function useDeleteMedication(userId: string, medicationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => deleteMedication(userId, medicationId),

    onSuccess: async () => {
      Toast.show({
        type: "success",
        text1: "Medication Deleted Successfully.",
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
