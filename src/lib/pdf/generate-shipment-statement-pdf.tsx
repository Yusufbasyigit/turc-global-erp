import { createClient } from "@/lib/supabase/client";
import { SHIPMENT_INVOICE_BUCKET } from "@/lib/constants";
import { buildStatementPdfFilename } from "./document-filenames";
import {
  setShipmentStatementPdfPath,
} from "@/features/shipments/mutations";
import {
  computeShipmentTotal,
  findShipmentBillingTransaction,
  shipmentInvoiceSignedUrl,
} from "@/features/shipments/queries";
import { listTransactionsForContact } from "@/features/transactions/queries";
import { getAppSettings } from "@/features/settings/queries";
import {
  allocateFifo,
  type LedgerEvent,
  type PaymentAllocationDetail,
} from "@/lib/ledger/fifo-allocation";
import type {
  StatementData,
  StatementLine,
  StatementLineStatus,
  StatementPayment,
} from "./shipment-statement-pdf-types";

function roundCents(n: number): number {
  return Math.round(n * 100) / 100;
}

type OrderLineRow = {
  line_number: number;
  quantity: number;
  unit_sales_price: number | null;
  product_name_snapshot: string;
  unit_snapshot: string | null;
  orders: {
    id: string;
    status: string;
    billing_shipment_id: string | null;
    order_date: string | null;
    created_time: string | null;
  } | null;
};

function classifyLine(
  parentStatus: string,
  parentBillingShipmentId: string | null,
  thisShipmentId: string,
): StatementLineStatus {
  if (parentStatus === "cancelled") return "cancelled";
  if (parentBillingShipmentId !== thisShipmentId) return "rolled_over";
  return "new";
}

async function fetchOtherShipmentNames(
  ids: string[],
): Promise<Map<string, string>> {
  const supabase = createClient();
  const out = new Map<string, string>();
  if (ids.length === 0) return out;
  const { data, error } = await supabase
    .from("shipments")
    .select("id, name")
    .in("id", ids);
  if (error) throw error;
  for (const s of data ?? []) {
    out.set(s.id, s.name);
  }
  return out;
}

export async function assembleShipmentStatementData(
  shipmentId: string,
): Promise<StatementData> {
  const supabase = createClient();

  const [{ data: shipmentRow, error: shipErr }, settings] = await Promise.all([
    supabase
      .from("shipments")
      .select(
        "id, name, customer_id, invoice_currency, freight_cost, etd_date, eta_date, container_type, tracking_number, customer:contacts!shipments_customer_id_fkey(company_name, contact_person, address, city, tax_id, countries(name_en))",
      )
      .eq("id", shipmentId)
      .single(),
    getAppSettings(),
  ]);
  if (shipErr) throw shipErr;
  if (!shipmentRow) throw new Error("Shipment not found");

  const s = shipmentRow as unknown as {
    id: string;
    name: string;
    customer_id: string | null;
    invoice_currency: string;
    freight_cost: number | null;
    etd_date: string | null;
    eta_date: string | null;
    container_type: string | null;
    tracking_number: string | null;
    customer: {
      company_name: string;
      contact_person: string | null;
      address: string | null;
      city: string | null;
      tax_id: string | null;
      countries: { name_en: string | null } | null;
    } | null;
  };

  if (!s.customer_id) {
    throw new Error("Shipment has no customer; cannot generate statement.");
  }

  const billingTxn = await findShipmentBillingTransaction(shipmentId);
  if (!billingTxn) {
    throw new Error("Shipment must be booked before generating a statement.");
  }

  const { data: linesRaw, error: linesErr } = await supabase
    .from("order_details")
    .select(
      "line_number, quantity, unit_sales_price, product_name_snapshot, unit_snapshot, orders!inner(id, status, billing_shipment_id, order_date, created_time)",
    )
    .eq("orders.shipment_id", shipmentId);
  if (linesErr) throw linesErr;

  const lineRows = ((linesRaw ?? []) as unknown as OrderLineRow[])
    .slice()
    .sort((a, b) => {
      const ad = a.orders?.order_date ?? "";
      const bd = b.orders?.order_date ?? "";
      if (ad !== bd) return ad < bd ? -1 : 1;
      const aid = a.orders?.id ?? "";
      const bid = b.orders?.id ?? "";
      if (aid !== bid) return aid < bid ? -1 : 1;
      return a.line_number - b.line_number;
    });

  const otherShipmentIds = Array.from(
    new Set(
      lineRows
        .map((r) => r.orders?.billing_shipment_id ?? null)
        .filter(
          (v): v is string => Boolean(v) && v !== shipmentId,
        ),
    ),
  );
  const otherShipmentNames = await fetchOtherShipmentNames(otherShipmentIds);

  const currency = s.invoice_currency;

  const lines: StatementLine[] = lineRows.map((r, i) => {
    const status = classifyLine(
      r.orders?.status ?? "",
      r.orders?.billing_shipment_id ?? null,
      shipmentId,
    );
    const qty = Number(r.quantity ?? 0);
    const rawPrice =
      r.unit_sales_price === null ? null : Number(r.unit_sales_price);
    const rawLineTotal = rawPrice === null ? null : roundCents(qty * rawPrice);
    // Rolled-over lines are billed on a different shipment; surface them
    // here for context but suppress unit price and total at the data
    // layer so every consumer (PDF, future API, exports) gets the same
    // shape. Same for cancelled lines.
    const visible = status === "new";
    const unitPrice = visible ? rawPrice : null;
    const lineTotal = visible ? rawLineTotal : null;
    const rolledOverToName =
      status === "rolled_over" && r.orders?.billing_shipment_id
        ? otherShipmentNames.get(r.orders.billing_shipment_id)
        : undefined;
    return {
      lineNumber: i + 1,
      productName: r.product_name_snapshot,
      quantity: qty,
      unit: r.unit_snapshot,
      unitPrice,
      lineTotal,
      status,
      rolledOverToName,
    };
  });

  const goodsSubtotal = roundCents(
    lines.reduce((sum, l) => {
      if (l.status !== "new" || l.lineTotal === null) return sum;
      return sum + l.lineTotal;
    }, 0),
  );
  const freightCost = roundCents(Number(s.freight_cost ?? 0));

  const liveTotal = await computeShipmentTotal(shipmentId);
  const grandTotal = roundCents(goodsSubtotal + freightCost);
  // Tolerance covers IEEE-754 drift from JS-side line-total accumulation;
  // we only want to flag a *user-visible* difference (>= 1 cent).
  const isBillingStale =
    Math.abs(Number(billingTxn.amount) - Number(liveTotal)) >= 0.005;

  const ledgerRows = await listTransactionsForContact(s.customer_id);
  const events: LedgerEvent[] = ledgerRows.map((row) => {
    if (row.created_time === null) {
      throw new Error(
        `LedgerEvent ${row.id} is missing created_time (transactions.created_time is NOT NULL in DB).`,
      );
    }
    return {
      id: row.id,
      date: row.transaction_date,
      created_time: row.created_time,
      kind: row.kind as LedgerEvent["kind"],
      amount: Number(row.amount),
      currency: row.currency,
      related_shipment_id: row.related_shipment_id,
      fx_converted_amount:
        row.fx_converted_amount === null ? null : Number(row.fx_converted_amount),
      fx_target_currency: row.fx_target_currency,
    };
  });

  const fifo = allocateFifo(events, currency);

  const paymentsForThis = fifo.payment_allocations.filter(
    (a) => a.related_shipment_id === shipmentId,
  );

  const allocationsByPayment = new Map<string, PaymentAllocationDetail[]>();
  for (const a of fifo.payment_allocations) {
    const arr = allocationsByPayment.get(a.payment_event_id) ?? [];
    arr.push(a);
    allocationsByPayment.set(a.payment_event_id, arr);
  }

  const ledgerById = new Map(ledgerRows.map((r) => [r.id, r]));
  const shipmentNamesByBillingTxnId = new Map<string, string>();
  for (const row of ledgerRows) {
    if (row.kind === "shipment_billing" && row.related_shipment) {
      shipmentNamesByBillingTxnId.set(
        row.id,
        row.related_shipment.name ?? "(inconnu)",
      );
    }
  }

  const payments: StatementPayment[] = paymentsForThis
    .slice()
    .sort((a, b) => {
      if (a.payment_date !== b.payment_date)
        return a.payment_date < b.payment_date ? -1 : 1;
      return a.payment_event_id < b.payment_event_id ? -1 : 1;
    })
    .map((alloc) => {
      const txn = ledgerById.get(alloc.payment_event_id);
      const description =
        (txn?.description ?? "").trim() || "Paiement reçu";
      const allOthers = (allocationsByPayment.get(alloc.payment_event_id) ?? [])
        .filter((a) => a.related_shipment_id !== shipmentId);
      let partialAnnotation: string | null = null;
      if (allOthers.length > 0) {
        const otherNames = Array.from(
          new Set(
            allOthers.map(
              (a) =>
                shipmentNamesByBillingTxnId.get(a.shipment_billing_id) ??
                "autre envoi",
            ),
          ),
        );
        partialAnnotation = `(attribué partiellement à ${otherNames.join(", ")})`;
      }
      return {
        date: alloc.payment_date,
        description,
        allocatedAmount: alloc.allocated_amount,
        partialAnnotation,
      };
    });

  const totalReceived = payments.reduce((s, p) => s + p.allocatedAmount, 0);
  const balance = grandTotal - totalReceived;
  const hasSkippedCurrencyEvents = fifo.skipped_events.length > 0;

  return {
    shipment: {
      name: s.name,
      trackingNumber: s.tracking_number,
      containerType: s.container_type,
      etdDate: s.etd_date,
      etaDate: s.eta_date,
      invoiceCurrency: currency,
      freightCost,
    },
    company: {
      name: settings.company_name,
      addressLine1: settings.address_line1,
      addressLine2: settings.address_line2,
      phone: settings.phone,
      email: settings.email,
      taxId: (settings as unknown as { tax_id?: string | null }).tax_id ?? null,
      taxOffice:
        (settings as unknown as { tax_office?: string | null }).tax_office ??
        null,
    },
    customer: {
      companyName: s.customer?.company_name ?? "—",
      contactPerson: s.customer?.contact_person ?? null,
      address: s.customer?.address ?? null,
      city: s.customer?.city ?? null,
      countryName: s.customer?.countries?.name_en ?? null,
      taxId: s.customer?.tax_id ?? null,
    },
    lines,
    goodsSubtotal,
    grandTotal,
    payments,
    totalReceived,
    balance,
    isBillingStale,
    hasSkippedCurrencyEvents,
  };
}

export async function generateShipmentStatementPdf(
  shipmentId: string,
): Promise<{ path: string; signedUrl: string; shipmentName: string }> {
  const supabase = createClient();
  const data = await assembleShipmentStatementData(shipmentId);

  const [{ pdf }, { ShipmentStatementDocument }] = await Promise.all([
    import("@react-pdf/renderer"),
    import("./shipment-statement-pdf"),
  ]);

  const blob = await pdf(<ShipmentStatementDocument data={data} />).toBlob();
  const timestamp = Math.floor(Date.now() / 1000);
  const path = `${shipmentId}/statement-${timestamp}.pdf`;

  const { error: uploadErr } = await supabase.storage
    .from(SHIPMENT_INVOICE_BUCKET)
    .upload(path, blob, {
      cacheControl: "3600",
      upsert: false,
      contentType: "application/pdf",
    });
  if (uploadErr) throw uploadErr;

  await setShipmentStatementPdfPath({ shipment_id: shipmentId, path });

  const downloadFilename = buildStatementPdfFilename({
    shipmentName: data.shipment.name,
    customerName: data.customer.companyName,
    etdDate: data.shipment.etdDate,
  });
  const signedUrl = await shipmentInvoiceSignedUrl(
    path,
    3600,
    downloadFilename,
  );
  if (!signedUrl) throw new Error("Failed to create signed URL.");

  return { path, signedUrl, shipmentName: data.shipment.name };
}
