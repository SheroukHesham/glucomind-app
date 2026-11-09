import { TMedicationFrequency } from "@/types";
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

export interface MealItem {
  _id: string;
  item: string;
  calories: number;
}

export interface Meal {
  _id: string;
  title: string;
  estimated_cooking_time: string;
  items: MealItem[];
  instructions: string;
  total_calories: number;
  estimated_total_calories: number;
  calorie_percentage: number;
  beverages: string[];
  glucose_impact: string;
  nutritional_facts: string;
}

export interface DayPlan {
  breakfast: Meal;
  morning_snack: Meal;
  lunch: Meal;
  afternoon_snack: Meal;
  dinner: Meal;
}

export interface MealPlanSummary {
  total_day_calories: number;
  calorie_goal: number;
}

export interface MealPlan {
  _id: string;
  userId: string;
  day_plan: DayPlan;
  summary: MealPlanSummary;
  createdAt: string;
  __v: number;
}

export interface IMedication {
  _id: string;
  userId: string;
  frequency: TMedicationFrequency;
  name: string;
  time: string;
}
