import {
  DietaryRestriction,
  IEmergencyInfo,
  IRegisterInfo,
  IRegisterMedicalData,
  IUser,
  MedicalCondition,
} from "@/interfaces";
import { RegisterFormValues } from "@/validations";

export const defaultUser: IUser = {
  email: "",
  username: "",
  password: "",
  age: 0,
  dailyCalories: 1500,
  dietaryRestrictions: [],
  medicalConditions: [],
  likedMeals: [],
  dislikedMeals: [],
  emergencyContacts: [],
  gender: "Male",
  medications: [],
};

export const STEP_FIELDS: Record<number, (keyof RegisterFormValues)[]> = {
  1: ["username", "email", "password"],
  2: [
    "age",
    "gender",
    "dailyCalories",
    "dietaryRestrictions",
    "medicalConditions",
  ],
  3: ["likedMeals"],
  4: ["dislikedMeals"],
  5: ["emergencyContacts"],
};

export const REGISTER_INFO: IRegisterInfo[] = [
  {
    id: "username",
    placeholder: "Enter your username",
    name: "username",
    label: "Username",
  },
  {
    id: "email",
    placeholder: "Enter your email address",
    keyboard: "email-address",
    name: "email",
    label: "Email",
    autocomplete: "email",
  },
  {
    id: "password",
    placeholder: "Enter your password",
    name: "password",
    label: "Password",
  },
];

export const REGISTER_MEDICAL_DATA: IRegisterMedicalData[] = [
  {
    id: "age",
    placeholder: "Enter your age",
    name: "age",
    label: "Age",
    keyboard: "numeric",
  },
  {
    id: "daily_calories",
    placeholder: "Enter your daily calories",
    name: "dailyCalories",
    label: "Daily Calories",
    keyboard: "numeric",
  },
];

export const REGISTER_EMERGENCY_INFO: IEmergencyInfo[] = [
  {
    id: "name",
    placeholder: "Enter the name of your follower",
    name: "name",
    label: "Name",
  },

  {
    id: "email",
    placeholder: "Enter the email of your follower",
    name: "email",
    label: "Email",
    keyboard: "email-address",
  },
];

export const MEDICAL_CONDITION_CATEGORIES = [
  "Cardiovascular",
  "Kidney",
  "Eyes & Nerves",
  "Endocrine & Metabolic",
  "Respiratory",
  "Digestive",
  "Mental Health",
  "Musculoskeletal & Autoimmune",
  "Other",
] as const;

export const MEDICAL_CONDITIONS: MedicalCondition[] = [
  // Cardiovascular
  {
    id: "hypertension",
    label: "High Blood Pressure (Hypertension)",
    category: "Cardiovascular",
  },
  {
    id: "dyslipidemia",
    label: "High Cholesterol (Dyslipidemia)",
    category: "Cardiovascular",
  },
  {
    id: "coronary_artery_disease",
    label: "Coronary Artery Disease",
    category: "Cardiovascular",
  },
  { id: "heart_failure", label: "Heart Failure", category: "Cardiovascular" },
  {
    id: "stroke_history",
    label: "History of Stroke / TIA",
    category: "Cardiovascular",
  },
  {
    id: "peripheral_vascular_disease",
    label: "Peripheral Vascular Disease",
    category: "Cardiovascular",
  },
  {
    id: "arrhythmia",
    label: "Irregular Heartbeat (Arrhythmia)",
    category: "Cardiovascular",
  },

  // Kidney
  { id: "ckd", label: "Chronic Kidney Disease", category: "Kidney" },
  {
    id: "diabetic_nephropathy",
    label: "Diabetic Kidney Disease (Nephropathy)",
    category: "Kidney",
  },
  { id: "kidney_stones", label: "Kidney Stones", category: "Kidney" },

  // Eyes & Nerves
  {
    id: "diabetic_retinopathy",
    label: "Diabetic Retinopathy",
    category: "Eyes & Nerves",
  },
  {
    id: "diabetic_neuropathy",
    label: "Diabetic Neuropathy",
    category: "Eyes & Nerves",
  },
  { id: "glaucoma", label: "Glaucoma", category: "Eyes & Nerves" },
  { id: "cataracts", label: "Cataracts", category: "Eyes & Nerves" },

  // Endocrine & Metabolic
  { id: "obesity", label: "Obesity", category: "Endocrine & Metabolic" },
  {
    id: "hypothyroidism",
    label: "Underactive Thyroid (Hypothyroidism)",
    category: "Endocrine & Metabolic",
  },
  {
    id: "hyperthyroidism",
    label: "Overactive Thyroid (Hyperthyroidism)",
    category: "Endocrine & Metabolic",
  },
  {
    id: "pcos",
    label: "Polycystic Ovary Syndrome (PCOS)",
    category: "Endocrine & Metabolic",
  },
  {
    id: "fatty_liver",
    label: "Fatty Liver Disease",
    category: "Endocrine & Metabolic",
  },

  // Respiratory
  { id: "asthma", label: "Asthma", category: "Respiratory" },
  { id: "copd", label: "COPD", category: "Respiratory" },
  { id: "sleep_apnea", label: "Sleep Apnea", category: "Respiratory" },

  // Digestive
  { id: "gastroparesis", label: "Gastroparesis", category: "Digestive" },
  { id: "celiac_disease", label: "Celiac Disease", category: "Digestive" },
  { id: "ibs", label: "Irritable Bowel Syndrome (IBS)", category: "Digestive" },
  {
    id: "pancreatitis_history",
    label: "History of Pancreatitis",
    category: "Digestive",
  },

  // Mental Health
  { id: "depression", label: "Depression", category: "Mental Health" },
  { id: "anxiety", label: "Anxiety Disorder", category: "Mental Health" },
  {
    id: "eating_disorder",
    label: "Eating Disorder",
    category: "Mental Health",
  },

  // Musculoskeletal & Autoimmune
  {
    id: "rheumatoid_arthritis",
    label: "Rheumatoid Arthritis",
    category: "Musculoskeletal & Autoimmune",
  },
  {
    id: "osteoarthritis",
    label: "Osteoarthritis",
    category: "Musculoskeletal & Autoimmune",
  },
  {
    id: "osteoporosis",
    label: "Osteoporosis",
    category: "Musculoskeletal & Autoimmune",
  },
  { id: "lupus", label: "Lupus", category: "Musculoskeletal & Autoimmune" },

  // Other
  { id: "cancer_history", label: "History of Cancer", category: "Other" },
  { id: "hiv", label: "HIV", category: "Other" },
  { id: "hepatitis", label: "Hepatitis (B or C)", category: "Other" },
];

export const NONE_OPTION_ID = "none";
export const OTHER_OPTION_ID = "other";

export const DIETARY_RESTRICTION_CATEGORIES = [
  "Food Allergies",
  "Intolerances",
  "Diet Type",
  "Medically Restricted",
] as const;

export const DIETARY_RESTRICTIONS: DietaryRestriction[] = [
  // Food Allergies (safety-critical — flagged separately)
  {
    id: "peanut_allergy",
    label: "Peanuts",
    category: "Food Allergies",
    isAllergy: true,
  },
  {
    id: "tree_nut_allergy",
    label: "Tree Nuts",
    category: "Food Allergies",
    isAllergy: true,
  },
  {
    id: "shellfish_allergy",
    label: "Shellfish",
    category: "Food Allergies",
    isAllergy: true,
  },
  {
    id: "fish_allergy",
    label: "Fish",
    category: "Food Allergies",
    isAllergy: true,
  },
  {
    id: "egg_allergy",
    label: "Eggs",
    category: "Food Allergies",
    isAllergy: true,
  },
  {
    id: "milk_allergy",
    label: "Milk / Dairy",
    category: "Food Allergies",
    isAllergy: true,
  },
  {
    id: "soy_allergy",
    label: "Soy",
    category: "Food Allergies",
    isAllergy: true,
  },
  {
    id: "wheat_allergy",
    label: "Wheat",
    category: "Food Allergies",
    isAllergy: true,
  },
  {
    id: "sesame_allergy",
    label: "Sesame",
    category: "Food Allergies",
    isAllergy: true,
  },

  // Intolerances (uncomfortable, not life-threatening)
  {
    id: "lactose_intolerance",
    label: "Lactose Intolerance",
    category: "Intolerances",
  },
  {
    id: "gluten_intolerance",
    label: "Gluten Sensitivity (non-Celiac)",
    category: "Intolerances",
  },
  {
    id: "fructose_intolerance",
    label: "Fructose Intolerance",
    category: "Intolerances",
  },
  {
    id: "histamine_intolerance",
    label: "Histamine Intolerance",
    category: "Intolerances",
  },
  {
    id: "fodmap_sensitivity",
    label: "FODMAP Sensitivity",
    category: "Intolerances",
  },

  // Diet Type (lifestyle / ethical / religious)
  { id: "vegetarian", label: "Vegetarian", category: "Diet Type" },
  { id: "vegan", label: "Vegan", category: "Diet Type" },
  { id: "pescatarian", label: "Pescatarian", category: "Diet Type" },
  { id: "halal", label: "Halal", category: "Diet Type" },
  { id: "kosher", label: "Kosher", category: "Diet Type" },
  { id: "no_pork", label: "No Pork", category: "Diet Type" },
  { id: "no_beef", label: "No Beef", category: "Diet Type" },

  // Medically Restricted (relevant to diabetes / comorbidity management)
  {
    id: "low_carb",
    label: "Low-Carbohydrate Diet",
    category: "Medically Restricted",
  },
  {
    id: "low_sodium",
    label: "Low-Sodium Diet",
    category: "Medically Restricted",
  },
  {
    id: "low_potassium",
    label: "Low-Potassium Diet (Renal)",
    category: "Medically Restricted",
  },
  {
    id: "low_phosphorus",
    label: "Low-Phosphorus Diet (Renal)",
    category: "Medically Restricted",
  },
  { id: "low_fat", label: "Low-Fat Diet", category: "Medically Restricted" },
  {
    id: "celiac_gluten_free",
    label: "Gluten-Free (Celiac)",
    category: "Medically Restricted",
  },
  {
    id: "low_fodmap_medical",
    label: "Low-FODMAP (IBS-directed)",
    category: "Medically Restricted",
  },
  {
    id: "soft_diet",
    label: "Soft / Easy-to-Chew Diet",
    category: "Medically Restricted",
  },
];

export const NONE_DIETARY_OPTION_ID = "none";
export const OTHER_DIETARY_OPTION_ID = "other";

export type MealCategory = {
  id: string;
  title: string;
  meals: string[];
};

export const MIN_PREFERRED_MEALS = 3;

export const MEAL_CATEGORIES: MealCategory[] = [
  {
    id: "breakfast",
    title: "Breakfast",
    meals: [
      "Oatmeal with berries",
      "Scrambled eggs",
      "Greek yogurt parfait",
      "Avocado toast",
      "Veggie omelette",
      "Chia pudding",
      "Whole-grain pancakes",
    ],
  },
  {
    id: "poultry-meat",
    title: "Poultry & Meat",
    meals: [
      "Grilled chicken breast",
      "Chicken stir-fry",
      "Turkey meatballs",
      "Lean beef steak",
      "Chicken curry",
      "Lamb kebab",
      "Stuffed bell peppers",
    ],
  },
  {
    id: "seafood",
    title: "Seafood",
    meals: [
      "Grilled salmon",
      "Baked cod",
      "Tuna salad",
      "Shrimp skewers",
      "Sardines on toast",
      "Fish tacos",
    ],
  },
  {
    id: "vegetarian",
    title: "Vegetarian",
    meals: [
      "Lentil soup",
      "Chickpea curry",
      "Falafel bowl",
      "Veggie stir-fry",
      "Stuffed eggplant",
      "Tofu scramble",
      "Black bean burrito bowl",
    ],
  },
  {
    id: "salads-bowls",
    title: "Salads & Bowls",
    meals: [
      "Greek salad",
      "Quinoa bowl",
      "Caesar salad with chicken",
      "Cauliflower rice bowl",
      "Mediterranean bowl",
    ],
  },
  {
    id: "snacks",
    title: "Snacks",
    meals: [
      "Mixed nuts",
      "Hummus with veggies",
      "Apple with peanut butter",
      "Hard-boiled eggs",
      "Cottage cheese",
      "Roasted chickpeas",
    ],
  },
];
