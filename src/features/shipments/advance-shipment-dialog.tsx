"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ShipmentStatus } from "@/lib/supabase/types";

import { SHIPMENT_STATUS_LABELS } from "./constants";
import type { ShipmentCascadePreviewOrder } from "./queries";
import {
  ORDER_STATUS_BADGE_CLASSES,
  ORDER_STATUS_LABELS,
} from "@/features/orders/constants";

export function AdvanceShipmentDialog({
  open,
  onOpenChange,
  shipmentId,
  to,
  affectedOrders,
  onConfirm,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shipmentId: string;
  to: ShipmentStatus;
  affectedOrders: ShipmentCascadePreviewOrder[];
  onConfirm: () => void;
  isPending: boolean;
}) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={(v) => {
        if (isPending) return;
        onOpenChange(v);
      }}
    >
      <AlertDialogContent className="max-w-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>
            Set shipment {shipmentId.slice(0, 8)} to{" "}
            {SHIPMENT_STATUS_LABELS[to]}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This will also update the following {affectedOrders.length} order
            {affectedOrders.length === 1 ? "" : "s"}.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="overflow-x-auto rounded-md border">
          <table className="min-w-full divide-y text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Order</th>
                <th className="px-3 py-2 text-left">Customer</th>
                <th className="px-3 py-2 text-left">Status change</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {affectedOrders.map((o) => (
                <tr key={o.order_id}>
                  <td className="px-3 py-2 font-mono text-xs">
                    {o.order_id.slice(0, 8)}
                  </td>
                  <td className="px-3 py-2 text-xs">{o.customer_name}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5 text-xs">
                      <Badge
                        className={cn(
                          "text-[10px]",
                          ORDER_STATUS_BADGE_CLASSES[o.current_status],
                        )}
                      >
                        {ORDER_STATUS_LABELS[o.current_status]}
                      </Badge>
                      <span className="text-muted-foreground">→</span>
                      <Badge
                        className={cn(
                          "text-[10px]",
                          ORDER_STATUS_BADGE_CLASSES[o.new_status],
                        )}
                      >
                        {ORDER_STATUS_LABELS[o.new_status]}
                      </Badge>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={isPending}
          >
            {isPending ? "Updating…" : "Confirm"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
