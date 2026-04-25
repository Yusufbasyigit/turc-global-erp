export type StatementLineStatus = "new" | "rolled_over" | "cancelled";

export type StatementLine = {
  lineNumber: number;
  productName: string;
  quantity: number;
  unit: string | null;
  unitPrice: number | null;
  lineTotal: number | null;
  status: StatementLineStatus;
  rolledOverToName?: string;
};

export type StatementPayment = {
  date: string;
  description: string;
  allocatedAmount: number;
  partialAnnotation: string | null;
};

export type StatementData = {
  shipment: {
    name: string;
    trackingNumber: string | null;
    containerType: string | null;
    etdDate: string | null;
    etaDate: string | null;
    invoiceCurrency: string;
    freightCost: number;
  };
  customer: {
    companyName: string;
    contactPerson: string | null;
    address: string | null;
    city: string | null;
    countryName: string | null;
  };
  lines: StatementLine[];
  goodsSubtotal: number;
  grandTotal: number;
  payments: StatementPayment[];
  totalReceived: number;
  balance: number;
  isBillingStale: boolean;
  hasSkippedCurrencyEvents: boolean;
};
