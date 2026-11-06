import { RegisterFormValues } from "@/validations";
import { UseFormReturn } from "react-hook-form";
import { KeyboardTypeOptions } from "react-native";

export interface IEmergency {
  name: string;
  email: string;
  fcmTokens?: string[];
}

export interface IMedications {
  id: string;
  name: string;
  frequency: string;
  time: string;
}

export interface IUser {
  fcmTokens?: string;
  username: string;
  email: string;
  password: string;
  age: number;
  gender: "Male" | "Female";
  dailyCalories: number;
  dietaryRestrictions: string[];
  medicalConditions: string[];
  likedMeals: string[];
  dislikedMeals: string[];
  emergencyContacts: IEmergency[];
  medications: IMedications[];
}

export interface IRegistrationForm {
  username: string;
  email: string;
  password: string;
  age: string;
  gender: "Male" | "Female";
  dailyCalories: number;
  dietaryRestrictions: string[];
  medicalConditions: string[];
  likedMeals: string[];
  dislikedMeals: string[];
  emergencyContacts: IEmergency[];
  medications: IMedications[];
}

export interface IRegisterStepProps {
  form: UseFormReturn<RegisterFormValues>;
  onNext?: () => void;
}

export interface IRegisterGeneral {
  id: string;
  placeholder: string;
  label: string;
  keyboard?: KeyboardTypeOptions;
  autocomplete?: string;
}

export interface IRegisterInfo extends IRegisterGeneral {
  name: "username" | "email" | "password";
}

export interface IRegisterMedicalData extends IRegisterGeneral {
  name: "age" | "dailyCalories";
}

export interface IEmergencyInfo extends IRegisterGeneral {
  name: "name" | "email";
}

export interface MedicalCondition {
  id: string;
  label: string;
  category: string;
}

export interface DietaryRestriction {
  id: string;
  label: string;
  category: string;
  isAllergy?: boolean;
}
