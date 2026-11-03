import { REGISTER_EMERGENCY_INFO } from "@/data";
import { IEmergency } from "@/interfaces";
import {
  EmergencyContactFormValues,
  emergencyContactSchema,
} from "@/validations";
import { yupResolver } from "@hookform/resolvers/yup";
import { Plus, X } from "lucide-react-native";
import { Dispatch, SetStateAction, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Pressable, View } from "react-native";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Text } from "./ui/text";

interface IProps {
  emergencyContacts: IEmergency[];
  setEmergencyContacts: Dispatch<SetStateAction<IEmergency[]>>;
}

const RegisterEmergencyContacts = ({
  emergencyContacts,
  setEmergencyContacts,
}: IProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);

  const existingEmails = useMemo(
    () => emergencyContacts.map((c) => c.email.trim().toLowerCase()),
    [emergencyContacts],
  );

  const schema = useMemo(
    () => emergencyContactSchema(existingEmails),
    [existingEmails],
  );

  // Local form for the dialog only (separate from the registration form)
  const { handleSubmit, control, reset } = useForm<EmergencyContactFormValues>({
    resolver: yupResolver(schema),
    mode: "onChange",
    defaultValues: { name: "", email: "" },
  });

  function onSaveContact(data: EmergencyContactFormValues) {
    setEmergencyContacts((prev) => [
      ...prev,
      {
        ...data,
        email: data.email.trim().toLowerCase(),
        fcmTokens: [],
      },
    ]);
    reset();
    setDialogOpen(false);
  }

  function removeContact(email: string) {
    setEmergencyContacts((prev) => prev.filter((c) => c.email !== email));
  }

  const renderEmergencyInformation = REGISTER_EMERGENCY_INFO.map((input) => (
    <View key={input.id} className="gap-3">
      <Label htmlFor={input.id}>{input.label}</Label>
      <Controller
        name={input.name}
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
              value={value ?? ""}
              onChangeText={onChange}
              onBlur={onBlur}
            />
            {error && (
              <Text className="text-red-700 font-medium">{error.message}</Text>
            )}
          </>
        )}
      />
    </View>
  ));

  return (
    <View className="w-full min-w-sm gap-3">
      <Label>Emergency Contacts</Label>

      {emergencyContacts.length > 0 && (
        <View className="gap-2">
          {emergencyContacts.map((contact) => (
            <View
              key={contact.email}
              className="flex-row items-center justify-between border border-gray-300 rounded-md px-3 py-2 gap-x-2"
            >
              <Text>
                {contact.name} · {contact.email}
              </Text>
              <Pressable
                onPress={() => removeContact(contact.email)}
                hitSlop={8}
              >
                <X size={16} />
              </Pressable>
            </View>
          ))}
        </View>
      )}

      <Dialog
        open={dialogOpen}
        onOpenChange={(value) => {
          setDialogOpen(value);
          reset();
        }}
      >
        <DialogTrigger>
          <View className=" shadow shadow-primary/10 mt-5 flex flex-row gap-1.5 items-center justify-center border border-gray-300 rounded-md px-3 py-2">
            <Plus size={18} />
            <Text>Invite a Follower</Text>
          </View>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enter the Follower Data</DialogTitle>
            <DialogDescription>
              This contact will be notified in case of emergencies!
            </DialogDescription>
            {renderEmergencyInformation}
          </DialogHeader>
          <DialogFooter>
            <Button className="w-full" onPress={handleSubmit(onSaveContact)}>
              <Text className="text-white">Save</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </View>
  );
};

export default RegisterEmergencyContacts;
