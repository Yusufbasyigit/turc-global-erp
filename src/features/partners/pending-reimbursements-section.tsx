"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Receipt, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency as formatMoney } from "@/lib/format-money";
import {
  usePartnersWithPendingReimbursements,
  type PartnerPendingCurrency,
  type PartnerPendingSummary,
} from "./queries/pending-reimbursements";

export function PendingReimbursementsSection() {
  const router = useRouter();
  const { data, isLoading, isError, error } =
    usePartnersWithPendingReimbursements();

  const logExpense = () => {
    const params = new URLSearchParams({
      action: "new",
      kind: "expense",
      paid_by: "partner",
    });
    router.push(`/transactions?${params.toString()}`);
  };

  return (
    <section className="rounded-xl border bg-card">
      <header className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            Pending reimbursements
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Out-of-pocket expenses each partner is still owed.
          </p>
        </div>
        <Button onClick={logExpense} variant="outline" size="sm">
          <Receipt className="mr-2 size-4" />
          Log partner expense
        </Button>
      </header>

      <div className="px-4 py-2">
        {isLoading ? (
          <div className="space-y-2 py-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : isError ? (
          <div className="my-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            Failed to load pending reimbursements:{" "}
            {(error as Error).message}
          </div>
        ) : !data || data.length === 0 ? (
          <p className="py-3 text-sm text-muted-foreground">
            No pending reimbursements. When a partner covers an expense out of
            pocket, it&apos;ll appear here.
          </p>
        ) : (
          <ul className="divide-y">
            {data.map((row) => (
              <PendingPartnerRows key={row.partner.id} row={row} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function PendingPartnerRows({ row }: { row: PartnerPendingSummary }) {
  return (
    <>
      {row.pending.map((p, idx) => (
        <PendingRow
          key={`${row.partner.id}-${p.currency}`}
          partnerId={row.partner.id}
          partnerName={row.partner.name}
          pending={p}
          showName={idx === 0}
        />
      ))}
    </>
  );
}

function PendingRow({
  partnerId,
  partnerName,
  pending,
  showName,
}: {
  partnerId: string;
  partnerName: string;
  pending: PartnerPendingCurrency;
  showName: boolean;
}) {
  const router = useRouter();
  const pay = () => {
    const params = new URLSearchParams({
      action: "new",
      kind: "partner_loan_out",
      partner_id: partnerId,
      currency: pending.currency,
      amount: pending.amount.toFixed(2),
    });
    router.push(`/transactions?${params.toString()}`);
  };

  return (
    <li className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="flex flex-1 items-baseline gap-3 min-w-0">
        {showName ? (
          <Link
            href={`/partners/${partnerId}`}
            className="text-sm font-medium hover:underline truncate"
          >
            {partnerName}
          </Link>
        ) : (
          <span className="text-sm text-muted-foreground/60">↳</span>
        )}
        <span className="text-lg font-semibold tabular-nums">
          {formatMoney(pending.amount, pending.currency)}
        </span>
        <span className="text-sm text-muted-foreground">
          {pending.claim_count} claim
          {pending.claim_count === 1 ? "" : "s"}
        </span>
      </div>
      <Button onClick={pay} size="sm">
        <Wallet className="mr-2 size-4" />
        Pay reimbursements
      </Button>
    </li>
  );
}
