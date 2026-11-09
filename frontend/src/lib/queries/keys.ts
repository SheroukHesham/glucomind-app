export const recommenderKeys = {
  all: ["recommend"] as const,
  getUserMealPlan: (userId: string) =>
    [...recommenderKeys.all, "getUserMealPlan", userId] as const,
  //   byId: (id: number) => [...recommenderKeys.all, "byId", id] as const,
  //   groupedCategorySubcategory: () =>
  //     [...recommenderKeys.all, "getGroupedSubCat"] as const,
};

export const medicationKeys = {
  all: ["medication"] as const,
  getUserMedications: (userId: string) =>
    [...medicationKeys.all, "getUserMedications", userId] as const,
};
