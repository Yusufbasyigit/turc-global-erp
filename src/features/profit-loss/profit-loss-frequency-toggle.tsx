"use client";

import { Button } from "@/components/ui/button";

export type Frequency = "month" | "quarter" | "year";

const OPTIONS: { value: Frequency; label: string }[] = [
  { value: "month", label: "Monthly" },
  { value: "quarter", label: "Quarterly" },
  { value: "year", label: "Annual" },
];

export function ProfitLossFrequencyToggle({
  value,
  onChange,
}: {
  value: Frequency;
  onChange: (v: Frequency) => void;
}) {
  return (
    <div className="inline-flex items-center gap-1.5">
      {OPTIONS.map((opt) => (
        <Button
          key={opt.value}
          size="sm"
          variant={value === opt.value ? "default" : "outline"}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </Button>
      ))}
    </div>
  );
}
