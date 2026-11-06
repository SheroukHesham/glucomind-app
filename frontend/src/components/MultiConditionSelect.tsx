import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Text } from "@/components/ui/text";
import * as PopoverPrimitive from "@rn-primitives/popover";
import { useFocusEffect } from "expo-router";
import { ChevronDown, TriangleAlert, X } from "lucide-react-native";
import * as React from "react";
import { Pressable, ScrollView, View } from "react-native";

export type SelectableItem = {
  id: string;
  label: string;
  category: string;
  isAllergy?: boolean;
};

export function MultiConditionSelect({
  label,
  placeholder,
  items,
  categories,
  value,
  onChange,
  noneOptionId = "none",
  otherOptionId = "other",
}: {
  label: string;
  placeholder: string;
  items: SelectableItem[];
  categories: readonly string[];
  value: string[];
  onChange: (next: string[]) => void;
  noneOptionId?: string;
  otherOptionId?: string;
}) {
  const [search, setSearch] = React.useState("");
  const [otherText, setOtherText] = React.useState("");
  const triggerRef = React.useRef<PopoverPrimitive.TriggerRef>(null);

  const filtered = items.filter((c) =>
    c.label.toLowerCase().includes(search.toLowerCase()),
  );

  useFocusEffect(
    React.useCallback(() => {
      return () => {
        triggerRef.current?.close();
      };
    }, []),
  );

  React.useEffect(() => {
    return () => {
      triggerRef.current?.close();
    };
  }, []);

  function toggle(id: string) {
    if (id === noneOptionId) {
      onChange(value.includes(noneOptionId) ? [] : [noneOptionId]);
      return;
    }
    const withoutNone = value.filter((v) => v !== noneOptionId);
    onChange(
      withoutNone.includes(id)
        ? withoutNone.filter((v) => v !== id)
        : [...withoutNone, id],
    );
  }

  function removeBadge(id: string) {
    onChange(value.filter((v) => v !== id));
  }

  function labelFor(id: string) {
    if (id === noneOptionId) return "None";
    if (id === otherOptionId) return otherText || "Other";
    return items.find((c) => c.id === id)?.label ?? id;
  }

  const isAllergy = (id: string) => items.find((c) => c.id === id)?.isAllergy;

  return (
    <View className="gap-2">
      <Label>{label}</Label>

      {value.length > 0 && (
        <View className="flex-row flex-wrap gap-2">
          {value.map((id) => (
            <Badge
              key={id}
              variant={isAllergy(id) ? "destructive" : "secondary"}
              className="flex-row items-center gap-1 pr-1"
            >
              {isAllergy(id) && <TriangleAlert size={11} />}
              <Text className="text-xs">{labelFor(id)}</Text>
              <Pressable onPress={() => removeBadge(id)} hitSlop={8}>
                <X size={12} />
              </Pressable>
            </Badge>
          ))}
        </View>
      )}

      <Popover>
        <PopoverTrigger asChild ref={triggerRef}>
          <Pressable className="flex-row items-center justify-between rounded-md border border-input bg-background px-3 py-2.5 w-full">
            <Text className="text-muted-foreground">
              {value.length > 0 ? `${value.length} selected` : placeholder}
            </Text>
            <ChevronDown size={16} className="text-muted-foreground" />
          </Pressable>
        </PopoverTrigger>

        <PopoverContent className="w-80 p-0">
          <View className="p-2 border-b border-border">
            <Input
              placeholder="Search..."
              value={search}
              onChangeText={setSearch}
            />
          </View>

          <ScrollView className="max-h-96">
            {/* <Pressable
              onPress={() => toggle(noneOptionId)}
              className="flex-row items-center gap-3 px-3 py-2.5 border-b border-border"
            >
              <Checkbox
                checked={value.includes(noneOptionId)}
                onCheckedChange={() => toggle(noneOptionId)}
              />
              <Text className="font-medium">None of the above</Text>
            </Pressable> */}

            {categories.map((category) => {
              const group = filtered.filter((c) => c.category === category);
              if (group.length === 0) return null;
              return (
                <View key={category}>
                  <Text className="px-3 pt-3 pb-1 text-xs font-semibold text-muted-foreground uppercase">
                    {category}
                  </Text>
                  {group.map((item) => (
                    <Pressable
                      key={item.id}
                      onPress={() => toggle(item.id)}
                      className="flex-row items-center gap-3 px-3 py-2.5"
                    >
                      <Checkbox
                        checked={value.includes(item.id)}
                        onCheckedChange={() => toggle(item.id)}
                      />
                      <Text className="flex-1">{item.label}</Text>
                      {item.isAllergy && (
                        <TriangleAlert size={14} className="text-destructive" />
                      )}
                    </Pressable>
                  ))}
                </View>
              );
            })}

            <View className="px-3 py-2.5 gap-2">
              <Pressable
                onPress={() => toggle(otherOptionId)}
                className="flex-row items-center gap-3"
              >
                <Checkbox
                  checked={value.includes(otherOptionId)}
                  onCheckedChange={() => toggle(otherOptionId)}
                />
                <Text>Other</Text>
              </Pressable>
              {value.includes(otherOptionId) && (
                <Input
                  placeholder="Please specify"
                  value={otherText}
                  onChangeText={setOtherText}
                />
              )}
            </View>
          </ScrollView>
        </PopoverContent>
      </Popover>
    </View>
  );
}
