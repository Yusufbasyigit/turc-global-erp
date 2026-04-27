"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowRight,
  FileText,
  Pencil,
  Trash2,
  Unlink,
  Upload,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  ACCEPTED_SHIPMENT_DOCUMENT_TYPES,
  MAX_SHIPMENT_DOCUMENT_BYTES,
} from "@/lib/constants";
import type { ShipmentStatus } from "@/lib/supabase/types";

import {
  NEXT_SHIPMENT_STATUS,
  SHIPMENT_LIFECYCLE,
  SHIPMENT_STATUS_BADGE_CLASSES,
  SHIPMENT_STATUS_LABELS,
  TRANSPORT_METHOD_LABELS,
} from "./constants";
import {
  getShipment,
  shipmentDocumentSignedUrl,
  shipmentKeys,
} from "./queries";
import {
  advanceShipmentStatus,
  updateShipment,
} from "./mutations";
import { transactionKeys } from "@/features/transactions/queries";
import { ShipmentFormDialog } from "./shipment-form-dialog";
import { ShipmentBillingCard } from "./shipment-billing-card";
import { ShipmentCapacityCard } from "./shipment-capacity-card";
import { GenerateStatementButton } from "./generate-statement-button";
import {
  assignOrderToShipment,
  unassignOrderFromShipment,
} from "@/features/orders/mutations";
import {
  listAssignableOrdersForShipment,
  orderKeys,
} from "@/features/orders/queries";
import {
  ORDER_STATUS_BADGE_CLASSES,
  ORDER_STATUS_LABELS,
} from "@/features/orders/constants";
import { createClient } from "@/lib/supabase/client";
import { formatDateOnly } from "@/lib/format-date";

const formatDate = (d: string | null) => formatDateOnly(d);

function formatDateTime(d: string | null): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString();
  } catch {
    return d;
  }
}

function formatMoney(n: number): string {
  return Number(n).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function ShipmentDetail({ id }: { id: string }) {
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);

  const shipmentQ = useQuery({
    queryKey: shipmentKeys.detail(id),
    queryFn: () => getShipment(id),
  });

  const linkedOrdersQ = useQuery({
    queryKey: shipmentKeys.linkedOrders(id),
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("orders")
        .select("id, order_date, status, order_currency, order_details:order_details(id, quantity, unit_sales_price)")
        .eq("shipment_id", id)
        .order("order_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Array<{
        id: string;
        order_date: string;
        status: string;
        order_currency: string;
        order_details: Array<{
          id: string;
          quantity: number;
          unit_sales_price: number | null;
        }>;
      }>;
    },
  });

  const shipment = shipmentQ.data;
  const linkedOrders = linkedOrdersQ.data ?? [];

  const assignableQ = useQuery({
    queryKey: orderKeys.assignable(id),
    queryFn: () =>
      listAssignableOrdersForShipment(id, shipment?.customer_id ?? ""),
    enabled: Boolean(shipment?.customer_id),
  });

  const assignable = assignableQ.data ?? [];
  const assignableItems = useMemo(
    () =>
      assignable.map((o) => ({
        value: o.id,
        label: `${o.id.slice(0, 8)} · ${formatDate(o.order_date)} · ${ORDER_STATUS_LABELS[o.status as keyof typeof ORDER_STATUS_LABELS] ?? o.status}`,
      })),
    [assignable],
  );

  const advanceMut = useMutation({
    mutationFn: (to: ShipmentStatus) =>
      advanceShipmentStatus({ shipment_id: id, to }),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: shipmentKeys.all });
      qc.invalidateQueries({ queryKey: transactionKeys.all });
      const status = result.shipment.status as ShipmentStatus;
      if (status === "booked" && result.billingAmount !== undefined) {
        toast.success(
          `Shipment booked. Invoice for ${formatMoney(result.billingAmount)} ${result.billingCurrency ?? ""} written to customer ledger.`,
        );
      } else if (status === "in_transit") {
        toast.success(
          `Shipment in transit. ${result.cascadedOrderCount ?? 0} orders marked as shipped.`,
        );
      } else if (status === "arrived") {
        toast.success("Shipment arrived.");
      } else {
        toast.success(
          `Moved to ${SHIPMENT_STATUS_LABELS[status] ?? status}`,
        );
      }
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed"),
  });

  const assignMut = useMutation({
    mutationFn: (orderId: string) =>
      assignOrderToShipment({ order_id: orderId, shipment_id: id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: shipmentKeys.all });
      qc.invalidateQueries({ queryKey: orderKeys.all });
      toast.success("Order added");
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed"),
  });

  const removeMut = useMutation({
    mutationFn: (orderId: string) => unassignOrderFromShipment(orderId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: shipmentKeys.all });
      qc.invalidateQueries({ queryKey: orderKeys.all });
      toast.success("Order removed");
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed"),
  });

  if (shipmentQ.isLoading || !shipment) {
    return (
      <div className="space-y-4 p-4 md:p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  const status = shipment.status as ShipmentStatus;
  const nextStatus = NEXT_SHIPMENT_STATUS[status] ?? null;

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <Link
        href="/shipments"
        className="inline-flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        ← Back to shipments
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border p-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold">{shipment.name}</h1>
            <Badge
              className={cn(
                "text-[10px]",
                SHIPMENT_STATUS_BADGE_CLASSES[status],
              )}
            >
              {SHIPMENT_STATUS_LABELS[status] ?? status}
            </Badge>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Customer:{" "}
            <span className="text-foreground">
              {shipment.customer?.company_name ?? "—"}
            </span>{" "}
            · ETD: {formatDate(shipment.etd_date)} · ETA:{" "}
            {formatDate(shipment.eta_date)} · Currency: {shipment.invoice_currency}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {shipment.transport_method
              ? TRANSPORT_METHOD_LABELS[shipment.transport_method] ?? shipment.transport_method
              : "—"}
            {shipment.container_type ? ` · ${shipment.container_type}` : ""}
            {shipment.vessel_name ? ` · ${shipment.vessel_name}` : ""}
            {shipment.tracking_number
              ? ` · Tracking: ${shipment.tracking_number}`
              : ""}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <GenerateStatementButton shipment={shipment} />
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="mr-1 size-3.5" /> Edit basics
          </Button>
        </div>
      </div>

      {/* Status stepper */}
      <section className="rounded-lg border p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium">Status</h2>
          {nextStatus ? (
            <Button
              size="sm"
              onClick={() => advanceMut.mutate(nextStatus)}
              disabled={advanceMut.isPending}
            >
              <ArrowRight className="mr-1 size-3.5" />
              Advance to {SHIPMENT_STATUS_LABELS[nextStatus]}
            </Button>
          ) : null}
        </div>
        <ol className="flex flex-wrap items-center gap-1 text-xs">
          {SHIPMENT_LIFECYCLE.map((s, i) => {
            const currentIdx = SHIPMENT_LIFECYCLE.indexOf(status);
            const state =
              i < currentIdx ? "done" : i === currentIdx ? "active" : "pending";
            return (
              <li key={s} className="flex items-center gap-1">
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1",
                    state === "active" &&
                      "border-primary bg-primary text-primary-foreground",
                    state === "done" && "border-border bg-muted",
                    state === "pending" &&
                      "border-border text-muted-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-4 items-center justify-center rounded-full text-[10px] font-medium",
                      state === "active" && "bg-primary-foreground/20",
                      (state === "done" || state === "pending") && "bg-foreground/10",
                    )}
                  >
                    {i + 1}
                  </span>
                  <span>{SHIPMENT_STATUS_LABELS[s]}</span>
                </span>
                {i < SHIPMENT_LIFECYCLE.length - 1 ? (
                  <span className="text-muted-foreground/40">·</span>
                ) : null}
              </li>
            );
          })}
        </ol>
      </section>

      <ShipmentCapacityCard
        shipmentId={id}
        containerType={shipment.container_type}
      />

      <ShipmentBillingCard
        shipmentId={id}
        customerId={shipment.customer_id}
        currency={shipment.invoice_currency}
      />

      {/* Orders in this shipment */}
      <section className="rounded-lg border">
        <div className="flex items-center justify-between gap-2 border-b p-3">
          <h2 className="text-sm font-medium">Orders in this shipment</h2>
          <div className="flex items-center gap-2">
            <div className="w-64">
              <Combobox
                items={assignableItems}
                value={null}
                onChange={(v) => {
                  if (v) assignMut.mutate(v);
                }}
                placeholder="Add an order…"
                searchPlaceholder="Search…"
                emptyMessage="No eligible orders."
              />
            </div>
          </div>
        </div>
        {linkedOrders.length === 0 ? (
          <div className="p-6 text-center text-xs text-muted-foreground">
            No orders linked yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">ID</th>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-right">Lines</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {linkedOrders.map((o) => (
                  <tr key={o.id} className="hover:bg-muted/30">
                    <td className="px-3 py-2 font-mono text-xs">
                      <Link
                        href={`/orders/${o.id}`}
                        className="text-primary hover:underline"
                      >
                        {o.id.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {formatDate(o.order_date)}
                    </td>
                    <td className="px-3 py-2">
                      <Badge
                        className={cn(
                          "text-[10px]",
                          ORDER_STATUS_BADGE_CLASSES[
                            o.status as keyof typeof ORDER_STATUS_BADGE_CLASSES
                          ],
                        )}
                      >
                        {ORDER_STATUS_LABELS[
                          o.status as keyof typeof ORDER_STATUS_LABELS
                        ] ?? o.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {o.order_details?.length ?? 0}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeMut.mutate(o.id)}
                      >
                        <Unlink className="size-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Freight + Documents */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <section className="rounded-lg border p-4">
          <h2 className="mb-2 text-sm font-medium">Freight</h2>
          <div className="text-sm">
            {shipment.freight_cost !== null ? (
              <span>
                {formatMoney(Number(shipment.freight_cost))}{" "}
                {shipment.freight_currency ?? shipment.invoice_currency}
              </span>
            ) : (
              <span className="text-muted-foreground">Not set</span>
            )}
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Edit freight via &quot;Edit basics&quot;.
          </p>
        </section>

        <section className="rounded-lg border p-4">
          <h2 className="mb-2 text-sm font-medium">Documents</h2>
          <ShipmentDocSlot shipmentId={id} path={shipment.documents_file} />
        </section>
      </div>

      {shipment.notes ? (
        <section className="rounded-lg border p-4">
          <h2 className="mb-2 text-sm font-medium">Notes</h2>
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">
            {shipment.notes}
          </p>
        </section>
      ) : null}

      <footer className="text-[11px] text-muted-foreground">
        Created: {formatDateTime(shipment.created_time)} by{" "}
        {shipment.created_by ?? "—"} · Edited:{" "}
        {formatDateTime(shipment.edited_time)} by {shipment.edited_by ?? "—"}
      </footer>

      <ShipmentFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        shipment={shipment}
      />
    </div>
  );
}

function ShipmentDocSlot({
  shipmentId,
  path,
}: {
  shipmentId: string;
  path: string | null;
}) {
  const qc = useQueryClient();

  const uploadMut = useMutation({
    mutationFn: async (file: File) => {
      if (!ACCEPTED_SHIPMENT_DOCUMENT_TYPES.includes(file.type as never)) {
        throw new Error("Unsupported file type.");
      }
      if (file.size > MAX_SHIPMENT_DOCUMENT_BYTES) {
        throw new Error("File too large (max 5MB).");
      }
      await updateShipment({
        id: shipmentId,
        payload: {},
        pendingFile: file,
        previousDocumentPath: path,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: shipmentKeys.detail(shipmentId) });
      toast.success("Document uploaded");
    },
    onError: (e: Error) => toast.error(e.message ?? "Upload failed"),
  });

  const removeMut = useMutation({
    mutationFn: async () => {
      if (!path) return;
      await updateShipment({
        id: shipmentId,
        payload: {},
        removeDocument: true,
        previousDocumentPath: path,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: shipmentKeys.detail(shipmentId) });
      toast.success("Document removed");
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed"),
  });

  const open = async () => {
    if (!path) return;
    const url = await shipmentDocumentSignedUrl(path, 600);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="flex flex-col gap-2 text-sm">
      {path ? (
        <div className="flex items-center gap-2 rounded-md border p-2 text-xs">
          <FileText className="size-4 text-muted-foreground" />
          <button
            type="button"
            onClick={open}
            className="font-medium underline underline-offset-2"
          >
            View file
          </button>
          <button
            type="button"
            onClick={() => removeMut.mutate()}
            className="ml-auto inline-flex items-center gap-1 text-destructive"
          >
            <Trash2 className="size-3" /> Remove
          </button>
        </div>
      ) : null}
      <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-xs hover:bg-muted/50">
        <Upload className="size-3.5" />
        <span>{path ? "Replace" : "Upload"}</span>
        <input
          type="file"
          className="hidden"
          accept={ACCEPTED_SHIPMENT_DOCUMENT_TYPES.join(",")}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) uploadMut.mutate(f);
            e.currentTarget.value = "";
          }}
        />
      </label>
    </div>
  );
}
