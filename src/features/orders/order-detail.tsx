"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowRight,
  FileText,
  Plus,
  Trash2,
  Unlink,
  Upload,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Combobox } from "@/components/ui/combobox";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format-money";
import {
  ACCEPTED_ORDER_ATTACHMENT_TYPES,
  MAX_ORDER_ATTACHMENT_BYTES,
} from "@/lib/constants";
import {
  type OrderDetailWithRelations,
  type OrderStatus,
} from "@/lib/supabase/types";
import { listSupplierContacts, supplierKeys } from "@/features/products/queries";
import { formatDateOnly } from "@/lib/format-date";

import {
  ORDER_LIFECYCLE,
  ORDER_STATUS_BADGE_CLASSES,
  ORDER_STATUS_LABELS,
  NEXT_ORDER_STATUS,
  TERMINAL_ORDER_STATUSES,
} from "./constants";
import {
  getOrder,
  listOrderDetails,
  orderAttachmentSignedUrl,
  orderKeys,
} from "./queries";
import {
  addOrderLine,
  advanceOrderStatus,
  deleteOrderLine,
  unassignOrderFromShipment,
  updateOrder,
} from "./mutations";
import { listProducts, productKeys } from "@/features/products/queries";
import { CancelOrderDialog } from "./cancel-order-dialog";
import { AssignShipmentDialog } from "./assign-shipment-dialog";
import { PackagingOverrideDialog } from "./packaging-override-dialog";
import { BatchAddLinesButton } from "./batch-add-lines-button";
import { OrderLineRow } from "./order-line-row";
import { ProformaDetailsSection } from "./proforma-details-section";
import { GenerateProformaButton } from "./generate-proforma-button";

function formatDateShort(dateStr: string | null): string {
  return formatDateOnly(dateStr);
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleString();
  } catch {
    return dateStr;
  }
}

const formatMoney = formatCurrency;

export function OrderDetail({ id }: { id: string }) {
  const qc = useQueryClient();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [packagingLine, setPackagingLine] =
    useState<OrderDetailWithRelations | null>(null);

  const orderQ = useQuery({
    queryKey: orderKeys.detail(id),
    queryFn: () => getOrder(id),
  });
  const linesQ = useQuery({
    queryKey: [...orderKeys.detail(id), "lines"],
    queryFn: () => listOrderDetails(id),
  });
  const productsQ = useQuery({
    queryKey: productKeys.list(),
    queryFn: listProducts,
    staleTime: 60_000,
  });
  const suppliersQ = useQuery({
    queryKey: supplierKeys.all,
    queryFn: listSupplierContacts,
    staleTime: 60_000,
  });

  const order = orderQ.data;
  const lines = linesQ.data ?? [];
  const products = productsQ.data ?? [];
  const suppliers = suppliersQ.data ?? [];

  const productItems = useMemo(
    () =>
      products
        .filter((p) => Boolean(p.product_name))
        .map((p) => ({
          value: p.product_id,
          label: p.product_name as string,
        })),
    [products],
  );
  const supplierItems = useMemo(
    () =>
      suppliers
        .filter((s) => Boolean(s.company_name))
        .map((s) => ({ value: s.id, label: s.company_name as string })),
    [suppliers],
  );

  const total = useMemo(
    () =>
      lines.reduce(
        (sum, l) =>
          sum + Number(l.quantity ?? 0) * Number(l.unit_sales_price ?? 0),
        0,
      ),
    [lines],
  );

  const addLineMut = useMutation({
    mutationFn: (productId: string) =>
      addOrderLine({
        order_id: id,
        line: {
          product_id: productId,
          quantity: 1,
          unit_sales_price: null,
          est_purchase_unit_price: null,
          actual_purchase_price: null,
          vat_rate: null,
          supplier_id: null,
          notes: null,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: orderKeys.detail(id) });
      qc.invalidateQueries({ queryKey: orderKeys.list() });
      toast.success("Line added");
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed to add line"),
  });

  const deleteLineMut = useMutation({
    mutationFn: (lineId: string) => deleteOrderLine(lineId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: orderKeys.detail(id) });
      qc.invalidateQueries({ queryKey: orderKeys.list() });
      toast.success("Line removed");
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed"),
  });

  const advanceMut = useMutation({
    mutationFn: (to: OrderStatus) =>
      advanceOrderStatus({ order_id: id, to }),
    onSuccess: (o) => {
      qc.invalidateQueries({ queryKey: orderKeys.all });
      toast.success(
        `Moved to ${ORDER_STATUS_LABELS[o.status as OrderStatus] ?? o.status}`,
      );
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed to advance"),
  });

  const unassignMut = useMutation({
    mutationFn: () => unassignOrderFromShipment(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: orderKeys.all });
      toast.success("Detached from shipment");
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed"),
  });

  if (orderQ.isLoading || !order) {
    return (
      <div className="space-y-4 p-4 md:p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const status = order.status as OrderStatus;
  const isTerminal = (TERMINAL_ORDER_STATUSES as readonly string[]).includes(
    status,
  );
  const nextStatus = NEXT_ORDER_STATUS[status] ?? null;
  const canCancel = !isTerminal;
  const currentLifecycleIdx = ORDER_LIFECYCLE.indexOf(status);

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <Link
        href="/orders"
        className="inline-flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        ← Back to orders
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border p-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold">
              Order {order.id.slice(0, 8)}
            </h1>
            <Badge
              className={cn(
                "text-[10px]",
                ORDER_STATUS_BADGE_CLASSES[status],
              )}
            >
              {ORDER_STATUS_LABELS[status] ?? status}
            </Badge>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Customer:{" "}
            <span className="text-foreground">
              {order.customer?.company_name ?? "—"}
            </span>{" "}
            · Date: {formatDateShort(order.order_date)} · Currency:{" "}
            {order.order_currency}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground">Total</div>
          <div className="text-lg font-semibold tabular-nums">
            {total > 0 ? formatMoney(total, order.order_currency) : "—"}
          </div>
        </div>
      </div>

      {/* Status stepper */}
      <section className="rounded-lg border p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium">Status</h2>
          <div className="flex items-center gap-2">
            <GenerateProformaButton order={order} />
            {nextStatus ? (
              <Button
                size="sm"
                onClick={() => advanceMut.mutate(nextStatus)}
                disabled={advanceMut.isPending}
              >
                <ArrowRight className="mr-1 size-3.5" />
                Advance to {ORDER_STATUS_LABELS[nextStatus]}
              </Button>
            ) : null}
            {canCancel ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCancelOpen(true)}
              >
                <X className="mr-1 size-3.5" />
                Cancel order
              </Button>
            ) : null}
          </div>
        </div>
        <ol className="flex flex-wrap items-center gap-1 text-xs">
          {ORDER_LIFECYCLE.map((s, i) => {
            const state =
              status === "cancelled"
                ? "cancelled"
                : i < currentLifecycleIdx
                  ? "done"
                  : i === currentLifecycleIdx
                    ? "active"
                    : "pending";
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
                    state === "cancelled" && "border-border text-muted-foreground opacity-50",
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
                  <span>{ORDER_STATUS_LABELS[s]}</span>
                </span>
                {i < ORDER_LIFECYCLE.length - 1 ? (
                  <span className="text-muted-foreground/40">·</span>
                ) : null}
              </li>
            );
          })}
          {status === "cancelled" ? (
            <li>
              <Badge className={cn("text-[10px]", ORDER_STATUS_BADGE_CLASSES.cancelled)}>
                Cancelled
              </Badge>
            </li>
          ) : null}
        </ol>
        {order.cancellation_reason ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Cancellation reason: {order.cancellation_reason}
          </p>
        ) : null}
      </section>

      {/* Line items */}
      <section className="rounded-lg border">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b p-3">
          <h2 className="text-sm font-medium">Line items</h2>
          <div className="flex items-center gap-2">
            <AddLineBar
              productItems={productItems}
              onAdd={(pid) => addLineMut.mutate(pid)}
              disabled={addLineMut.isPending}
            />
            <BatchAddLinesButton
              orderId={id}
              orderStatus={status}
              orderCurrency={order.order_currency}
            />
          </div>
        </div>

        {linesQ.isLoading ? (
          <div className="p-4">
            <Skeleton className="h-24 w-full" />
          </div>
        ) : lines.length === 0 ? (
          <div className="p-6 text-center text-xs text-muted-foreground">
            No lines yet. Add a product above.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">#</th>
                  <th className="px-3 py-2 text-left">Product</th>
                  <th className="px-3 py-2 text-right">Qty</th>
                  <th className="px-3 py-2 text-right">Unit</th>
                  <th className="px-3 py-2 text-right">Sales price</th>
                  <th className="px-3 py-2 text-right">Est. purchase</th>
                  <th className="px-3 py-2 text-right">VAT</th>
                  <th className="px-3 py-2 text-left">Supplier</th>
                  <th className="px-3 py-2" />
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {lines.map((line) => (
                  <OrderLineRow
                    key={line.id}
                    line={line}
                    orderId={id}
                    supplierItems={supplierItems}
                    onDelete={() => deleteLineMut.mutate(line.id)}
                    onEditPackaging={() => setPackagingLine(line)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Proforma details */}
      <ProformaDetailsSection order={order} />

      {/* Shipment + attachments + notes */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <section className="rounded-lg border p-4">
          <h2 className="mb-2 text-sm font-medium">Shipment</h2>
          {order.shipment ? (
            <div className="space-y-2 text-sm">
              <div>
                <Link
                  href={`/shipments/${order.shipment.id}`}
                  className="text-primary hover:underline"
                >
                  {order.shipment.name}
                </Link>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setAssignOpen(true)}
                >
                  Reassign
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => unassignMut.mutate()}
                  disabled={unassignMut.isPending}
                >
                  <Unlink className="mr-1 size-3.5" />
                  Remove from shipment
                </Button>
              </div>
              {order.billing_shipment_id &&
              order.billing_shipment_id !== order.shipment.id ? (
                <p className="text-xs text-muted-foreground">
                  Billed on a different shipment (rolled over).
                </p>
              ) : null}
            </div>
          ) : (
            <div>
              <p className="mb-3 text-xs text-muted-foreground">
                Not assigned yet.
              </p>
              <Button size="sm" onClick={() => setAssignOpen(true)}>
                Assign to shipment
              </Button>
            </div>
          )}
        </section>

        <section className="rounded-lg border p-4">
          <h2 className="mb-2 text-sm font-medium">Attachments</h2>
          <CustomerPoSlot orderId={id} path={order.customer_po_file} />
          <div className="mt-4">
            <ProposalPdfSlot path={order.proposal_pdf ?? null} />
          </div>
        </section>
      </div>

      {order.notes ? (
        <section className="rounded-lg border p-4">
          <h2 className="mb-2 text-sm font-medium">Notes</h2>
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">
            {order.notes}
          </p>
        </section>
      ) : null}

      <footer className="text-[11px] text-muted-foreground">
        Created: {formatDateTime(order.created_time)} by{" "}
        {order.created_by ?? "—"} · Edited: {formatDateTime(order.edited_time)}{" "}
        by {order.edited_by ?? "—"}
      </footer>

      <CancelOrderDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        orderId={id}
      />
      <AssignShipmentDialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        orderId={id}
        customerId={order.customer_id}
        customerCurrency={order.customer?.balance_currency ?? null}
      />
      {packagingLine ? (
        <PackagingOverrideDialog
          open={Boolean(packagingLine)}
          onOpenChange={(v) => !v && setPackagingLine(null)}
          line={packagingLine}
          orderId={id}
        />
      ) : null}
    </div>
  );
}

function AddLineBar({
  productItems,
  onAdd,
  disabled,
}: {
  productItems: { value: string; label: string }[];
  onAdd: (productId: string) => void;
  disabled: boolean;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <div className="flex items-center gap-2">
      <div className="w-56">
        <Combobox
          items={productItems}
          value={selected}
          onChange={setSelected}
          placeholder="Add a product…"
          searchPlaceholder="Search…"
          emptyMessage="No match."
        />
      </div>
      <Button
        size="sm"
        onClick={() => {
          if (!selected) return;
          onAdd(selected);
          setSelected(null);
        }}
        disabled={!selected || disabled}
      >
        <Plus className="mr-1 size-3.5" /> Add line
      </Button>
    </div>
  );
}

function CustomerPoSlot({
  orderId,
  path,
}: {
  orderId: string;
  path: string | null;
}) {
  const qc = useQueryClient();

  const uploadMut = useMutation({
    mutationFn: async (file: File) => {
      if (!ACCEPTED_ORDER_ATTACHMENT_TYPES.includes(file.type as never)) {
        throw new Error("Unsupported file type.");
      }
      if (file.size > MAX_ORDER_ATTACHMENT_BYTES) {
        throw new Error("File too large (max 5MB).");
      }
      await updateOrder({
        id: orderId,
        payload: {},
        pendingFile: file,
        previousAttachmentPath: path,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: orderKeys.detail(orderId) });
      toast.success("Customer PO uploaded");
    },
    onError: (e: Error) => toast.error(e.message ?? "Upload failed"),
  });

  const removeMut = useMutation({
    mutationFn: async () => {
      if (!path) return;
      await updateOrder({
        id: orderId,
        payload: {},
        removeAttachment: true,
        previousAttachmentPath: path,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: orderKeys.detail(orderId) });
      toast.success("PO removed");
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed"),
  });

  const open = async () => {
    if (!path) return;
    const url = await orderAttachmentSignedUrl(path, 600);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="flex flex-col gap-2 text-sm">
      <div className="text-xs text-muted-foreground">Customer PO</div>
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
        <span>{path ? "Replace" : "Upload PO"}</span>
        <input
          type="file"
          className="hidden"
          accept={ACCEPTED_ORDER_ATTACHMENT_TYPES.join(",")}
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

function ProposalPdfSlot({ path }: { path: string | null }) {
  const open = async () => {
    if (!path) return;
    const url = await orderAttachmentSignedUrl(path, 600);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  };
  return (
    <div className="flex flex-col gap-2 text-sm">
      <div className="text-xs text-muted-foreground">Proforma PDF</div>
      {path ? (
        <div className="flex items-center gap-2 rounded-md border p-2 text-xs">
          <FileText className="size-4 text-muted-foreground" />
          <button
            type="button"
            onClick={open}
            className="font-medium underline underline-offset-2"
          >
            View proforma
          </button>
        </div>
      ) : (
        <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
          Not generated yet. Fill proforma details, then click “Generate proforma”.
        </div>
      )}
    </div>
  );
}
