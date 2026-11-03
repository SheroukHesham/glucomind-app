import { REGISTER_INFO } from "@/data";
import { RegisterFormValues } from "@/validations";
import { Controller, useFormContext } from "react-hook-form";
import { View } from "react-native";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Text } from "./ui/text";

const RegisterAccountInfo = () => {
  const { control } = useFormContext<RegisterFormValues>();

  const renderInformation = REGISTER_INFO.map((input, idx) => {
    return (
      <View className="gap-1.5" key={idx}>
        <Label htmlFor={input.id}>{input.label}</Label>
        {input.id === "password" ? (
          <>
            <Controller
              control={control}
              render={({
                field: { onChange, onBlur, value },
                fieldState: { error },
              }) => (
                <>
                  <Input
                    id={input.id}
                    placeholder={input.placeholder}
                    keyboardType={input.keyboard}
                    secureTextEntry
                    //   onSubmitEditing={onSubmitEditing}
                    returnKeyType="next"
                    submitBehavior="submit"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                  />
                  {error && (
                    <Text className="text-red-700 font-medium">
                      {input.label} is required.
                    </Text>
                  )}
                </>
              )}
              name={input.name}
            />
          </>
        ) : (
          <>
            <Controller
              control={control}
              render={({
                field: { onChange, onBlur, value },
                fieldState: { error },
              }) => (
                <>
                  <Input
                    id={input.id}
                    placeholder={input.placeholder}
                    keyboardType={input.keyboard}
                    //   onSubmitEditing={onSubmitEditing}
                    returnKeyType="next"
                    submitBehavior="submit"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                  />
                  {error && (
                    <Text className="text-red-700 font-medium">
                      {input.label} is required.
                    </Text>
                  )}
                </>
              )}
              name={input.name}
            />
          </>
        )}
      </View>
    );
  });

  return <View className="flex-col gap-y-5">{renderInformation}</View>;
};

export default RegisterAccountInfo;
