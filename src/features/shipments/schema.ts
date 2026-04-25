import { z } from "zod";
import {
  BALANCE_CURRENCIES,
  TRANSPORT_METHODS,
} from "@/lib/supabase/types";

const trimmed = () => z.string().trim();

const optionalString = z.preprocess(
  (v) => {
    if (v === null || v === undefined) return null;
    if (typeof v === "string") {
      const t = v.trim();
      return t === "" ? null : t;
    }
    return null;
  },
  z.string().nullable(),
);

const optionalNumber = z.preprocess(
  (v) => {
    if (v === null || v === undefined) return null;
    if (typeof v === "number") return Number.isFinite(v) ? v : null;
    if (typeof v === "string") {
      const t = v.trim();
      if (t === "") return null;
      const n = Number(t);
      return Number.isFinite(n) ? n : NaN;
    }
    return null;
  },
  z.number({ error: "Must be a number" }).min(0).nullable(),
);

const optionalTransport = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? null : v),
  z.enum(TRANSPORT_METHODS).nullable(),
);

const optionalDate = z.preprocess(
  (v) => {
    if (v === null || v === undefined) return null;
    if (typeof v === "string") {
      const t = v.trim();
      return t === "" ? null : t;
    }
    return null;
  },
  z.string().nullable(),
);

export const shipmentFormSchema = z.object({
  customer_id: z.string().min(1, "Customer is required"),
  name: trimmed().min(1, "Name is required"),
  tracking_number: optionalString,
  transport_method: optionalTransport,
  container_type: optionalString,
  vessel_name: optionalString,
  etd_date: optionalDate,
  eta_date: optionalDate,
  invoice_currency: z.enum(BALANCE_CURRENCIES),
  freight_cost: optionalNumber,
  freight_currency: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : v),
    z.enum(BALANCE_CURRENCIES).nullable(),
  ),
  notes: z.string().optional().default(""),
});

export type ShipmentFormValues = {
  customer_id: string;
  name: string;
  tracking_number: string | null;
  transport_method: (typeof TRANSPORT_METHODS)[number] | "" | null;
  container_type: string | null;
  vessel_name: string | null;
  etd_date: string | null;
  eta_date: string | null;
  invoice_currency: (typeof BALANCE_CURRENCIES)[number];
  freight_cost: string | number | null;
  freight_currency: (typeof BALANCE_CURRENCIES)[number] | "" | null;
  notes?: string;
};

export type ShipmentFormOutput = z.output<typeof shipmentFormSchema>;
