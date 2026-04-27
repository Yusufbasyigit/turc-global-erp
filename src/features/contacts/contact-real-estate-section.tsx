"use client";

import { useMemo, useState } from "react";
import { ReceiptText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format-money";
import {
  useDealStatesForContact,
  type DealState,
} from "@/features/real-estate/queries";
import { DealCard } from "@/features/real-estate/deal-card";
import { DealFormDialog } from "@/features/real-estate/deal-form-dialog";
import {
  ReceiptFormDialog,
  type ReceiptPrefill,
} from "@/features/real-estate/receipt-form-dialog";

type CurrencyTotals = {
  currency: string;
  expected: number;
  paid: number;
  outstanding: number;
};

function totalsByCurrency(deals: DealState[]): CurrencyTotals[] {
  const map = new Map<string, CurrencyTotals>();
  for (const d of deals) {
    const cur = d.currency;
    const row =
      map.get(cur) ?? { currency: cur, expected: 0, paid: 0, outstanding: 0 };
    row.expected += d.allocation.total_expected;
    row.paid += d.allocation.total_paid;
    row.outstanding += d.allocation.total_outstanding;
    map.set(cur, row);
  }
  return Array.from(map.values()).sort((a, b) =>
    a.currency < b.currency ? -1 : 1,
  );
}

export function ContactRealEstateSection({
  contactId,
}: {
  contactId: string;
}) {
  const { data, isLoading } = useDealStatesForContact(contactId);
  const [editingDeal, setEditingDeal] = useState<DealState | null>(null);
  const [dealDialogOpen, setDealDialogOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptPrefill, setReceiptPrefill] = useState<ReceiptPrefill | null>(
    null,
  );

  const deals = data ?? [];
  const totals = useMemo(() => totalsByCurrency(deals), [deals]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Real Estate</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (deals.length === 0) return null;

  const openEditDeal = (deal: DealState) => {
    setEditingDeal(deal);
    setDealDialogOpen(true);
  };
  const openReceipt = (prefill: ReceiptPrefill | null) => {
    setReceiptPrefill(prefill);
    setReceiptOpen(true);
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between pb-3">
        <div>
          <CardTitle className="text-base">Real Estate</CardTitle>
          <p className="text-xs text-muted-foreground">
            Rent and sale agreements with this contact.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            openReceipt(deals.length === 1 ? { deal_id: deals[0].id } : null)
          }
        >
          <ReceiptText className="mr-2 size-4" />
          Record receipt
        </Button>
      </CardHeader>
      <CardContent className="space-y-4 pb-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {totals.map((t) => (
            <div key={t.currency} className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">{t.currency}</p>
              <div className="mt-1 grid grid-cols-3 gap-2 text-xs">
                <div>
                  <p className="text-muted-foreground">Expected</p>
                  <p className="mt-0.5 font-medium tabular-nums text-foreground">
                    {formatCurrency(t.expected, t.currency)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Paid</p>
                  <p className="mt-0.5 font-medium tabular-nums text-foreground">
                    {formatCurrency(t.paid, t.currency)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Outstanding</p>
                  <p
                    className={cn(
                      "mt-0.5 font-medium tabular-nums",
                      t.outstanding > 0.001
                        ? "text-amber-700"
                        : "text-foreground",
                    )}
                  >
                    {formatCurrency(t.outstanding, t.currency)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          {deals.map((d) => (
            <DealCard
              key={d.id}
              deal={d}
              onEdit={openEditDeal}
              onRecord={(deal) => openReceipt({ deal_id: deal.id })}
              showContactName={false}
            />
          ))}
        </div>
      </CardContent>

      <DealFormDialog
        open={dealDialogOpen}
        onOpenChange={setDealDialogOpen}
        deal={editingDeal}
      />
      <ReceiptFormDialog
        open={receiptOpen}
        onOpenChange={setReceiptOpen}
        deals={deals}
        prefill={receiptPrefill}
      />
    </Card>
  );
}
