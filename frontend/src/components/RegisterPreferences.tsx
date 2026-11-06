import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Text } from "@/components/ui/text";
import { MEAL_CATEGORIES, MIN_PREFERRED_MEALS } from "@/data";
import { cn } from "@/lib/utils";
import { RegisterFormValues } from "@/validations";
import { Check, Plus, X } from "lucide-react-native";
import * as React from "react";
import { useController, useFormContext } from "react-hook-form";
import { Pressable, View } from "react-native";

// Case/whitespace-insensitive comparison key
const normalize = (s: string) => s.trim().replace(/\s+/g, " ");
const keyOf = (s: string) => normalize(s).toLowerCase();

// key -> canonical label, so typing "grilled salmon" selects "Grilled salmon"
const CATALOG = new Map(
  MEAL_CATEGORIES.flatMap((c) => c.meals).map((m) => [keyOf(m), m]),
);

function MealChip({
  label,
  selected,
  removable,
  onPress,
}: {
  label: string;
  selected: boolean;
  removable?: boolean;
  onPress: () => void;
}) {
  const Icon = removable ? X : selected ? Check : Plus;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      className={cn(
        "flex-row items-center gap-2 rounded-full border px-3.5 py-2",
        selected
          ? "border-primary bg-primary"
          : "border-border bg-background active:bg-accent",
      )}
    >
      <Text
        className={cn(
          "text-sm font-semibold",
          selected && "text-primary-foreground",
        )}
      >
        {label}
      </Text>
      <Icon
        size={16}
        className={selected ? "text-primary-foreground" : "text-primary"}
      />
    </Pressable>
  );
}

const RegisterMealPreferences = ({
  list,
}: {
  list: "likedMeals" | "dislikedMeals";
}) => {
  const { control, trigger } = useFormContext<RegisterFormValues>();
  const {
    field: { value: rawValue, onChange },
    fieldState: { error },
  } = useController({ control, name: list });

  const [customText, setCustomText] = React.useState("");

  const value: string[] = rawValue ?? [];
  const selectedKeys = new Set(value.map(keyOf));
  // Anything selected that isn't in the catalog was typed by the user
  const customMeals = value.filter((v) => !CATALOG.has(keyOf(v)));

  function update(next: string[]) {
    onChange(next);
    // Once an error is showing, clear it as soon as the user fixes it
    if (error) trigger(list);
  }

  function toggle(meal: string) {
    update(
      selectedKeys.has(keyOf(meal))
        ? value.filter((v) => keyOf(v) !== keyOf(meal))
        : [...value, meal],
    );
  }

  function addCustom() {
    const name = normalize(customText);
    if (!name) return;
    const canonical = CATALOG.get(keyOf(name)) ?? name;
    if (!selectedKeys.has(keyOf(canonical))) update([...value, canonical]);
    setCustomText("");
  }

  const count = value.length;
  const remaining = Math.max(0, MIN_PREFERRED_MEALS - count);

  return (
    <View className="w-full gap-6">
      <View className="gap-1">
        <Text className="text-xl font-bold">
          What meals do you {list === "likedMeals" ? "like" : "dislike"}?
        </Text>
        <Text className="text-muted-foreground mb-3">
          {list === "likedMeals"
            ? `Select all the meals you like to be included in your meal recommendations.`
            : `Select all the meals you dislike and they will not be included in your meal recommendations.`}
        </Text>
        <Text className="text-muted-foreground">
          {remaining > 0
            ? `Pick at least ${remaining} more · ${count} selected`
            : `${count} selected · you're all set`}
        </Text>
        {error && (
          <Text className="text-red-700 font-medium">{error.message}</Text>
        )}
      </View>

      {MEAL_CATEGORIES.map((category) => (
        <View key={category.id} className="gap-3">
          <Text className="text-base font-bold">{category.title}</Text>
          <View className="flex-row flex-wrap gap-2">
            {category.meals.map((meal) => (
              <MealChip
                key={meal}
                label={meal}
                selected={selectedKeys.has(keyOf(meal))}
                onPress={() => toggle(meal)}
              />
            ))}
          </View>
        </View>
      ))}

      <View className="gap-3 border-t border-border pt-5">
        <Label htmlFor="custom-meal">Not on the list? Add your own</Label>

        {customMeals.length > 0 && (
          <View className="flex-row flex-wrap gap-2">
            {customMeals.map((meal) => (
              <MealChip
                key={meal}
                label={meal}
                selected
                removable
                onPress={() => toggle(meal)}
              />
            ))}
          </View>
        )}

        <View className="flex-row items-center gap-2">
          <Input
            id="custom-meal"
            className="flex-1"
            placeholder="e.g. Shakshuka"
            value={customText}
            onChangeText={setCustomText}
            onSubmitEditing={addCustom}
            maxLength={40}
            returnKeyType="done"
            submitBehavior="submit"
          />
          <Button onPress={addCustom} disabled={!normalize(customText)}>
            <Text>Add</Text>
          </Button>
        </View>
      </View>
    </View>
  );
};

export default RegisterMealPreferences;
