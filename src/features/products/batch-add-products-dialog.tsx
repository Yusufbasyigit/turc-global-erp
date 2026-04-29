"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

import {
  batchAddProducts,
  type BatchProductInput,
} from "./batch-add-products-mutations";
import { BatchAddProductsStep1Prompt } from "./batch-add-products-step-1-prompt";
import { BatchAddProductsStep2Paste } from "./batch-add-products-step-2-paste";
import {
  BatchAddProductsStep3Confirm,
  autoMatchSupplierId,
  makeConfirmedProducts,
  type ConfirmedProduct,
} from "./batch-add-products-step-3-confirm";
import { listSupplierContacts, productKeys, supplierKeys } from "./queries";
import type { ProductBatchImport } from "./product-batch-import-schema";

const STEP_TITLES = ["Prompt", "JSON", "Confirm"] as const;

export function BatchAddProductsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const [stepIndex, setStepIndex] = useState(0);
  const [jsonText, setJsonText] = useState("");
  const [parsed, setParsed] = useState<ProductBatchImport | null>(null);
  const [rows, setRows] = useState<ConfirmedProduct[]>([]);
  const [supplierId, setSupplierId] = useState<string | null>(null);

  const { data: suppliers = [] } = useQuery({
    queryKey: supplierKeys.all,
    queryFn: listSupplierContacts,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!open) return;
    setStepIndex(0);
    setJsonText("");
    setParsed(null);
    setRows([]);
    setSupplierId(null);
  }, [open]);

  useEffect(() => {
    if (parsed) {
      setRows(makeConfirmedProducts(parsed));
      setSupplierId(autoMatchSupplierId(parsed.supplier_name, suppliers));
    } else {
      setRows([]);
      setSupplierId(null);
    }
  }, [parsed, suppliers]);

  const includedCount = useMemo(
    () => rows.filter((r) => r.included).length,
    [rows],
  );

  const saveMut = useMutation({
    mutationFn: async () => {
      const toSend: BatchProductInput[] = rows
        .filter((r) => r.included)
        .map((r) => ({
          product_name: r.product_name,
          client_product_name: r.client_product_name,
          client_description: null,
          barcode_value: r.barcode_value,
          unit: r.unit,
          est_purchase_price: r.est_purchase_price,
          est_currency: r.est_currency,
          default_sales_price: r.default_sales_price,
          sales_currency: r.sales_currency,
          kdv_rate: r.kdv_rate,
          weight_kg_per_unit: r.weight_kg_per_unit,
          cbm_per_unit: r.cbm_per_unit,
          hs_code: r.hs_code,
        }));
      return batchAddProducts({
        products: toSend,
        defaultSupplierId: supplierId,
      });
    },
    onSuccess: ({ count }) => {
      qc.invalidateQueries({ queryKey: productKeys.all });
      toast.success(`Added ${count} product${count === 1 ? "" : "s"}.`);
      onOpenChange(false);
    },
    onError: (e: Error) => {
      toast.error(e.message ?? "Failed to add products");
    },
  });

  const canNext =
    stepIndex === 0 ||
    (stepIndex === 1 && parsed !== null) ||
    stepIndex === 2;

  const goNext = () => {
    if (stepIndex < 2) setStepIndex((i) => i + 1);
  };
  const goBack = () => {
    if (stepIndex > 0) setStepIndex((i) => i - 1);
  };
  const goTo = (target: number) => {
    if (target === stepIndex) return;
    if (target < stepIndex) {
      setStepIndex(target);
      return;
    }
    if (target === 1 && stepIndex === 0) setStepIndex(1);
    if (target === 2 && parsed !== null) setStepIndex(2);
  };

  const submitting = saveMut.isPending;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!submitting) onOpenChange(v);
      }}
    >
      <DialogContent className="max-h-[92vh] w-[95vw] max-w-[1200px] overflow-y-auto sm:w-[92vw] sm:max-w-[1200px]">
        <DialogHeader>
          <DialogTitle>Batch add products</DialogTitle>
          <DialogDescription>
            Step {stepIndex + 1} of 3 — {STEP_TITLES[stepIndex]}
          </DialogDescription>
        </DialogHeader>

        <Stepper
          current={stepIndex}
          onPick={goTo}
          canGoToStep3={parsed !== null}
        />

        <div className="py-2">
          {stepIndex === 0 ? <BatchAddProductsStep1Prompt /> : null}
          {stepIndex === 1 ? (
            <BatchAddProductsStep2Paste
              jsonText={jsonText}
              onJsonTextChange={setJsonText}
              onValid={setParsed}
            />
          ) : null}
          {stepIndex === 2 && parsed ? (
            <BatchAddProductsStep3Confirm
              parsed={parsed}
              rows={rows}
              onRowsChange={setRows}
              suppliers={suppliers}
              supplierId={supplierId}
              onSupplierIdChange={setSupplierId}
            />
          ) : null}
        </div>

        <DialogFooter className="flex-row items-center justify-between gap-2 pt-2 sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={goBack}
            disabled={stepIndex === 0 || submitting}
          >
            <ArrowLeft className="mr-2 size-4" />
            Back
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>

            {stepIndex < 2 ? (
              <Button type="button" onClick={goNext} disabled={!canNext}>
                {stepIndex === 0
                  ? "Next — I have the JSON"
                  : "Next — Review products"}
                <ArrowRight className="ml-2 size-4" />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={() => saveMut.mutate()}
                disabled={includedCount === 0 || submitting}
              >
                {submitting
                  ? "Adding…"
                  : `Add ${includedCount} product${includedCount === 1 ? "" : "s"}`}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stepper({
  current,
  onPick,
  canGoToStep3,
}: {
  current: number;
  onPick: (i: number) => void;
  canGoToStep3: boolean;
}) {
  return (
    <ol className="flex flex-wrap items-center gap-1 border-y py-3 text-xs">
      {STEP_TITLES.map((title, i) => {
        const state = i < current ? "done" : i === current ? "active" : "pending";
        const disabled = i === 2 && !canGoToStep3 && current < 2;
        return (
          <li key={title} className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => !disabled && onPick(i)}
              disabled={disabled}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 transition-colors",
                state === "active" &&
                  "border-primary bg-primary text-primary-foreground",
                state === "done" &&
                  "border-border bg-muted text-foreground hover:bg-muted/80",
                state === "pending" &&
                  "border-border text-muted-foreground hover:bg-muted/50",
                disabled && "opacity-50 cursor-not-allowed",
              )}
            >
              <span
                className={cn(
                  "flex size-4 items-center justify-center rounded-full text-[10px] font-medium",
                  state === "active" && "bg-primary-foreground/20",
                  state === "done" && "bg-foreground/10",
                  state === "pending" && "bg-muted",
                )}
              >
                {state === "done" ? (
                  <Check className="size-3" />
                ) : (
                  <span>{i + 1}</span>
                )}
              </span>
              <span>{title}</span>
            </button>
            {i < STEP_TITLES.length - 1 ? (
              <span className="text-muted-foreground/40">·</span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
