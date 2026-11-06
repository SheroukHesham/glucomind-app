import ProgressBar from "@/components/ProgressBar";
import RegisterAccountInfo from "@/components/RegisterAccountInfo";
import RegisterEmergencyContacts from "@/components/RegisterEmergencyContacts";
import RegisterMedicalProfile from "@/components/RegisterMedicalProfile";
import RegisterPreferences from "@/components/RegisterPreferences";
import { Button } from "@/components/ui/button";
import { defaultUser, STEP_FIELDS } from "@/data";
import { IEmergency } from "@/interfaces";
import { RegisterFormValues, registerSchema } from "@/validations";
import { yupResolver } from "@hookform/resolvers/yup";
import { useMemo, useRef, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Index() {
  const TOTAL_STEPS = 5;
  const [step, setStep] = useState(1);
  const [emergencyContacts, setEmergencyContacts] = useState<IEmergency[]>([]);
  const scrollViewRef = useRef<ScrollView>(null);

  const existingEmails = useMemo(
    () => emergencyContacts.map((c) => c.email.trim().toLowerCase()),
    [emergencyContacts],
  );

  const schema = useMemo(
    () => registerSchema(existingEmails),
    [existingEmails],
  );

  const form = useForm<RegisterFormValues>({
    resolver: yupResolver(schema),
    mode: "onTouched",
    defaultValues: { ...defaultUser, age: undefined },
  });

  const isNavigating = useRef(false);

  async function handleNext() {
    if (isNavigating.current) return;
    isNavigating.current = true;
    try {
      const valid = await form.trigger(STEP_FIELDS[step]);
      if (valid) {
        form.clearErrors(STEP_FIELDS[step + 1]);
        setStep((s) => s + 1);
      }
    } finally {
      isNavigating.current = false;
      handleScrollToTop();
    }
  }

  const handleScrollToTop = () => {
    scrollViewRef.current?.scrollTo({
      x: 0,
      y: 0,
    });
  };

  const {
    formState: { isValidating, isSubmitting },
  } = form;

  const NavigationButtons = () => {
    return (
      <View className="flex-row flex w-full justify-between">
        <Button
          variant={"ghost"}
          onPress={() => {
            setStep((s) => s - 1);
            handleScrollToTop();
          }}
          disabled={step == 1}
        >
          <Text className="">Back </Text>
        </Button>

        {step < TOTAL_STEPS ? (
          <Button
            onPress={handleNext}
            disabled={isValidating}
            className="w-fit"
          >
            <Text className="text-primary-foreground font-semibold ">
              {isValidating ? "Checking..." : "Next"}
            </Text>
          </Button>
        ) : (
          <Button
            onPress={form.handleSubmit(onFinalSubmit)}
            disabled={isSubmitting}
          >
            <Text className="text-primary-foreground font-semibold ">
              {isSubmitting ? "Submitting..." : "Confirm and Register"}
            </Text>
          </Button>
        )}
      </View>
    );
  };

  const onFinalSubmit = (data: RegisterFormValues) => {
    console.log(data);
  };

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return <RegisterAccountInfo />;
      case 2:
        return <RegisterMedicalProfile />;
      case 3:
        return <RegisterPreferences list="likedMeals" />;
      case 4:
        return <RegisterPreferences list="dislikedMeals" />;
      case 5:
        return (
          <RegisterEmergencyContacts
            emergencyContacts={emergencyContacts}
            setEmergencyContacts={setEmergencyContacts}
          />
        );
      default:
        return null;
    }
  };

  return (
    <FormProvider {...form}>
      <SafeAreaView className="flex-1">
        <ScrollView
          ref={scrollViewRef}
          className="flex-1"
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          contentContainerClassName="grow gap-y-10 px-4 py-6"
        >
          {/* <View className="w-full flex-row justify-center  ">
            <Text className="text-foreground font-semibold text-2xl text-">
              Register
            </Text>
          </View> */}

          <View className="w-full">
            <ProgressBar TOTAL_STEPS={TOTAL_STEPS} current={step} />
          </View>

          <View className="w-full max-w-md self-center">
            {renderStepContent()}
          </View>

          <View className="w-full max-w-md self-center">
            {NavigationButtons()}
          </View>
        </ScrollView>
      </SafeAreaView>
    </FormProvider>
  );
}
