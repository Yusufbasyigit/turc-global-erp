"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
  batchAddLinesFromProforma,
  type BatchLineInput,
} from "./batch-add-lines-mutations";
import { BatchImportStep1Prompt } from "./batch-import-step-1-prompt";
import { BatchImportStep2Paste } from "./batch-import-step-2-paste";
import {
  BatchImportStep3Confirm,
  makeConfirmedLines,
  type ConfirmedLine,
} from "./batch-import-step-3-confirm";
import { productKeys } from "@/features/products/queries";
import type { ProformaImport } from "./proforma-import-schema";
import { orderKeys } from "./queries";

const STEP_TITLES = ["Prompt", "JSON", "Confirm"] as const;

export function BatchAddLinesDialog({
  open,
  onOpenChange,
  orderId,
  orderCurrency,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  orderId: string;
  orderCurrency: string;
}) {
  const qc = useQueryClient();
  const [stepIndex, setStepIndex] = useState(0);
  const [jsonText, setJsonText] = useState("");
  const [parsed, setParsed] = useState<ProformaImport | null>(null);
  const [confirmedLines, setConfirmedLines] = useState<ConfirmedLine[]>([]);

  useEffect(() => {
    if (!open) return;
    setStepIndex(0);
    setJsonText("");
    setParsed(null);
    setConfirmedLines([]);
  }, [open]);

  useEffect(() => {
    if (parsed) {
      setConfirmedLines(makeConfirmedLines(parsed));
    } else {
      setConfirmedLines([]);
    }
  }, [parsed]);

  const includedCount = useMemo(
    () => confirmedLines.filter((l) => l.included).length,
    [confirmedLines],
  );

  const saveMut = useMutation({
    mutationFn: async () => {
      const toSend: BatchLineInput[] = confirmedLines
        .filter((l) => l.included)
        .map((l) => ({
          proposed_product_name: l.proposed_product_name,
          primary_quantity: l.primary_quantity,
          primary_unit: l.primary_unit,
          unit_price: l.unit_price,
          line_currency: l.line_currency,
          hs_code: l.hs_code,
          supplier_sku: l.supplier_sku,
          secondary_quantities: l.secondary_quantities,
          notes: l.notes,
        }));
      return batchAddLinesFromProforma({
        orderId,
        lines: toSend,
        fallbackCurrency: parsed?.currency ?? orderCurrency,
      });
    },
    onSuccess: ({ count }) => {
      qc.invalidateQueries({ queryKey: orderKeys.detail(orderId) });
      qc.invalidateQueries({ queryKey: orderKeys.list() });
      qc.invalidateQueries({ queryKey: productKeys.all });
      toast.success(`Added ${count} line${count === 1 ? "" : "s"}.`);
      onOpenChange(false);
    },
    onError: (e: Error) => {
      toast.error(e.message ?? "Failed to add lines");
    },
  });

  const canNext =
    (stepIndex === 0) ||
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
          <DialogTitle>Batch add lines</DialogTitle>
          <DialogDescription>
            Step {stepIndex + 1} of 3 — {STEP_TITLES[stepIndex]}
          </DialogDescription>
        </DialogHeader>

        <Stepper current={stepIndex} onPick={goTo} canGoToStep3={parsed !== null} />

        <div className="py-2">
          {stepIndex === 0 ? <BatchImportStep1Prompt /> : null}
          {stepIndex === 1 ? (
            <BatchImportStep2Paste
              jsonText={jsonText}
              onJsonTextChange={setJsonText}
              onValid={setParsed}
            />
          ) : null}
          {stepIndex === 2 && parsed ? (
            <BatchImportStep3Confirm
              parsed={parsed}
              lines={confirmedLines}
              onLinesChange={setConfirmedLines}
              orderCurrency={orderCurrency}
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
              <Button
                type="button"
                onClick={goNext}
                disabled={!canNext}
              >
                {stepIndex === 0 ? "Next — I have the JSON" : "Next — Review lines"}
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
                  : `Add ${includedCount} line${includedCount === 1 ? "" : "s"} to order`}
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
