import type { Database } from "@/types/database";

type PublicTable<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T];

export type Contact = PublicTable<"contacts">["Row"];
export type ContactInsert = PublicTable<"contacts">["Insert"];
export type ContactUpdate = PublicTable<"contacts">["Update"];

export type ContactNote = PublicTable<"contact_notes">["Row"];
export type ContactNoteInsert = PublicTable<"contact_notes">["Insert"];

export type Country = PublicTable<"countries">["Row"];

export type Product = PublicTable<"products">["Row"];
export type ProductInsert = PublicTable<"products">["Insert"];
export type ProductUpdate = PublicTable<"products">["Update"];

export type ProductCategory = PublicTable<"product_categories">["Row"];
export type ProductCategoryInsert = PublicTable<"product_categories">["Insert"];

export type Account = PublicTable<"accounts">["Row"];
export type AccountInsert = PublicTable<"accounts">["Insert"];
export type AccountUpdate = PublicTable<"accounts">["Update"];

export type CustodyLocation = PublicTable<"custody_locations">["Row"];

export type FxSnapshot = PublicTable<"fx_snapshots">["Row"];
export type FxSnapshotInsert = PublicTable<"fx_snapshots">["Insert"];

export type PriceSnapshot = PublicTable<"price_snapshots">["Row"];
export type PriceSnapshotInsert = PublicTable<"price_snapshots">["Insert"];

export type RefreshOutcomeJson = {
  inserted: number;
  skipped: string[];
  errors: string[];
};

// Inline until `npm run db:types` regenerates `database.ts` after the
// `rate_refresh_runs` migration lands. Swap to PublicTable<"rate_refresh_runs">
// at that point.
export type RateRefreshRun = {
  id: string;
  ran_at: string;
  triggered_by: "cron" | "manual";
  fx_outcome: RefreshOutcomeJson | null;
  price_outcome: RefreshOutcomeJson | null;
  error_message: string | null;
};

// Inline until `npm run db:types` regenerates `database.ts` after the
// `app_settings` migration lands. Swap to PublicTable<"app_settings"> then.
export type AppSettings = {
  id: true;
  company_name: string;
  address_line1: string;
  address_line2: string;
  phone: string;
  email: string;
  updated_time: string;
  updated_by: string | null;
};
export type AppSettingsUpdate = Partial<Omit<AppSettings, "id" | "updated_time">>;

export type TreasuryMovement = PublicTable<"treasury_movements">["Row"];
export type TreasuryMovementInsert = PublicTable<"treasury_movements">["Insert"];
export type TreasuryMovementUpdate = PublicTable<"treasury_movements">["Update"];

export type Transaction = PublicTable<"transactions">["Row"];
export type TransactionInsert = PublicTable<"transactions">["Insert"];
export type TransactionUpdate = PublicTable<"transactions">["Update"];

export type Partner = PublicTable<"partners">["Row"];
export type PartnerInsert = PublicTable<"partners">["Insert"];
export type PartnerUpdate = PublicTable<"partners">["Update"];

export type PsdEvent = PublicTable<"psd_events">["Row"];
export type PsdEventInsert = PublicTable<"psd_events">["Insert"];
export type PsdEventUpdate = PublicTable<"psd_events">["Update"];

export type LoanInstallment = PublicTable<"loan_installments">["Row"];
export type LoanInstallmentInsert = PublicTable<"loan_installments">["Insert"];
export type LoanInstallmentUpdate = PublicTable<"loan_installments">["Update"];

export type RealEstateDeal = PublicTable<"real_estate_deals">["Row"];
export type RealEstateDealInsert = PublicTable<"real_estate_deals">["Insert"];
export type RealEstateDealUpdate = PublicTable<"real_estate_deals">["Update"];

export type RealEstateInstallment =
  PublicTable<"real_estate_installments">["Row"];
export type RealEstateInstallmentInsert =
  PublicTable<"real_estate_installments">["Insert"];
export type RealEstateInstallmentUpdate =
  PublicTable<"real_estate_installments">["Update"];

export type ExpenseType = PublicTable<"expense_types">["Row"];
export type ExpenseTypeInsert = PublicTable<"expense_types">["Insert"];

export type RecurringPayment = PublicTable<"recurring_payments">["Row"];
export type RecurringPaymentInsert = PublicTable<"recurring_payments">["Insert"];
export type RecurringPaymentUpdate = PublicTable<"recurring_payments">["Update"];

export type RecurringPaymentOccurrence =
  PublicTable<"recurring_payment_occurrences">["Row"];
export type RecurringPaymentOccurrenceInsert =
  PublicTable<"recurring_payment_occurrences">["Insert"];
export type RecurringPaymentOccurrenceUpdate =
  PublicTable<"recurring_payment_occurrences">["Update"];

export const RECURRING_PAYMENT_STATUSES = ["active", "paused"] as const;
export type RecurringPaymentStatus =
  (typeof RECURRING_PAYMENT_STATUSES)[number];

export const RECURRING_OCCURRENCE_STATUSES = ["paid", "skipped"] as const;
export type RecurringOccurrenceStatus =
  (typeof RECURRING_OCCURRENCE_STATUSES)[number];

export type MonthlyFxOverride = PublicTable<"monthly_fx_overrides">["Row"];
export type MonthlyFxOverrideInsert = PublicTable<"monthly_fx_overrides">["Insert"];
export type MonthlyFxOverrideUpdate = PublicTable<"monthly_fx_overrides">["Update"];

export type Order = PublicTable<"orders">["Row"];
export type OrderInsert = PublicTable<"orders">["Insert"];
export type OrderUpdate = PublicTable<"orders">["Update"];

export type OrderDetail = PublicTable<"order_details">["Row"];
export type OrderDetailInsert = PublicTable<"order_details">["Insert"];
export type OrderDetailUpdate = PublicTable<"order_details">["Update"];

export type Shipment = PublicTable<"shipments">["Row"];
export type ShipmentInsert = PublicTable<"shipments">["Insert"];
export type ShipmentUpdate = PublicTable<"shipments">["Update"];

export const CONTACT_TYPES = [
  "customer",
  "supplier",
  "logistics",
  "real_estate",
  "other",
] as const;
export type ContactType = (typeof CONTACT_TYPES)[number];

export const REAL_ESTATE_SUB_TYPES = ["rent", "sale"] as const;
export type RealEstateSubType = (typeof REAL_ESTATE_SUB_TYPES)[number];

export const BALANCE_CURRENCIES = ["TRY", "EUR", "USD", "GBP"] as const;
export type BalanceCurrency = (typeof BALANCE_CURRENCIES)[number];

export const PACKAGING_TYPES = [
  "box",
  "pallet",
  "carton",
  "bag",
  "other",
] as const;
export type PackagingType = (typeof PACKAGING_TYPES)[number];

export const KDV_RATES = [0, 1, 10, 20] as const;
export type KdvRate = (typeof KDV_RATES)[number];

export const MOVEMENT_KINDS = [
  "opening",
  "deposit",
  "withdraw",
  "transfer",
  "trade",
  "adjustment",
] as const;
export type MovementKind = (typeof MOVEMENT_KINDS)[number];

export const ORTAK_MOVEMENT_TYPES = [
  "partner_loan_in",
  "partner_loan_out",
  "profit_share",
] as const;
export type OrtakMovementType = (typeof ORTAK_MOVEMENT_TYPES)[number];

export const ASSET_TYPES = [
  "fiat",
  "credit_card",
  "crypto",
  "metal",
  "fund",
] as const;
export type AssetType = (typeof ASSET_TYPES)[number];

export const TRANSACTION_KINDS = [
  "client_payment",
  "client_refund",
  "supplier_payment",
  "supplier_invoice",
  "expense",
  "other_income",
  "partner_loan_in",
  "partner_loan_out",
  "profit_distribution",
  "tax_payment",
  "shipment_billing",
  "shipment_cogs",
  "shipment_freight",
] as const;
export type TransactionKind = (typeof TRANSACTION_KINDS)[number];

export const ORDER_STATUSES = [
  "inquiry",
  "quoted",
  "accepted",
  "in_production",
  "shipped",
  "delivered",
  "cancelled",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const SHIPMENT_STATUSES = [
  "draft",
  "booked",
  "in_transit",
  "arrived",
] as const;
export type ShipmentStatus = (typeof SHIPMENT_STATUSES)[number];

export const TRANSPORT_METHODS = ["sea", "road", "air", "other"] as const;
export type TransportMethod = (typeof TRANSPORT_METHODS)[number];

export const WAVE_1_KINDS = [
  "client_payment",
  "client_refund",
  "expense",
  "other_income",
] as const satisfies readonly TransactionKind[];
export type Wave1Kind = (typeof WAVE_1_KINDS)[number];

export const DISABLED_KINDS = [
  "shipment_billing",
  "shipment_cogs",
  "shipment_freight",
  "profit_distribution",
] as const satisfies readonly TransactionKind[];
export type DisabledKind = (typeof DISABLED_KINDS)[number];

export const CUSTODY_LOCATION_TYPES = ["bank", "physical"] as const;
export type CustodyLocationType = (typeof CUSTODY_LOCATION_TYPES)[number];

export type ContactWithCountry = Contact & {
  countries: Pick<Country, "code" | "name_en" | "flag_emoji"> | null;
};

export type SupplierSummary = Pick<Contact, "id" | "company_name">;

export type ProductWithRelations = Product & {
  product_categories: Pick<ProductCategory, "id" | "name"> | null;
  supplier: SupplierSummary | null;
};

export type AccountWithCustody = Account & {
  custody_locations: Pick<
    CustodyLocation,
    "id" | "name" | "location_type" | "is_active" | "requires_movement_type"
  > | null;
};

export type CustomerSummary = Pick<
  Contact,
  "id" | "company_name" | "balance_currency"
>;

export type ShipmentSummary = Pick<
  Shipment,
  "id" | "name" | "status" | "invoice_currency"
>;

export type OrderWithRelations = Order & {
  customer: CustomerSummary | null;
  shipment: ShipmentSummary | null;
  line_count: number;
  order_details?: Pick<
    OrderDetail,
    "id" | "line_number" | "quantity" | "unit_sales_price" | "vat_rate"
  >[];
};

export type OrderDetailWithRelations = OrderDetail & {
  supplier: SupplierSummary | null;
};

export type ShipmentWithRelations = Shipment & {
  customer: CustomerSummary | null;
  order_count: number;
};
