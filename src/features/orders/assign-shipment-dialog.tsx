"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { BALANCE_CURRENCIES } from "@/lib/supabase/types";

import { assignOrderToShipment } from "./mutations";
import { orderKeys } from "./queries";
import {
  countShipmentsForCustomer,
  listDraftShipmentsForCustomer,
  shipmentKeys,
} from "@/features/shipments/queries";
import { createShipment } from "@/features/shipments/mutations";
import { SHIPMENT_STATUS_LABELS } from "@/features/shipments/constants";
import type { ShipmentStatus } from "@/lib/supabase/types";

export function AssignShipmentDialog({
  open,
  onOpenChange,
  orderId,
  customerId,
  customerCurrency,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  orderId: string;
  customerId: string;
  customerCurrency: string | null;
}) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [creatingNew, setCreatingNew] = useState(false);
  const [newName, setNewName] = useState("");

  const shipmentsQ = useQuery({
    queryKey: shipmentKeys.forCustomer(customerId),
    queryFn: () => listDraftShipmentsForCustomer(customerId),
    enabled: open && Boolean(customerId),
  });

  const countQ = useQuery({
    queryKey: ["shipments", "count", customerId],
    queryFn: () => countShipmentsForCustomer(customerId),
    enabled: open && Boolean(customerId),
  });

  useEffect(() => {
    if (open) {
      setSelected(null);
      setCreatingNew(false);
      setNewName("");
    }
  }, [open]);

  const shipments = shipmentsQ.data ?? [];

  const items = useMemo(
    () =>
      shipments.map((s) => ({
        value: s.id,
        label: `${s.name} · ${SHIPMENT_STATUS_LABELS[s.status as ShipmentStatus] ?? s.status}`,
      })),
    [shipments],
  );

  const assignMut = useMutation({
    mutationFn: (shipmentId: string) =>
      assignOrderToShipment({
        order_id: orderId,
        shipment_id: shipmentId,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: orderKeys.all });
      qc.invalidateQueries({ queryKey: shipmentKeys.all });
      toast.success("Order assigned to shipment");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed to assign"),
  });

  const createAndAssignMut = useMutation({
    mutationFn: async () => {
      const id = crypto.randomUUID();
      const currency =
        customerCurrency &&
        (BALANCE_CURRENCIES as readonly string[]).includes(customerCurrency)
          ? customerCurrency
          : "USD";
      await createShipment({
        id,
        payload: {
          customer_id: customerId,
          name: newName.trim(),
          invoice_currency: currency,
        },
      });
      await assignOrderToShipment({ order_id: orderId, shipment_id: id });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: orderKeys.all });
      qc.invalidateQueries({ queryKey: shipmentKeys.all });
      toast.success("Shipment created and order assigned");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed"),
  });

  const placeholderName = useMemo(() => {
    const n = (countQ.data ?? 0) + 1;
    return `Shipment #${n}`;
  }, [countQ.data]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Assign to shipment</DialogTitle>
          <DialogDescription>
            Pick an open shipment for this customer, or create a new draft.
          </DialogDescription>
        </DialogHeader>

        {!creatingNew ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Existing shipments (draft or booked)
              </Label>
              <Combobox
                items={items}
                value={selected}
                onChange={setSelected}
                placeholder={
                  items.length === 0
                    ? "No open shipments for this customer"
                    : "Pick a shipment"
                }
                searchPlaceholder="Search shipments…"
                emptyMessage="No match."
              />
            </div>
            <button
              type="button"
              onClick={() => setCreatingNew(true)}
              className="text-xs text-primary underline-offset-2 hover:underline"
            >
              + Create a new shipment instead
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Shipment name *
              </Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={placeholderName}
              />
              <p className="text-[11px] text-muted-foreground">
                Default: {placeholderName}. You can edit it after creation.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCreatingNew(false)}
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
            >
              ← Pick an existing shipment
            </button>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {!creatingNew ? (
            <Button
              onClick={() => selected && assignMut.mutate(selected)}
              disabled={!selected || assignMut.isPending}
            >
              {assignMut.isPending ? "Assigning…" : "Assign"}
            </Button>
          ) : (
            <Button
              onClick={() => {
                if (!newName.trim()) {
                  setNewName(placeholderName);
                  return;
                }
                createAndAssignMut.mutate();
              }}
              disabled={createAndAssignMut.isPending}
            >
              {createAndAssignMut.isPending ? "Creating…" : "Create & assign"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
