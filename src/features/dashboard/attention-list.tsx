"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import {
  listShipments,
  shipmentKeys,
} from "@/features/shipments/queries";
import { kdvKeys, listKdvWindow } from "@/features/tax/queries";
import { summarizeKdv } from "@/lib/ledger/kdv-summary";
import { usePartnersWithPendingReimbursements } from "@/features/partners/queries/pending-reimbursements";
import { useOverdueInstallments } from "@/features/real-estate/queries";

import {
  kdvUnfiledRule,
  oldPartnerReimbursementRule,
  realEstateOverdueRule,
  shipmentEtaPastDueRule,
  type AttentionItem,
  type AttentionSeverity,
} from "./attention-rules";

// 13 prior full months + current month. KDV rule iterates the previous 13
// full months per the 2026-04-25 dashboard scope.
const KDV_MONTHS = 14;

function severityClasses(severity: AttentionSeverity): string {
  if (severity === "red") {
    return "border-destructive/40 bg-destructive/5 hover:bg-destructive/10";
  }
  return "border-amber-500/40 bg-amber-500/5 hover:bg-amber-500/10";
}

function severityIconClass(severity: AttentionSeverity): string {
  return severity === "red" ? "text-destructive" : "text-amber-500";
}

function SeverityIcon({ severity }: { severity: AttentionSeverity }) {
  const Icon = severity === "red" ? AlertCircle : AlertTriangle;
  return <Icon className={cn("size-4 shrink-0", severityIconClass(severity))} />;
}

function AttentionRow({ item }: { item: AttentionItem }) {
  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 rounded-md border px-3 py-2 text-sm transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        severityClasses(item.severity),
      )}
    >
      <SeverityIcon severity={item.severity} />
      <span className="text-muted-foreground">{item.label}</span>
      <span className="text-foreground font-medium truncate">
        {item.entity}
      </span>
      <span className="ml-auto text-xs text-muted-foreground tabular-nums shrink-0">
        {item.age}
      </span>
    </Link>
  );
}

function ErrorRow({
  label,
  onRetry,
}: {
  label: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-muted-foreground/30 bg-muted/30 px-3 py-2 text-sm">
      <span className="text-muted-foreground">Couldn&apos;t check {label}</span>
      <Button size="sm" variant="outline" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

export function AttentionList() {
  const shipmentsQ = useQuery({
    queryKey: shipmentKeys.list(),
    queryFn: listShipments,
  });
  const kdvQ = useQuery({
    queryKey: kdvKeys.window(KDV_MONTHS),
    queryFn: () => listKdvWindow(KDV_MONTHS),
  });
  const partnersQ = usePartnersWithPendingReimbursements();
  const overdueRealEstate = useOverdueInstallments(7);

  const shipmentItems = useMemo<AttentionItem[]>(() => {
    if (!shipmentsQ.data) return [];
    return shipmentEtaPastDueRule(shipmentsQ.data);
  }, [shipmentsQ.data]);

  const kdvItems = useMemo<AttentionItem[]>(() => {
    if (!kdvQ.data) return [];
    const periods = summarizeKdv(kdvQ.data, KDV_MONTHS);
    return kdvUnfiledRule(periods);
  }, [kdvQ.data]);

  const partnerItems = useMemo<AttentionItem[]>(() => {
    if (!partnersQ.data) return [];
    return oldPartnerReimbursementRule(partnersQ.data);
  }, [partnersQ.data]);

  const realEstateItems = useMemo<AttentionItem[]>(
    () => realEstateOverdueRule(overdueRealEstate),
    [overdueRealEstate],
  );

  const isLoading =
    shipmentsQ.isLoading || kdvQ.isLoading || partnersQ.isLoading;

  const errorRows: React.ReactNode[] = [];
  if (shipmentsQ.isError) {
    errorRows.push(
      <ErrorRow
        key="err-shipments"
        label="shipments"
        onRetry={() => shipmentsQ.refetch()}
      />,
    );
  }
  if (kdvQ.isError) {
    errorRows.push(
      <ErrorRow key="err-kdv" label="KDV periods" onRetry={() => kdvQ.refetch()} />,
    );
  }
  if (partnersQ.isError) {
    errorRows.push(
      <ErrorRow
        key="err-partners"
        label="partner reimbursements"
        onRetry={() => partnersQ.refetch()}
      />,
    );
  }

  // Severity-grouped: red first, then amber. Stable id sort within each.
  const allItems = [
    ...shipmentItems,
    ...kdvItems,
    ...partnerItems,
    ...realEstateItems,
  ].sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === "red" ? -1 : 1;
    return a.id < b.id ? -1 : 1;
  });

  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold">Needs your attention</h2>
      {isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-3/4" />
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {errorRows}
          {allItems.map((it) => (
            <AttentionRow key={it.id} item={it} />
          ))}
          {errorRows.length === 0 && allItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing needs your attention right now.
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}
