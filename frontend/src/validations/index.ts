import * as yup from "yup";

export const loginSchema = yup.object({
  email: yup
    .string()
    .email("Please enter a valid email address")
    .required("Email is required"),
  password: yup.string().required("Password is Required"),
});

export type LoginFormValues = yup.InferType<typeof loginSchema>;

export const emergencyContactSchema = (existingEmails: string[]) =>
  yup.object({
    name: yup.string().trim().required("Name is required"),
    email: yup
      .string()
      .trim()
      .email("Enter a valid email")
      .required("Email is required")
      .test(
        "unique-email",
        "This email is already invited",
        (value) =>
          !value || !existingEmails.includes(value.trim().toLowerCase()),
      ),
  });

export const registerSchema = (existingEmails: string[]) =>
  loginSchema.concat(
    yup.object({
      username: yup
        .string()
        .min(2, "Username should be at least 2 characters")
        .required("Username is required"),
      gender: yup
        .string()
        .oneOf(["Male", "Female"])
        .defined()
        .required("Gender is Required"),
      age: yup.number().min(12, "You must be 12+").required("Age is Required"),
      dailyCalories: yup
        .number()
        .min(1200, "Daily Calories should be at least 1200")
        .required("Daily Calories is Required"),
      medicalConditions: yup.array().of(yup.string().required()),
      dietaryRestrictions: yup.array().of(yup.string().required()),
      emergencyContacts: yup
        .array()
        .of(emergencyContactSchema(existingEmails).required()),
      likedMeals: yup
        .array()
        .of(yup.string().required())
        .required("You must select the meals you like")
        .min(3, "Select at least 3 liked meals"),
      dislikedMeals: yup
        .array()
        .of(yup.string().required())
        .min(3, "Select at least 3 disliked meals")
        .required(),
    }),
  );

export type RegisterFormValues = yup.InferType<
  ReturnType<typeof registerSchema>
>;
