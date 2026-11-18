import { Trigger } from "@rn-primitives/select";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
  type Option,
} from "./ui/select";

import { Text } from "./ui/text";

interface SelectOption {
  value: string;
  label: string;
}

interface IProps {
  list: SelectOption[];
  defaultValue?: SelectOption;
  placeholder?: string;
  selectLabel: string;
  value?: string;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  disabled?: boolean;
  size?: "sm" | "default";
}

export default function SingleSelect({
  list,
  defaultValue,
  placeholder,
  selectLabel,
  value,
  onChange,
  onBlur,
  error,
  size = "default",
  disabled = false,
}: IProps) {
  const selectedOption: Option | undefined =
    list.find((item) => item.value === value) ??
    (value === undefined ? defaultValue : undefined);

  const isControlled = value !== undefined;

  return (
    <>
      <Select
        value={isControlled ? selectedOption : undefined}
        defaultValue={!isControlled ? defaultValue : undefined}
        onValueChange={(option) => {
          onChange?.(option?.value ?? "");
        }}
      >
        <SelectTrigger onBlur={onBlur} disabled={disabled ?? false} size={size}>
          <SelectValue
            placeholder={placeholder ?? ""}
            className="text-foreground text-base"
          />
        </SelectTrigger>

        <SelectContent size={size}>
          <SelectGroup>
            {size !== "sm" && (
              <SelectLabel className="text-center text-lg font-semibold">
                {selectLabel}
              </SelectLabel>
            )}

            {list.map((item) => (
              <SelectItem
                key={item.value}
                label={item.label}
                value={item.value}
              >
                {item.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>

      {error ? (
        <Text className="mt-1 text-sm text-red-600">{error}</Text>
      ) : null}
    </>
  );
}
