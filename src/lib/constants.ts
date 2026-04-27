import type { ContactType, PackagingType } from "@/lib/supabase/types";

export const CONTACT_TYPE_LABELS: Record<ContactType, string> = {
  customer: "Customer",
  supplier: "Supplier",
  logistics: "Logistics",
  real_estate: "Real Estate",
  other: "Other",
};

export const CONTACT_TYPE_BADGE_CLASSES: Record<ContactType, string> = {
  customer:
    "border-transparent bg-emerald-500/15 text-emerald-800 hover:bg-emerald-500/25",
  supplier:
    "border-transparent bg-sky-500/15 text-sky-800 hover:bg-sky-500/25",
  logistics:
    "border-transparent bg-amber-500/20 text-amber-800 hover:bg-amber-500/30",
  real_estate:
    "border-transparent bg-violet-500/15 text-violet-800 hover:bg-violet-500/25",
  other:
    "border-transparent bg-zinc-500/15 text-zinc-700 hover:bg-zinc-500/25",
};

export const PACKAGING_TYPE_LABELS: Record<PackagingType, string> = {
  box: "Box",
  pallet: "Pallet",
  carton: "Carton",
  bag: "Bag",
  other: "Other",
};

export const PRODUCT_IMAGE_BUCKET = "product-photos";
export const MAX_PRODUCT_IMAGE_BYTES = 5 * 1024 * 1024;
export const ACCEPTED_PRODUCT_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const TRANSACTION_ATTACHMENT_BUCKET = "transaction-attachments";
export const MAX_TRANSACTION_ATTACHMENT_BYTES = 5 * 1024 * 1024;
export const ACCEPTED_TRANSACTION_ATTACHMENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;

export const ORDER_ATTACHMENT_BUCKET = "order-attachments";
export const MAX_ORDER_ATTACHMENT_BYTES = 5 * 1024 * 1024;
export const ACCEPTED_ORDER_ATTACHMENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;

export const SHIPMENT_DOCUMENTS_BUCKET = "shipment-documents";
export const MAX_SHIPMENT_DOCUMENT_BYTES = 5 * 1024 * 1024;
export const ACCEPTED_SHIPMENT_DOCUMENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;

export const SHIPMENT_INVOICE_BUCKET = "shipment-invoices";
