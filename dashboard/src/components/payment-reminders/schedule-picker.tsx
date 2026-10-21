"use client";

import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { ScheduleOption } from "@/redux/features/paymentReminder/paymentReminderApi";

export interface ScheduleChoice {
  option: ScheduleOption;
  date?: Date;
}

const OPTIONS: { value: Exclude<ScheduleOption, "custom">; label: string }[] = [
  { value: "instant", label: "Now" },
  { value: "3d", label: "In 3 days" },
  { value: "7d", label: "In 7 days" },
];

/** Now / 3 days / 7 days / pick-a-date chooser shared by the popup and the page. */
export function SchedulePicker({
  value,
  onChange,
}: {
  value?: ScheduleChoice;
  onChange: (v: ScheduleChoice) => void;
}) {
  const today = new Date(new Date().setHours(0, 0, 0, 0));
  return (
    <div className="flex flex-wrap gap-2">
      {OPTIONS.map((o) => (
        <Button
          key={o.value}
          type="button"
          size="sm"
          variant={value?.option === o.value ? "default" : "outline"}
          aria-pressed={value?.option === o.value}
          onClick={() => onChange({ option: o.value })}
        >
          {o.label}
        </Button>
      ))}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            size="sm"
            variant={value?.option === "custom" ? "default" : "outline"}
            aria-pressed={value?.option === "custom"}
          >
            <CalendarIcon className="size-4" />
            {value?.option === "custom" && value.date
              ? format(value.date, "dd MMM yyyy")
              : "Pick a date"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={value?.date}
            onSelect={(d) => d && onChange({ option: "custom", date: d })}
            disabled={{ before: today }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

export const toScheduleItem = (id: string, c: ScheduleChoice) => ({
  id,
  option: c.option,
  ...(c.option === "custom" && c.date ? { date: c.date.toISOString() } : {}),
});
