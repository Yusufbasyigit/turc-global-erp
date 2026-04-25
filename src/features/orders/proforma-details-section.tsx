"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { OrderWithRelations } from "@/lib/supabase/types";
import { ProformaDetailsForm } from "./proforma-details-form";

type OrderProformaShape = OrderWithRelations & {
  offer_number: string | null;
  offer_date: string | null;
  offer_valid_until: string | null;
  incoterm: string | null;
  delivery_timeline: string | null;
  payment_terms: string | null;
  proforma_notes_remark: string | null;
  proforma_notes_validity: string | null;
  proforma_notes_delivery_location: string | null;
  proforma_notes_production_time: string | null;
  proforma_notes_length_tolerance: string | null;
  proforma_notes_total_weight: string | null;
};

function anyProformaFieldSet(o: OrderProformaShape): boolean {
  return Boolean(
    o.offer_number ||
      o.offer_date ||
      o.offer_valid_until ||
      o.incoterm ||
      o.delivery_timeline ||
      o.payment_terms ||
      o.proforma_notes_remark ||
      o.proforma_notes_validity ||
      o.proforma_notes_delivery_location ||
      o.proforma_notes_production_time ||
      o.proforma_notes_length_tolerance ||
      o.proforma_notes_total_weight,
  );
}

export function ProformaDetailsSection({
  order,
}: {
  order: OrderWithRelations;
}) {
  const shaped = order as OrderProformaShape;
  const [expanded, setExpanded] = useState(() => anyProformaFieldSet(shaped));

  return (
    <section className="rounded-lg border">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-2 p-3 text-left hover:bg-muted/40"
      >
        <div className="flex items-center gap-2">
          {expanded ? (
            <ChevronDown className="size-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-4 text-muted-foreground" />
          )}
          <h2 className="text-sm font-medium">Proforma details</h2>
          {shaped.offer_number ? (
            <Badge variant="outline" className="font-mono text-[10px]">
              {shaped.offer_number}
            </Badge>
          ) : null}
        </div>
        {!expanded && !anyProformaFieldSet(shaped) ? (
          <span className="text-xs text-muted-foreground">
            Fill in to advance to Quoted →
          </span>
        ) : null}
      </button>
      {expanded ? (
        <div className="border-t p-4">
          <ProformaDetailsForm
            order={{
              id: shaped.id,
              order_currency: shaped.order_currency,
              offer_number: shaped.offer_number,
              offer_date: shaped.offer_date,
              offer_valid_until: shaped.offer_valid_until,
              incoterm: shaped.incoterm,
              delivery_timeline: shaped.delivery_timeline,
              payment_terms: shaped.payment_terms,
              proforma_notes_remark: shaped.proforma_notes_remark,
              proforma_notes_validity: shaped.proforma_notes_validity,
              proforma_notes_delivery_location:
                shaped.proforma_notes_delivery_location,
              proforma_notes_production_time:
                shaped.proforma_notes_production_time,
              proforma_notes_length_tolerance:
                shaped.proforma_notes_length_tolerance,
              proforma_notes_total_weight: shaped.proforma_notes_total_weight,
            }}
          />
        </div>
      ) : null}
    </section>
  );
}
