"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { shiftYearMonth } from "@/lib/proforma/istanbul-date";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function periodLabel(period: string): string {
  const [y, m] = period.split("-").map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

export function ProfitLossMonthPicker({
  value,
  onChange,
  anchor,
  count = 24,
}: {
  value: string;
  onChange: (v: string) => void;
  anchor: string;
  count?: number;
}) {
  const periods: string[] = [];
  for (let i = 0; i < count; i += 1) {
    periods.push(shiftYearMonth(anchor, -i));
  }
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[220px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {periods.map((p) => (
          <SelectItem key={p} value={p}>
            {periodLabel(p)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
