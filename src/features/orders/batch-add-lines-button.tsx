"use client";

import { useState } from "react";
import { ClipboardPaste } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { OrderStatus } from "@/lib/supabase/types";

import { BatchAddLinesDialog } from "./batch-add-lines-dialog";

const ALLOWED_STATUSES: OrderStatus[] = ["inquiry", "quoted", "accepted"];

export function BatchAddLinesButton({
  orderId,
  orderStatus,
  orderCurrency,
}: {
  orderId: string;
  orderStatus: OrderStatus;
  orderCurrency: string;
}) {
  const [open, setOpen] = useState(false);

  if (!ALLOWED_STATUSES.includes(orderStatus)) return null;

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <ClipboardPaste className="mr-1 size-3.5" />
        Batch add lines
      </Button>
      <BatchAddLinesDialog
        open={open}
        onOpenChange={setOpen}
        orderId={orderId}
        orderCurrency={orderCurrency}
      />
    </>
  );
}
