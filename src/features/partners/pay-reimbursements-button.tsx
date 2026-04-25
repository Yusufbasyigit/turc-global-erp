"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export type PayableCurrency = {
  currency: string;
  outstanding: number;
};

export function PayReimbursementsButton({
  partnerId,
  payable,
}: {
  partnerId: string;
  payable: PayableCurrency[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  if (payable.length === 0) return null;

  const go = (currency: string, amount: number) => {
    const params = new URLSearchParams({
      action: "new",
      kind: "partner_loan_out",
      partner_id: partnerId,
      currency,
      amount: amount.toFixed(2),
    });
    router.push(`/transactions?${params.toString()}`);
  };

  if (payable.length === 1) {
    const only = payable[0];
    return (
      <Button onClick={() => go(only.currency, only.outstanding)}>
        <Wallet className="mr-2 size-4" />
        Pay reimbursements
      </Button>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button>
          <Wallet className="mr-2 size-4" />
          Pay reimbursements
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-2">
        <p className="px-2 pb-2 text-xs text-muted-foreground">
          Pay which currency?
        </p>
        <div className="flex flex-col gap-1">
          {payable.map((p) => (
            <button
              key={p.currency}
              type="button"
              onClick={() => {
                setOpen(false);
                go(p.currency, p.outstanding);
              }}
              className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-muted"
            >
              <span>{p.currency}</span>
              <span className="font-medium tabular-nums">
                {p.outstanding.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
