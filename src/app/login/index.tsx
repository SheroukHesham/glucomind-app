import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Text } from "@/components/ui/text";
import { LoginFormValues, loginSchema } from "@/validations";
import { yupResolver } from "@hookform/resolvers/yup";
import { router } from "expo-router";
import { useRef } from "react";
import { Controller, FormProvider, useForm } from "react-hook-form";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Index() {
  const form = useForm<LoginFormValues>({
    resolver: yupResolver(loginSchema),
    mode: "onTouched",
    defaultValues: { email: "", password: "" },
  });

  const passwordRef = useRef(null);

  const onSubmit = (data: LoginFormValues) => {
    console.log(data);

    router.push("/(tabs)");
  };

  return (
    <FormProvider {...form}>
      <SafeAreaView className="flex-1">
        <ScrollView
          className="flex-1"
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          contentContainerClassName="grow gap-y-10 px-4 py-6"
        >
          <View className="w-full max-w-md self-center gap-y-5">
            <Text className="text-foreground font-semibold text-center text-xl mb-10">
              Login
            </Text>
            <View className="flex-col gap-y-2">
              <Label htmlFor="email">Email</Label>
              <Controller
                control={form.control}
                render={({
                  field: { onChange, onBlur, value },
                  fieldState: { error },
                }) => (
                  <>
                    <Input
                      id="email"
                      placeholder="Enter your email"
                      keyboardType="email-address"
                      onSubmitEditing={() => {
                        passwordRef.current?.focus();
                      }}
                      returnKeyType="next"
                      submitBehavior="submit"
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                    />
                    {error && (
                      <Text className="text-red-700 font-medium">
                        {error.message}
                      </Text>
                    )}
                  </>
                )}
                name="email"
              />
            </View>
            <View className="flex-col gap-y-2">
              <Label htmlFor="password">Password</Label>
              <Controller
                control={form.control}
                render={({
                  field: { onChange, onBlur, value },
                  fieldState: { error },
                }) => (
                  <>
                    <Input
                      ref={passwordRef}
                      id="password"
                      placeholder="Enter your password"
                      keyboardType="default"
                      secureTextEntry
                      returnKeyType="next"
                      submitBehavior="submit"
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                    />
                    {error && (
                      <Text className="text-red-700 font-medium">
                        {error.message}
                      </Text>
                    )}
                  </>
                )}
                name="password"
              />
            </View>
          </View>

          <View className="flex-row items-center self-center gap-x-none">
            <Text className="text-foreground">Don't have an account? </Text>
            <Button variant={"link"} className="p-0">
              <Text className="text">Register</Text>
            </Button>
          </View>

          <View className="w-full max-w-md self-center">
            <Button onPress={form.handleSubmit(onSubmit)} className="shadow-md">
              <Text>Login</Text>
            </Button>
          </View>
        </ScrollView>
      </SafeAreaView>
    </FormProvider>
  );
}
