import { createClient } from "@/lib/supabase/client";
import {
  ORDER_ATTACHMENT_BUCKET,
  PRODUCT_IMAGE_BUCKET,
} from "@/lib/constants";
import { setOrderProposalPdfPath } from "@/features/orders/mutations";
import { orderAttachmentSignedUrl } from "@/features/orders/queries";
import type { ProformaData, ProformaLine } from "./proforma-pdf-types";

async function signProductPhotoUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const supabase = createClient();
  const { data } = await supabase.storage
    .from(PRODUCT_IMAGE_BUCKET)
    .createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

export async function assembleProformaData(
  orderId: string,
): Promise<ProformaData> {
  const supabase = createClient();

  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select(
      "*, customer:contacts!orders_customer_id_fkey(id, company_name, contact_person, address, city, countries(code, name_en))",
    )
    .eq("id", orderId)
    .single();
  if (orderErr) throw orderErr;
  if (!order) throw new Error("Order not found");

  const { data: lines, error: linesErr } = await supabase
    .from("order_details")
    .select("*")
    .eq("order_id", orderId)
    .order("line_number", { ascending: true });
  if (linesErr) throw linesErr;

  const photoUrls = await Promise.all(
    (lines ?? []).map((l) =>
      signProductPhotoUrl(
        (l as { product_photo_snapshot: string | null }).product_photo_snapshot,
      ),
    ),
  );

  const o = order as unknown as Record<string, string | null> & {
    customer: {
      company_name: string;
      contact_person: string | null;
      address: string | null;
      city: string | null;
      countries: { name_en: string | null } | null;
    } | null;
    order_currency: string;
    offer_number: string | null;
    offer_date: string | null;
    offer_valid_until: string | null;
    incoterm: string | null;
    delivery_timeline: string | null;
    payment_terms: string | null;
  };

  const proformaLines: ProformaLine[] = (lines ?? []).map((row, i) => {
    const l = row as {
      line_number: number;
      product_name_snapshot: string;
      product_description_snapshot: string | null;
      unit_snapshot: string | null;
      quantity: number;
      unit_sales_price: number | null;
    };
    return {
      lineNumber: l.line_number,
      productName: l.product_name_snapshot,
      description: l.product_description_snapshot,
      unit: l.unit_snapshot,
      quantity: Number(l.quantity ?? 0),
      unitPrice: Number(l.unit_sales_price ?? 0),
      photoUrl: photoUrls[i] ?? null,
    };
  });

  return {
    offerNumber: o.offer_number ?? "—",
    offerDate: o.offer_date,
    offerValidUntil: o.offer_valid_until,
    currency: o.order_currency,
    incoterm: o.incoterm,
    deliveryTimeline: o.delivery_timeline,
    paymentTerms: o.payment_terms,
    customer: {
      companyName: o.customer?.company_name ?? "—",
      contactPerson: o.customer?.contact_person ?? null,
      address: o.customer?.address ?? null,
      city: o.customer?.city ?? null,
      countryName: o.customer?.countries?.name_en ?? null,
    },
    lines: proformaLines,
    notes: {
      remark: o.proforma_notes_remark,
      validity: o.proforma_notes_validity,
      deliveryLocation: o.proforma_notes_delivery_location,
      productionTime: o.proforma_notes_production_time,
      lengthTolerance: o.proforma_notes_length_tolerance,
      totalWeight: o.proforma_notes_total_weight,
    },
  };
}

export async function generateProformaPdf(
  orderId: string,
): Promise<{ path: string; signedUrl: string; offerNumber: string }> {
  const supabase = createClient();
  const data = await assembleProformaData(orderId);
  if (data.offerNumber === "—" || !data.offerNumber) {
    throw new Error("Save proforma metadata first.");
  }

  const [{ pdf }, { ProformaDocument }] = await Promise.all([
    import("@react-pdf/renderer"),
    import("./proforma-pdf"),
  ]);

  const blob = await pdf(<ProformaDocument data={data} />).toBlob();
  const path = `${orderId}/proposal/${data.offerNumber}.pdf`;

  const { error: uploadErr } = await supabase.storage
    .from(ORDER_ATTACHMENT_BUCKET)
    .upload(path, blob, {
      cacheControl: "3600",
      upsert: true,
      contentType: "application/pdf",
    });
  if (uploadErr) throw uploadErr;

  await setOrderProposalPdfPath({ order_id: orderId, path });

  const signedUrl = await orderAttachmentSignedUrl(path, 3600);
  if (!signedUrl) throw new Error("Failed to create signed URL.");

  return { path, signedUrl, offerNumber: data.offerNumber };
}
