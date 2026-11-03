import {
  DIETARY_RESTRICTION_CATEGORIES,
  DIETARY_RESTRICTIONS,
  MEDICAL_CONDITION_CATEGORIES,
  MEDICAL_CONDITIONS,
  REGISTER_MEDICAL_DATA,
} from "@/data";
import { RegisterFormValues } from "@/validations";
import { Controller, useFormContext } from "react-hook-form";
import { View } from "react-native";
import { MultiConditionSelect } from "./MultiConditionSelect";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { Text } from "./ui/text";

const RegisterMedicalProfile = () => {
  const { control } = useFormContext<RegisterFormValues>();

  const renderInformation = REGISTER_MEDICAL_DATA.map((input, idx) => {
    return (
      <View className="gap-1.5" key={idx}>
        <Label htmlFor={input.id}>{input.label}</Label>

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
                submitBehavior="submit"
                returnKeyType="next"
                value={
                  value !== undefined && value !== null ? String(value) : ""
                }

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
      </View>
    );
  });
  return (
    <View className="flex-col gap-y-5">
      <Label>Gender</Label>
      <Controller
        control={control}
        render={({ field: { onChange, onBlur, value } }) => (
          <RadioGroup
            value={value}
            onValueChange={onChange}
            onBlur={onBlur}
            className=" mt-3 flex flex-row justify-between items-center px-16"
          >
            <View className="flex flex-row items-center gap-3">
              <RadioGroupItem value="Male" id="r1" />
              <Label htmlFor="r2">Male</Label>
            </View>
            <View className="flex flex-row items-center gap-3">
              <RadioGroupItem value="Female" id="r2" />
              <Label htmlFor="r3">Female</Label>
            </View>
          </RadioGroup>
        )}
        name={"gender"}
      />
      {renderInformation}

      <Controller
        control={control}
        render={({
          field: { onChange, value, onBlur },
          fieldState: { error },
        }) => (
          <MultiConditionSelect
            label="Dietary Restrictions"
            placeholder="Select restrictions"
            items={DIETARY_RESTRICTIONS}
            categories={DIETARY_RESTRICTION_CATEGORIES}
            value={value || []}
            onChange={onChange}
          />
        )}
        name="dietaryRestrictions"
      />
      <Controller
        control={control}
        render={({
          field: { onChange, value, onBlur },
          fieldState: { error },
        }) => (
          <MultiConditionSelect
            label="Other Medical Conditions"
            placeholder="Select conditions"
            items={MEDICAL_CONDITIONS}
            categories={MEDICAL_CONDITION_CATEGORIES}
            value={value || []}
            onChange={onChange}
          />
        )}
        name="medicalConditions"
      />
    </View>
  );
};

export default RegisterMedicalProfile;
