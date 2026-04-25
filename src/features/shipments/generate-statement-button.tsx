"use client";

import { FileText } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { Shipment, ShipmentStatus } from "@/lib/supabase/types";
import { generateShipmentStatementPdf } from "@/lib/pdf/generate-shipment-statement-pdf";
import { shipmentKeys } from "./queries";

const VISIBLE_STATUSES: readonly ShipmentStatus[] = [
  "booked",
  "in_transit",
  "arrived",
];

type StatementShipment = Shipment & {
  generated_statement_pdf: string | null;
};

export function GenerateStatementButton({ shipment }: { shipment: Shipment }) {
  const qc = useQueryClient();
  const shaped = shipment as StatementShipment;
  const status = shaped.status as ShipmentStatus;

  const mut = useMutation({
    mutationFn: () => generateShipmentStatementPdf(shaped.id),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: shipmentKeys.detail(shaped.id) });
      window.open(result.signedUrl, "_blank", "noopener,noreferrer");
      toast.success(`Statement for ${result.shipmentName} generated.`);
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed to generate"),
  });

  if (!(VISIBLE_STATUSES as readonly string[]).includes(status)) return null;

  const label = shaped.generated_statement_pdf
    ? "Regenerate statement"
    : "Generate statement";

  return (
    <Button
      size="sm"
      variant={shaped.generated_statement_pdf ? "outline" : "default"}
      onClick={() => mut.mutate()}
      disabled={mut.isPending}
    >
      <FileText className="mr-1 size-3.5" />
      {mut.isPending ? "Generating…" : label}
    </Button>
  );
}
