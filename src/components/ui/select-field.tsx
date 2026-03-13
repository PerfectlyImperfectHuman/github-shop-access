import * as Select from "@radix-ui/react-select";
import { ChevronDown, ChevronUp, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
  sublabel?: string;
  disabled?: boolean;
}

interface SelectFieldProps {
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  emptyLabel?: string;
}

// Radix UI Select does not allow empty string "" as an item value —
// it reserves "" to mean "nothing selected / show placeholder".
// We use this sentinel to represent the "All / clear" option internally.
const EMPTY_SENTINEL = "__ALL__";
const toRadix = (v: string) => (v === "" ? EMPTY_SENTINEL : v);
const fromRadix = (v: string) => (v === EMPTY_SENTINEL ? "" : v);

export function SelectField({
  value,
  onValueChange,
  options,
  placeholder = "Select...",
  className,
  disabled,
}: SelectFieldProps) {
  return (
    <Select.Root
      value={toRadix(value)}
      onValueChange={(v) => onValueChange(fromRadix(v))}
      disabled={disabled}
    >
      <Select.Trigger
        className={cn(
          "flex items-center justify-between gap-2 w-full px-4 py-2.5 rounded-lg border border-input bg-background text-sm transition-all duration-150 outline-none",
          "hover:border-ring/50 focus:ring-2 focus:ring-ring focus:ring-offset-0",
          "data-[placeholder]:text-muted-foreground",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          !value && "text-muted-foreground",
          className
        )}
      >
        <Select.Value placeholder={placeholder} />
        <Select.Icon asChild>
          <ChevronDown className="w-4 h-4 opacity-50 shrink-0" />
        </Select.Icon>
      </Select.Trigger>

      <Select.Portal>
        <Select.Content
          position="popper"
          sideOffset={6}
          align="start"
          className="z-[200] min-w-[var(--radix-select-trigger-width)] rounded-xl border border-border bg-card shadow-xl overflow-hidden"
          style={{ maxHeight: "min(var(--radix-select-content-available-height, 280px), 280px)" }}
        >
          <Select.ScrollUpButton className="flex items-center justify-center h-7 bg-card text-muted-foreground border-b border-border">
            <ChevronUp className="w-4 h-4" />
          </Select.ScrollUpButton>

          <Select.Viewport className="p-1.5 overflow-y-auto" style={{ maxHeight: "240px" }}>
            {options.map((opt) => (
              <Select.Item
                key={opt.value === "" ? EMPTY_SENTINEL : opt.value}
                value={toRadix(opt.value)}
                disabled={opt.disabled}
                className={cn(
                  "relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm cursor-pointer select-none outline-none transition-colors",
                  "hover:bg-accent focus:bg-accent",
                  "data-[disabled]:opacity-40 data-[disabled]:cursor-not-allowed",
                  "text-card-foreground"
                )}
              >
                <div className="flex-1 min-w-0 pr-6">
                  <Select.ItemText>
                    <span className="font-medium block truncate">{opt.label}</span>
                  </Select.ItemText>
                  {opt.sublabel && (
                    <span className="text-xs text-muted-foreground block mt-0.5">{opt.sublabel}</span>
                  )}
                </div>
                <Select.ItemIndicator className="absolute right-3">
                  <Check className="w-4 h-4 text-primary" />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>

          <Select.ScrollDownButton className="flex items-center justify-center h-7 bg-card text-muted-foreground border-t border-border">
            <ChevronDown className="w-4 h-4" />
          </Select.ScrollDownButton>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
