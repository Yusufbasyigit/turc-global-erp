"use client";

import { useState } from "react";
import { ClipboardPaste } from "lucide-react";

import { Button } from "@/components/ui/button";

import { BatchAddProductsDialog } from "./batch-add-products-dialog";

export function BatchAddProductsButton({
  className,
}: {
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)} className={className}>
        <ClipboardPaste className="mr-2 size-4" />
        Batch add products
      </Button>
      <BatchAddProductsDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
