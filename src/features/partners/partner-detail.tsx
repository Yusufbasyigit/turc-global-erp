"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { summarizePartnerReimbursements } from "./queries/partner-reimbursement-summary";
import {
  listTransactionsForPartner,
  partnerDetailKeys,
} from "./queries/partner-transactions";
import { getPartner, partnerKeys } from "./queries";
import { PartnerDetailHeader } from "./partner-detail-header";
import { PartnerActivitySums } from "./partner-activity-sums";
import { PartnerPendingReimbursementsCard } from "./partner-pending-reimbursements-card";
import { PartnerLedgerSection } from "./partner-ledger-section";
import { PartnerFormDialog } from "./partner-form-dialog";

export function PartnerDetail({ partnerId }: { partnerId: string }) {
  const [editOpen, setEditOpen] = useState(false);

  const partnerQ = useQuery({
    queryKey: partnerKeys.detail(partnerId),
    queryFn: () => getPartner(partnerId),
  });

  const txnQ = useQuery({
    queryKey: partnerDetailKeys.transactions(partnerId),
    queryFn: () => listTransactionsForPartner(partnerId),
  });

  const rows = useMemo(() => txnQ.data ?? [], [txnQ.data]);

  const reimbursements = useMemo(
    () => summarizePartnerReimbursements(rows),
    [rows],
  );

  const earliestActivity = useMemo(() => {
    if (rows.length === 0) return null;
    return rows[0].transaction_date;
  }, [rows]);

  if (partnerQ.isLoading || txnQ.isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (partnerQ.isError) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
        Failed to load partner: {(partnerQ.error as Error).message}
      </div>
    );
  }

  if (!partnerQ.data) {
    return (
      <div className="space-y-4">
        <Link
          href="/partners"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to partners
        </Link>
        <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
          This partner does not exist or was deleted.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PartnerDetailHeader
        partner={partnerQ.data}
        earliestActivity={earliestActivity}
        onEdit={() => setEditOpen(true)}
      />

      <PartnerActivitySums rows={rows} />

      <PartnerPendingReimbursementsCard
        partnerId={partnerId}
        result={reimbursements}
      />

      <PartnerLedgerSection rows={rows} />

      <PartnerFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        partnerId={partnerId}
      />
    </div>
  );
}
