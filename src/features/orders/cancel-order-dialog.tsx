"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { cancelOrder } from "./mutations";
import { orderKeys } from "./queries";

export function CancelOrderDialog({
  open,
  onOpenChange,
  orderId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  orderId: string;
}) {
  const qc = useQueryClient();
  const [reason, setReason] = useState("");

  const mut = useMutation({
    mutationFn: () => cancelOrder({ order_id: orderId, reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: orderKeys.all });
      toast.success("Order cancelled");
      setReason("");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed to cancel"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Cancel order</DialogTitle>
          <DialogDescription>
            Cancelling detaches the order from any shipment. This is logged
            and cannot be undone from the UI.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Reason *</Label>
          <Textarea
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why is this order being cancelled?"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Back
          </Button>
          <Button
            variant="destructive"
            onClick={() => mut.mutate()}
            disabled={reason.trim().length < 3 || mut.isPending}
          >
            {mut.isPending ? "Cancelling…" : "Cancel order"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
