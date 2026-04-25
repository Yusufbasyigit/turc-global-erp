"use client";

import { FileText } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { OrderWithRelations, OrderStatus } from "@/lib/supabase/types";
import { generateProformaPdf } from "@/lib/pdf/generate-proforma-pdf";
import { getMissingProformaFields } from "@/lib/proforma/schema";
import { orderKeys } from "./queries";

const VISIBLE_STATUSES: readonly OrderStatus[] = [
  "quoted",
  "accepted",
  "in_production",
  "shipped",
];

type ProformaOrder = OrderWithRelations & {
  offer_number: string | null;
  offer_date: string | null;
  incoterm: string | null;
  payment_terms: string | null;
  proposal_pdf: string | null;
};

export function GenerateProformaButton({
  order,
}: {
  order: OrderWithRelations;
}) {
  const qc = useQueryClient();
  const shaped = order as ProformaOrder;
  const status = shaped.status as OrderStatus;

  const mut = useMutation({
    mutationFn: () => generateProformaPdf(shaped.id),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: orderKeys.detail(shaped.id) });
      window.open(result.signedUrl, "_blank", "noopener,noreferrer");
      toast.success(`Proforma ${result.offerNumber} generated.`);
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed to generate"),
  });

  if (!(VISIBLE_STATUSES as readonly string[]).includes(status)) return null;

  const missing = getMissingProformaFields({
    offer_date: shaped.offer_date,
    incoterm: shaped.incoterm,
    payment_terms: shaped.payment_terms,
  });
  const disabled = missing.length > 0 || mut.isPending;
  const label = shaped.proposal_pdf ? "Regenerate proforma" : "Generate proforma";
  const buttonEl = (
    <Button
      size="sm"
      variant={shaped.proposal_pdf ? "outline" : "default"}
      onClick={() => mut.mutate()}
      disabled={disabled}
    >
      <FileText className="mr-1 size-3.5" />
      {mut.isPending ? "Generating…" : label}
    </Button>
  );

  if (missing.length > 0) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span tabIndex={0} className="inline-flex">
              {buttonEl}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            Missing: {missing.join(", ")}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  return buttonEl;
}
