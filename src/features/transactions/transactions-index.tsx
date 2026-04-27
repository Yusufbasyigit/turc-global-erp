"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Link2,
  Paperclip,
  Pencil,
  Plus,
  Receipt,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format-money";
import { formatDateOnly } from "@/lib/format-date";
import type {
  AccountWithCustody,
  TransactionKind,
} from "@/lib/supabase/types";
import { TRANSACTION_KINDS } from "@/lib/supabase/types";
import { CONTACT_TYPE_BADGE_CLASSES } from "@/lib/constants";

import {
  TRANSACTION_KIND_BADGE_CLASSES,
  TRANSACTION_KIND_LABELS,
} from "./constants";
import {
  attachmentSignedUrl,
  listSupplierContacts,
  listTransactions,
  transactionKeys,
  type TransactionWithRelations,
} from "./queries";
import { listAccountsWithCustody, treasuryKeys } from "@/features/treasury/queries";
import {
  TransactionFormDialog,
  type TransactionPrefill,
} from "./transaction-form-dialog";

const PARTNER_BADGE_CLASSES =
  "border-transparent bg-violet-500/15 text-violet-800 hover:bg-violet-500/25";

type GroupBy = "flat" | "kind" | "month";

function monthKey(dateStr: string): string {
  return dateStr.slice(0, 7);
}

function counterpartyLabel(t: TransactionWithRelations): string {
  if (t.contacts?.company_name) return t.contacts.company_name;
  if (t.partners?.name) return t.partners.name;
  return "—";
}

function formatDateShort(dateStr: string): string {
  return formatDateOnly(dateStr);
}

function formatMoney(amount: number | string | null, currency: string): string {
  const n = typeof amount === "string" ? Number(amount) : amount;
  if (n == null || !Number.isFinite(n)) return "—";
  return formatCurrency(n, currency);
}

export function TransactionsIndex() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] =
    useState<TransactionWithRelations | null>(null);
  const [prefill, setPrefill] = useState<TransactionPrefill | null>(null);
  const prefillConsumedRef = useRef(false);
  const [kindFilter, setKindFilter] = useState<Set<TransactionKind>>(
    () => new Set(),
  );
  const [kindFilterOpen, setKindFilterOpen] = useState(false);
  const [supplierFilter, setSupplierFilter] = useState<string | null>(null);
  const [supplierFilterOpen, setSupplierFilterOpen] = useState(false);
  const [groupBy, setGroupBy] = useState<GroupBy>("flat");
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const txnQ = useQuery({
    queryKey: transactionKeys.list(),
    queryFn: listTransactions,
  });
  const accountsQ = useQuery({
    queryKey: treasuryKeys.accounts(),
    queryFn: listAccountsWithCustody,
  });
  const suppliersQ = useQuery({
    queryKey: transactionKeys.supplierContacts(),
    queryFn: listSupplierContacts,
  });

  const accounts: AccountWithCustody[] = accountsQ.data ?? [];
  const suppliers = suppliersQ.data ?? [];
  const transactions = useMemo(() => txnQ.data ?? [], [txnQ.data]);

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (
        kindFilter.size > 0 &&
        !kindFilter.has(t.kind as TransactionKind)
      )
        return false;
      if (supplierFilter) {
        if (
          t.contacts?.type !== "supplier" ||
          t.contact_id !== supplierFilter
        )
          return false;
      }
      return true;
    });
  }, [transactions, kindFilter, supplierFilter]);

  const supplierFilterLabel = useMemo(() => {
    if (!supplierFilter) return "All suppliers";
    const match = suppliers.find((s) => s.id === supplierFilter);
    return match?.company_name ?? "Unknown supplier";
  }, [supplierFilter, suppliers]);

  const kindFilterLabel = useMemo(() => {
    if (kindFilter.size === 0) return "All kinds";
    if (kindFilter.size === 1) {
      const only = Array.from(kindFilter)[0];
      return TRANSACTION_KIND_LABELS[only] ?? only;
    }
    return `${kindFilter.size} kinds`;
  }, [kindFilter]);

  const toggleKind = (k: TransactionKind) => {
    setKindFilter((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  const jumpToRow = (id: string) => {
    const el = document.getElementById(`txn-${id}`);
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    setHighlightedId(id);
    if (highlightTimer.current) clearTimeout(highlightTimer.current);
    highlightTimer.current = setTimeout(() => {
      setHighlightedId(null);
    }, 1600);
  };

  const groups = useMemo(() => {
    if (groupBy === "flat") return [{ title: null, rows: filtered }];
    if (groupBy === "kind") {
      const map = new Map<string, TransactionWithRelations[]>();
      for (const t of filtered) {
        const arr = map.get(t.kind) ?? [];
        arr.push(t);
        map.set(t.kind, arr);
      }
      return Array.from(map.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([kind, rows]) => ({
          title:
            TRANSACTION_KIND_LABELS[kind as TransactionKind] ?? kind,
          rows,
        }));
    }
    const map = new Map<string, TransactionWithRelations[]>();
    for (const t of filtered) {
      const key = monthKey(t.transaction_date);
      const arr = map.get(key) ?? [];
      arr.push(t);
      map.set(key, arr);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([k, rows]) => ({ title: k, rows }));
  }, [filtered, groupBy]);

  const loading = txnQ.isLoading || accountsQ.isLoading;

  useEffect(() => {
    if (prefillConsumedRef.current) return;
    const action = searchParams.get("action");
    if (action === "edit") {
      const id = searchParams.get("id");
      if (!id || transactions.length === 0) return;
      const match = transactions.find((t) => t.id === id);
      if (!match) return;
      prefillConsumedRef.current = true;
      setEditing(match);
      setPrefill(null);
      setFormOpen(true);
      router.replace("/transactions", { scroll: false });
      return;
    }
    if (action !== "new") return;
    const kind = searchParams.get("kind") as TransactionKind | null;
    const partnerId = searchParams.get("partner_id");
    const contactId = searchParams.get("contact_id");
    const currency = searchParams.get("currency");
    const amountStr = searchParams.get("amount");
    const amount = amountStr != null ? Number(amountStr) : undefined;
    const kdvPeriodRaw = searchParams.get("kdv_period");
    const kdvPeriod =
      kdvPeriodRaw && /^\d{4}-(0[1-9]|1[0-2])$/.test(kdvPeriodRaw)
        ? kdvPeriodRaw
        : null;
    const refPlaceholder = searchParams.get("reference_number_placeholder");
    const paidByRaw = searchParams.get("paid_by");
    const paidBy =
      paidByRaw === "partner" || paidByRaw === "business" ? paidByRaw : null;
    const next: TransactionPrefill = {
      ...(kind ? { kind } : {}),
      ...(partnerId ? { partner_id: partnerId } : {}),
      ...(contactId ? { contact_id: contactId } : {}),
      ...(currency ? { currency } : {}),
      ...(amount != null && Number.isFinite(amount) ? { amount } : {}),
      ...(kdvPeriod ? { kdv_period: kdvPeriod } : {}),
      ...(refPlaceholder ? { reference_number_placeholder: refPlaceholder } : {}),
      ...(paidBy ? { paid_by: paidBy } : {}),
    };
    if (Object.keys(next).length === 0) return;
    prefillConsumedRef.current = true;
    setPrefill(next);
    setEditing(null);
    setFormOpen(true);
    router.replace("/transactions", { scroll: false });
  }, [searchParams, router, transactions]);

  const openNew = () => {
    setEditing(null);
    setPrefill(null);
    setFormOpen(true);
  };

  const openEdit = (t: TransactionWithRelations) => {
    setEditing(t);
    setFormOpen(true);
  };

  const openAttachment = async (path: string) => {
    const url = await attachmentSignedUrl(path, 600);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <TooltipProvider delayDuration={150}>
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Transactions</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Client payments, expenses, and other economic events.
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="mr-2 size-4" /> Record transaction
        </Button>
      </header>

      <div className="flex flex-wrap items-center gap-2 border-y py-3">
        <label className="text-xs text-muted-foreground">Kind</label>
        <Popover open={kindFilterOpen} onOpenChange={setKindFilterOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-md border bg-background px-2 py-1 text-xs hover:bg-muted/50"
            >
              <span>{kindFilterLabel}</span>
              <ChevronDown className="size-3 text-muted-foreground" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-60 p-0">
            <Command>
              <CommandInput placeholder="Search kinds…" />
              <CommandList>
                <CommandEmpty>No kinds match.</CommandEmpty>
                <CommandGroup>
                  {TRANSACTION_KINDS.map((k) => {
                    const checked = kindFilter.has(k);
                    return (
                      <CommandItem
                        key={k}
                        value={TRANSACTION_KIND_LABELS[k] ?? k}
                        onSelect={() => toggleKind(k)}
                      >
                        <div
                          className={cn(
                            "mr-2 flex size-4 items-center justify-center rounded border",
                            checked
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border",
                          )}
                        >
                          {checked ? <Check className="size-3" /> : null}
                        </div>
                        {TRANSACTION_KIND_LABELS[k] ?? k}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
              {kindFilter.size > 0 ? (
                <div className="border-t p-1">
                  <button
                    type="button"
                    onClick={() => setKindFilter(new Set())}
                    className="w-full rounded px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted"
                  >
                    Clear selection
                  </button>
                </div>
              ) : null}
            </Command>
          </PopoverContent>
        </Popover>
        <span className="mx-2 text-muted-foreground/40">·</span>
        <label className="text-xs text-muted-foreground">Supplier</label>
        <Popover
          open={supplierFilterOpen}
          onOpenChange={setSupplierFilterOpen}
        >
          <PopoverTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-md border bg-background px-2 py-1 text-xs hover:bg-muted/50"
            >
              <span>{supplierFilterLabel}</span>
              <ChevronDown className="size-3 text-muted-foreground" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64 p-0">
            <Command>
              <CommandInput placeholder="Search suppliers…" />
              <CommandList>
                <CommandEmpty>No suppliers match.</CommandEmpty>
                <CommandGroup>
                  {suppliers.map((s) => {
                    const selected = supplierFilter === s.id;
                    return (
                      <CommandItem
                        key={s.id}
                        value={s.company_name}
                        onSelect={() => {
                          setSupplierFilter(selected ? null : s.id);
                          setSupplierFilterOpen(false);
                        }}
                      >
                        <div
                          className={cn(
                            "mr-2 flex size-4 items-center justify-center rounded border",
                            selected
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border",
                          )}
                        >
                          {selected ? <Check className="size-3" /> : null}
                        </div>
                        {s.company_name}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
              {supplierFilter ? (
                <div className="border-t p-1">
                  <button
                    type="button"
                    onClick={() => setSupplierFilter(null)}
                    className="w-full rounded px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted"
                  >
                    Clear selection
                  </button>
                </div>
              ) : null}
            </Command>
          </PopoverContent>
        </Popover>
        <span className="mx-2 text-muted-foreground/40">·</span>
        <label className="text-xs text-muted-foreground">Group by</label>
        <div className="inline-flex rounded-md border p-0.5 text-xs">
          {(["flat", "kind", "month"] as GroupBy[]).map((g) => (
            <button
              type="button"
              key={g}
              onClick={() => setGroupBy(g)}
              className={cn(
                "rounded px-2 py-1 capitalize",
                groupBy === g
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground",
              )}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState onCreate={openNew} />
      ) : (
        <div className="flex flex-col gap-8">
          {groups.map((g, gi) => (
            <section key={gi} className="flex flex-col gap-2">
              {g.title ? (
                <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {g.title}
                </h2>
              ) : null}
              <div className="overflow-x-auto rounded-md border">
                <table className="min-w-full divide-y text-sm">
                  <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left">Date</th>
                      <th className="px-3 py-2 text-left">Kind</th>
                      <th className="px-3 py-2 text-left">Counterparty</th>
                      <th className="px-3 py-2 text-left">Description</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                      <th className="px-3 py-2 text-left">Custody</th>
                      <th className="px-3 py-2 text-center">File</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {g.rows.map((t) => {
                      const contactType = t.contacts?.type ?? null;
                      const isSupplier = contactType === "supplier";
                      const isCustomer = contactType === "customer";
                      const isOtherContact =
                        contactType === "logistics" || contactType === "other";
                      const hasPartner = Boolean(
                        t.partners?.name && !t.contacts,
                      );
                      const linkedInvoice =
                        t.kind === "supplier_payment" && t.related_payable
                          ? t.related_payable
                          : null;
                      const isHighlighted = highlightedId === t.id;
                      return (
                        <tr
                          key={t.id}
                          id={`txn-${t.id}`}
                          className={cn(
                            "transition-colors hover:bg-muted/30",
                            isHighlighted && "bg-primary/10",
                          )}
                        >
                          <td className="px-3 py-2 whitespace-nowrap">
                            {formatDateShort(t.transaction_date)}
                          </td>
                          <td className="px-3 py-2">
                            <Badge
                              className={cn(
                                "text-[10px]",
                                TRANSACTION_KIND_BADGE_CLASSES[
                                  t.kind as TransactionKind
                                ],
                              )}
                            >
                              {TRANSACTION_KIND_LABELS[
                                t.kind as TransactionKind
                              ] ?? t.kind}
                            </Badge>
                          </td>
                          <td className="px-3 py-2">
                            {(isSupplier || isCustomer) &&
                            t.contacts?.company_name &&
                            t.contact_id ? (
                              <Link
                                href={`/contacts/${t.contact_id}`}
                                className="inline-flex"
                              >
                                <Badge
                                  className={cn(
                                    "cursor-pointer text-[10px]",
                                    isSupplier
                                      ? CONTACT_TYPE_BADGE_CLASSES.supplier
                                      : CONTACT_TYPE_BADGE_CLASSES.customer,
                                  )}
                                >
                                  {t.contacts.company_name}
                                </Badge>
                              </Link>
                            ) : isOtherContact && t.contacts?.company_name &&
                              t.contact_id ? (
                              <Link
                                href={`/contacts/${t.contact_id}`}
                                className="inline-flex"
                              >
                                <Badge
                                  className={cn(
                                    "cursor-pointer text-[10px]",
                                    contactType === "logistics"
                                      ? CONTACT_TYPE_BADGE_CLASSES.logistics
                                      : CONTACT_TYPE_BADGE_CLASSES.other,
                                  )}
                                >
                                  {t.contacts.company_name}
                                </Badge>
                              </Link>
                            ) : hasPartner && t.partners?.name ? (
                              <Badge
                                className={cn(
                                  "text-[10px]",
                                  PARTNER_BADGE_CLASSES,
                                )}
                              >
                                {t.partners.name}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">
                                {counterpartyLabel(t)}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {t.description ?? "—"}
                          </td>
                          <td className="px-3 py-2 text-right font-medium tabular-nums">
                            <span className="inline-flex items-center justify-end gap-1.5">
                              {formatMoney(t.amount, t.currency)}
                              {linkedInvoice ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        jumpToRow(linkedInvoice.id)
                                      }
                                      className="text-muted-foreground hover:text-foreground"
                                      aria-label="Jump to linked invoice"
                                    >
                                      <Link2 className="size-3.5" />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    Paying invoice{" "}
                                    {linkedInvoice.reference_number ?? "—"}{" "}
                                    from{" "}
                                    {formatDateShort(
                                      linkedInvoice.transaction_date,
                                    )}
                                  </TooltipContent>
                                </Tooltip>
                              ) : null}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">
                            <CustodyCell t={t} />
                          </td>
                          <td className="px-3 py-2 text-center">
                            {t.attachment_path ? (
                              <button
                                type="button"
                                onClick={() =>
                                  openAttachment(
                                    t.attachment_path as string,
                                  )
                                }
                                className="text-muted-foreground hover:text-foreground"
                                aria-label="View attachment"
                              >
                                <Paperclip className="size-4" />
                              </button>
                            ) : null}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEdit(t)}
                            >
                              <Pencil className="size-3.5" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}

      <Button
        type="button"
        onClick={openNew}
        size="icon"
        className="fixed bottom-6 right-6 size-12 rounded-full shadow-lg md:hidden"
      >
        <Plus className="size-5" />
      </Button>

      <TransactionFormDialog
        open={formOpen}
        onOpenChange={(v) => {
          setFormOpen(v);
          if (!v) {
            setEditing(null);
            setPrefill(null);
          }
        }}
        accounts={accounts}
        transaction={editing}
        prefill={prefill}
      />
    </div>
    </TooltipProvider>
  );
}

function CustodyCell({ t }: { t: TransactionWithRelations }) {
  const from = t.from_account?.custody_locations?.name ?? null;
  const to = t.to_account?.custody_locations?.name ?? null;
  if (!from && !to) return <span>—</span>;
  if (from && to)
    return (
      <span className="inline-flex items-center gap-1">
        <span>{from}</span>
        <ArrowRight className="size-3" />
        <span>{to}</span>
      </span>
    );
  return <span>{from ?? to}</span>;
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-12 text-center">
      <Receipt className="size-8 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">
        No transactions yet. Record your first transaction.
      </p>
      <Button onClick={onCreate}>
        <Plus className="mr-2 size-4" /> Record transaction
      </Button>
    </div>
  );
}
