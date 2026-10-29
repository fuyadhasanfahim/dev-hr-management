"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface ComboboxOption {
  value: string;
  label: string;
  /** Secondary line shown under the label (e.g. an email, category, or note). */
  description?: string;
  /** When set, an avatar is shown before the label (in the list and on the trigger). */
  avatar?: { src?: string | null; fallback: string };
}

function OptionAvatar({ avatar }: { avatar: NonNullable<ComboboxOption["avatar"]> }) {
  return (
    <Avatar className="size-6 shrink-0">
      {avatar.src ? <AvatarImage src={avatar.src} alt="" /> : null}
      <AvatarFallback className="text-[10px]">{avatar.fallback}</AvatarFallback>
    </Avatar>
  );
}

export interface ComboboxProps {
  options: ComboboxOption[];
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  isLoading?: boolean;
  disabled?: boolean;
  className?: string;
  /**
   * Server-side search: called (as the user types) with the text so the caller can fetch matching options.
   * Turns off the built-in filtering, because `options` is then already the filtered list.
   */
  onSearchChange?: (query: string) => void;
  /** Label to show for `value` when it is not among `options` (e.g. a search moved it out of the list). */
  selectedLabel?: string;
}

/** Generic searchable single-select built on the shadcn Command + Popover primitives. */
export function Combobox({
  options,
  value,
  onChange,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  emptyText = "No results found.",
  isLoading = false,
  disabled = false,
  className,
  onSearchChange,
  selectedLabel,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen} modal={true}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal",
            !selected && !selectedLabel && "text-muted-foreground",
            className,
          )}
        >
          <span className="flex min-w-0 items-center gap-2">
            {selected?.avatar && <OptionAvatar avatar={selected.avatar} />}
            <span className="truncate">
            {isLoading && !selected && !selectedLabel ? "Loading…" : selected ? selected.label : selectedLabel || placeholder}
            </span>
          </span>
          {isLoading ? (
            <Loader2 className="ml-2 h-4 w-4 shrink-0 animate-spin opacity-50" />
          ) : (
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[280px] p-0" align="start">
        <Command shouldFilter={!onSearchChange}>
          <CommandInput placeholder={searchPlaceholder} onValueChange={onSearchChange} />
          <CommandList>
            <CommandEmpty>{isLoading ? "Searching…" : emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  keywords={[option.label, option.description || ""]}
                  onSelect={(currentValue) => {
                    const selectedOption = options.find((o) => o.value.toLowerCase() === currentValue) || option;
                    onChange(selectedOption.value === value ? "" : selectedOption.value);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "h-4 w-4 mr-2",
                      value === option.value ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {option.avatar && (
                    <span className="mr-2">
                      <OptionAvatar avatar={option.avatar} />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate">{option.label}</div>
                    {option.description && (
                      <div className="truncate text-xs text-muted-foreground">
                        {option.description}
                      </div>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
