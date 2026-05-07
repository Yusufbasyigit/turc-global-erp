export type ProformaLine = {
  lineNumber: number;
  productName: string;
  description: string | null;
  unit: string | null;
  quantity: number;
  unitPrice: number;
  photoUrl: string | null;
};

export type ProformaCompany = {
  name: string;
  addressLine1: string;
  addressLine2: string;
  phone: string;
  email: string;
  // Turkish VKN + tax office. Optional today because the columns aren't
  // yet on app_settings; once the schema migration lands, the assembler
  // populates them and the header renders the fiscal block.
  taxId: string | null;
  taxOffice: string | null;
};

export type ProformaData = {
  offerNumber: string;
  offerDate: string | null;
  offerValidUntil: string | null;
  currency: string;
  incoterm: string | null;
  deliveryTimeline: string | null;
  paymentTerms: string | null;
  company: ProformaCompany;
  customer: {
    companyName: string;
    contactPerson: string | null;
    address: string | null;
    city: string | null;
    countryName: string | null;
    taxId: string | null;
  };
  lines: ProformaLine[];
  notes: {
    remark: string | null;
    validity: string | null;
    deliveryLocation: string | null;
    productionTime: string | null;
    lengthTolerance: string | null;
    totalWeight: string | null;
  };
};
