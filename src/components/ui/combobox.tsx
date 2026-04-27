"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export type ComboboxItem = {
  value: string;
  label: string;
};

type ComboboxProps = {
  items: ComboboxItem[];
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  onCreate?: (label: string) => Promise<void> | void;
  createLabel?: (query: string) => string;
  disabled?: boolean;
  className?: string;
  clearable?: boolean;
  id?: string;
};

export function Combobox({
  items,
  value,
  onChange,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  emptyMessage = "No results.",
  onCreate,
  createLabel = (q) => `Create "${q}"`,
  disabled,
  className,
  clearable = true,
  id,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [creating, setCreating] = React.useState(false);

  const selectedLabel = React.useMemo(
    () => items.find((i) => i.value === value)?.label ?? "",
    [items, value],
  );

  const trimmedQuery = query.trim();
  const showCreate =
    !!onCreate &&
    trimmedQuery.length > 0 &&
    !items.some(
      (i) => i.label.toLowerCase() === trimmedQuery.toLowerCase(),
    );

  const handleCreate = async () => {
    if (!onCreate || creating) return;
    try {
      setCreating(true);
      await onCreate(trimmedQuery);
      setQuery("");
      setOpen(false);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal",
            !selectedLabel && "text-muted-foreground",
            className,
          )}
        >
          <span className="truncate">{selectedLabel || placeholder}</span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-(--radix-popover-trigger-width) p-0"
        align="start"
      >
        <Command
          filter={(value, search) => {
            if (!search) return 1;
            return value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
          }}
        >
          <CommandInput
            placeholder={searchPlaceholder}
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            {items.length > 0 && (
              <CommandGroup>
                {items.map((item) => (
                  <CommandItem
                    key={item.value}
                    value={`${item.label} ${item.value}`}
                    onSelect={() => {
                      onChange(item.value === value ? null : item.value);
                      setOpen(false);
                    }}
                    data-checked={item.value === value}
                  >
                    <span className="truncate">{item.label}</span>
                    <Check
                      className={cn(
                        "ml-auto size-4 shrink-0",
                        item.value === value ? "opacity-100" : "opacity-0",
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {showCreate && (
              <CommandGroup>
                <CommandItem
                  value={`__create__${trimmedQuery}`}
                  onSelect={handleCreate}
                  disabled={creating}
                >
                  <Plus className="size-4" />
                  <span className="truncate">
                    {createLabel(trimmedQuery)}
                  </span>
                </CommandItem>
              </CommandGroup>
            )}
            {clearable && value && (
              <CommandGroup>
                <CommandItem
                  value="__clear__"
                  onSelect={() => {
                    onChange(null);
                    setOpen(false);
                  }}
                >
                  <span className="text-muted-foreground">Clear selection</span>
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
