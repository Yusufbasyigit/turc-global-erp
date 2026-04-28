"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Controller,
  useForm,
  useWatch,
  type FieldPath,
  type Resolver,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  FileText,
  Trash2,
  Upload,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Combobox } from "@/components/ui/combobox";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format-money";
import {
  ACCEPTED_TRANSACTION_ATTACHMENT_TYPES,
  MAX_TRANSACTION_ATTACHMENT_BYTES,
} from "@/lib/constants";
import {
  BALANCE_CURRENCIES,
  DISABLED_KINDS,
  KDV_RATES,
  type AccountWithCustody,
  type Contact,
  type TransactionInsert,
  type TransactionKind,
} from "@/lib/supabase/types";
import { createClient } from "@/lib/supabase/client";

import {
  KIND_CATEGORIES,
  TRANSACTION_KIND_DESCRIPTIONS,
  TRANSACTION_KIND_LABELS,
  locateKind,
  type KindCategoryId,
  type KindSubCategoryId,
} from "./constants";
import {
  transactionSchema,
  type TransactionOutput,
  type TransactionValues,
} from "./schema";
import {
  createExpenseType,
  createPartner,
  createTransaction,
  updateTransaction,
} from "./mutations";
import {
  listExpenseTypes,
  listPartners,
  listUnpaidSupplierInvoices,
  transactionKeys,
  type TransactionWithRelations,
  type UnpaidSupplierInvoice,
} from "./queries";
import { todayDateString } from "@/features/treasury/fx-utils";
import { treasuryKeys } from "@/features/treasury/queries";

type StepId = "kind" | "parties" | "details" | "vat" | "attachment";

const STEP_TITLES: Record<StepId, string> = {
  kind: "Kind",
  parties: "Counterparty & custody",
  details: "Amount & details",
  vat: "VAT",
  attachment: "Attachment",
};

type MinimalValues = TransactionValues;

function defaultValues(): MinimalValues {
  return {
    kind: "client_payment",
    transaction_date: todayDateString(),
    amount: "" as unknown as number,
    currency: "USD",
    description: "",
    reference_number: "",
    contact_id: "",
    contact_balance_currency: "",
    to_account_id: "",
    from_account_id: "",
    fx_rate_applied: "" as unknown as number,
    fx_target_currency: "",
    fx_converted_amount: "" as unknown as number,
    expense_type_id: "",
    paid_by: "business",
    partner_id: "",
    vat_rate: null,
    vat_amount: "" as unknown as number,
    net_amount: "" as unknown as number,
    related_order_id: "",
    related_payable_id: "",
    kdv_period: "",
  } as MinimalValues;
}

async function listCustomerContacts(): Promise<
  Pick<Contact, "id" | "company_name" | "balance_currency">[]
> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("contacts")
    .select("id, company_name, balance_currency")
    .eq("type", "customer")
    .is("deleted_at", null)
    .order("company_name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

async function listSupplierContacts(): Promise<
  Pick<Contact, "id" | "company_name">[]
> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("contacts")
    .select("id, company_name")
    .eq("type", "supplier")
    .is("deleted_at", null)
    .order("company_name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

async function listAllContacts(): Promise<
  Pick<Contact, "id" | "company_name">[]
> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("contacts")
    .select("id, company_name")
    .is("deleted_at", null)
    .order("company_name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export type TransactionPrefill = {
  kind?: TransactionKind;
  partner_id?: string;
  contact_id?: string;
  currency?: string;
  amount?: number;
  kdv_period?: string;
  reference_number_placeholder?: string;
  paid_by?: "business" | "partner";
  from_account_id?: string;
  to_account_id?: string;
};

export function TransactionFormDialog({
  open,
  onOpenChange,
  accounts,
  transaction,
  prefill,
  onMoveMoney,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  accounts: AccountWithCustody[];
  transaction?: TransactionWithRelations | null;
  prefill?: TransactionPrefill | null;
  onMoveMoney?: (kind: "transfer" | "trade") => void;
}) {
  const qc = useQueryClient();
  const isEdit = Boolean(transaction);
  const [stepIndex, setStepIndex] = useState(0);

  type KindView =
    | { level: "categories" }
    | { level: "sub"; category: KindCategoryId }
    | { level: "move" }
    | {
        level: "kinds";
        category: KindCategoryId;
        sub: KindSubCategoryId | null;
      };

  const [kindView, setKindView] = useState<KindView>({ level: "categories" });

  // Lazy-init UUID for new-transaction inserts so storage uploads can use it
  // as a path prefix before the row is inserted. Reset on close so each "new"
  // session gets a fresh ID.
  const [stableNewId, setStableNewId] = useState(() => crypto.randomUUID());
  const effectiveTxnId = isEdit
    ? (transaction!.id as string)
    : stableNewId;

  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);
  const [requestedRemoval, setRequestedRemoval] = useState(false);

  const form = useForm<MinimalValues, unknown, TransactionOutput>({
    resolver: zodResolver(transactionSchema) as unknown as Resolver<
      MinimalValues,
      unknown,
      TransactionOutput
    >,
    defaultValues: defaultValues(),
    mode: "onBlur",
  });

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setPendingFile(null);
      setPendingPreview(null);
      setRequestedRemoval(false);
      setStepIndex(0);
      setKindView({ level: "categories" });
      if (!isEdit) setStableNewId(crypto.randomUUID());
    }
    onOpenChange(next);
  };

  useEffect(() => {
    if (!open) return;
    if (isEdit && transaction) {
      form.reset(toFormValues(transaction));
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStepIndex(0);
      const path = locateKind(transaction.kind as TransactionKind);
      setKindView({
        level: "kinds",
        category: path.category,
        sub: path.sub,
      });
      return;
    }
    const base = defaultValues();
    if (prefill) {
      const mutable = base as Record<string, unknown>;
      if (prefill.kind) mutable.kind = prefill.kind;
      if (prefill.currency && (BALANCE_CURRENCIES as readonly string[]).includes(prefill.currency))
        mutable.currency = prefill.currency;
      if (prefill.amount != null && Number.isFinite(prefill.amount))
        mutable.amount = prefill.amount;
      if (prefill.partner_id) mutable.partner_id = prefill.partner_id;
      if (prefill.contact_id) mutable.contact_id = prefill.contact_id;
      if (prefill.kdv_period) mutable.kdv_period = prefill.kdv_period;
      if (prefill.paid_by) mutable.paid_by = prefill.paid_by;
      if (prefill.from_account_id) mutable.from_account_id = prefill.from_account_id;
      if (prefill.to_account_id) mutable.to_account_id = prefill.to_account_id;
    }
    form.reset(base);
    setStepIndex(prefill?.kind ? 1 : 0);
    if (prefill?.kind) {
      const path = locateKind(prefill.kind);
      setKindView({
        level: "kinds",
        category: path.category,
        sub: path.sub,
      });
    } else {
      setKindView({ level: "categories" });
    }
  }, [open, isEdit, transaction, form, prefill]);

  useEffect(() => {
    if (!pendingPreview) return;
    return () => URL.revokeObjectURL(pendingPreview);
  }, [pendingPreview]);

  const { data: customers = [] } = useQuery({
    queryKey: ["contacts", "customers"],
    queryFn: listCustomerContacts,
    staleTime: 60_000,
    enabled: open,
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ["contacts", "suppliers"],
    queryFn: listSupplierContacts,
    staleTime: 60_000,
    enabled: open,
  });

  const { data: partners = [] } = useQuery({
    queryKey: transactionKeys.partners(),
    queryFn: () => listPartners({ activeOnly: true }),
    staleTime: 60_000,
    enabled: open,
  });

  const { data: expenseTypes = [] } = useQuery({
    queryKey: transactionKeys.expenseTypes(),
    queryFn: listExpenseTypes,
    staleTime: 60_000,
    enabled: open,
  });

  const { data: allContacts = [] } = useQuery({
    queryKey: ["contacts", "all"],
    queryFn: listAllContacts,
    staleTime: 60_000,
    enabled: open,
  });

  const kind = useWatch({ control: form.control, name: "kind" }) as TransactionKind;
  const currency = useWatch({ control: form.control, name: "currency" });
  const amount = useWatch({ control: form.control, name: "amount" });
  const fxRate = useWatch({ control: form.control, name: "fx_rate_applied" });
  const vatRate = useWatch({ control: form.control, name: "vat_rate" });
  const paidBy = useWatch({ control: form.control, name: "paid_by" });
  const contactId = useWatch({ control: form.control, name: "contact_id" });
  const partnerId = useWatch({ control: form.control, name: "partner_id" });
  const relatedPayableId = useWatch({
    control: form.control,
    name: "related_payable_id",
  });

  const includeInvoiceId =
    isEdit && transaction?.kind === "supplier_payment"
      ? transaction.related_payable_id ?? null
      : null;

  const { data: unpaidInvoices = [] } = useQuery<UnpaidSupplierInvoice[]>({
    queryKey: transactionKeys.unpaidInvoices(contactId ?? "", includeInvoiceId),
    queryFn: () =>
      listUnpaidSupplierInvoices(contactId as string, includeInvoiceId),
    staleTime: 30_000,
    enabled: open && kind === "supplier_payment" && Boolean(contactId),
  });

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === contactId) ?? null,
    [customers, contactId],
  );

  useEffect(() => {
    if (kind !== "client_payment") return;
    const bc = selectedCustomer?.balance_currency ?? "";
    form.setValue("contact_balance_currency", bc, { shouldValidate: false });
    if (bc) form.setValue("fx_target_currency", bc, { shouldValidate: false });
  }, [kind, selectedCustomer, form]);

  const showFxBlock =
    kind === "client_payment" &&
    selectedCustomer?.balance_currency &&
    selectedCustomer.balance_currency !== currency;

  const [fxInputMode, setFxInputMode] = useState<"rate" | "converted">("rate");
  const [convertedInput, setConvertedInput] = useState<string>("");

  const fxPreview = useMemo(() => {
    if (!showFxBlock) return null;
    const a = Number(amount);
    const r = Number(fxRate);
    if (!Number.isFinite(a) || !Number.isFinite(r) || a <= 0 || r <= 0)
      return null;
    return a * r;
  }, [showFxBlock, amount, fxRate]);

  useEffect(() => {
    if (!showFxBlock) return;
    if (fxPreview != null) {
      form.setValue("fx_converted_amount", fxPreview, { shouldValidate: false });
    }
  }, [fxPreview, showFxBlock, form]);

  // Reset the FX input mode whenever the FX block stops being relevant so
  // reopening the dialog starts in "rate" mode with a clean converted input.
  useEffect(() => {
    if (showFxBlock) return;
    setFxInputMode("rate");
    setConvertedInput("");
  }, [showFxBlock]);

  // In converted-input mode, derive the rate from converted/amount and write
  // it back into the form so validation + persistence still hang off the same
  // fx_rate_applied field.
  useEffect(() => {
    if (!showFxBlock) return;
    if (fxInputMode !== "converted") return;
    const a = Number(amount);
    const c = Number(convertedInput);
    if (!Number.isFinite(a) || !Number.isFinite(c) || a <= 0 || c <= 0) {
      form.setValue("fx_rate_applied", "" as unknown as number, {
        shouldValidate: false,
      });
      return;
    }
    form.setValue("fx_rate_applied", c / a, { shouldValidate: false });
  }, [convertedInput, amount, showFxBlock, fxInputMode, form]);

  const switchFxMode = (next: "rate" | "converted") => {
    if (next === fxInputMode) return;
    if (next === "converted") {
      setConvertedInput(
        fxPreview != null ? Number(fxPreview.toFixed(4)).toString() : "",
      );
    } else {
      setConvertedInput("");
    }
    setFxInputMode(next);
  };

  const showVat = kind === "expense" || kind === "supplier_invoice";
  const vatComputed = useMemo(() => {
    if (!showVat) return null;
    const rate = vatRate == null ? null : Number(vatRate);
    const a = Number(amount);
    if (rate == null || !Number.isFinite(rate) || !Number.isFinite(a) || a <= 0)
      return null;
    const net = a / (1 + rate / 100);
    const vat = a - net;
    return { net, vat };
  }, [showVat, vatRate, amount]);

  useEffect(() => {
    if (!showVat) return;
    if (vatComputed) {
      form.setValue("net_amount", vatComputed.net, { shouldValidate: false });
      form.setValue("vat_amount", vatComputed.vat, { shouldValidate: false });
    }
  }, [vatComputed, showVat, form]);

  useEffect(() => {
    if (kind !== "supplier_payment" || !relatedPayableId) return;
    const picked = unpaidInvoices.find((i) => i.id === relatedPayableId);
    if (!picked) return;
    form.setValue("amount", picked.outstanding as unknown as number, {
      shouldValidate: false,
    });
    if ((BALANCE_CURRENCIES as readonly string[]).includes(picked.currency)) {
      form.setValue(
        "currency",
        picked.currency as MinimalValues["currency"],
        { shouldValidate: false },
      );
    }
  }, [kind, relatedPayableId, unpaidInvoices, form]);

  // Pre-fill the expense category with `Uncategorized` so a fresh expense
  // has a valid required category by default. Edit mode keeps the saved
  // category. The user can change the picker before saving but cannot leave
  // it blank (schema requires it).
  useEffect(() => {
    if (isEdit) return;
    if (kind !== "expense") return;
    if (form.getValues("expense_type_id")) return;
    const uncategorized = expenseTypes.find((e) => e.name === "Uncategorized");
    if (!uncategorized) return;
    form.setValue("expense_type_id", uncategorized.id, { shouldDirty: false });
  }, [isEdit, kind, expenseTypes, form]);

  // For kinds without an FX block, the transaction currency must match the
  // chosen account's currency. Default the field when the account is picked
  // so the operator doesn't have to remember to change it (and doesn't trip
  // the "Account currency does not match transaction currency" guard).
  const toAccountId = useWatch({ control: form.control, name: "to_account_id" });
  const fromAccountId = useWatch({ control: form.control, name: "from_account_id" });
  useEffect(() => {
    const KINDS_WITHOUT_FX_BLOCK: TransactionKind[] = [
      "other_income",
      "expense",
      "tax_payment",
      "partner_loan_in",
      "partner_loan_out",
      "profit_distribution",
      "client_refund",
    ];
    if (!KINDS_WITHOUT_FX_BLOCK.includes(kind)) return;
    const accountId =
      kind === "other_income" || kind === "partner_loan_in"
        ? toAccountId
        : fromAccountId;
    if (!accountId) return;
    const picked = accounts.find((a) => a.id === accountId);
    if (!picked?.asset_code) return;
    if (
      (BALANCE_CURRENCIES as readonly string[]).includes(picked.asset_code) &&
      picked.asset_code !== currency
    ) {
      form.setValue(
        "currency",
        picked.asset_code as MinimalValues["currency"],
        { shouldValidate: false },
      );
    }
  }, [kind, toAccountId, fromAccountId, accounts, currency, form]);

  const visibleSteps = useMemo<StepId[]>(() => {
    const base: StepId[] = ["kind", "parties", "details"];
    if (showVat) base.push("vat");
    base.push("attachment");
    return base;
  }, [showVat]);

  const currentStepId = visibleSteps[stepIndex];

  const accountItems = useMemo(
    () =>
      accounts.map((a) => ({
        value: a.id,
        label: `${a.asset_code ?? "?"} @ ${
          a.custody_locations?.name ?? "—"
        } · ${a.account_name}`,
      })),
    [accounts],
  );

  const customerItems = useMemo(
    () =>
      customers
        .filter((c) => c.company_name)
        .map((c) => ({ value: c.id, label: c.company_name as string })),
    [customers],
  );

  const supplierItems = useMemo(
    () =>
      suppliers
        .filter((s) => s.company_name)
        .map((s) => ({ value: s.id, label: s.company_name as string })),
    [suppliers],
  );

  const partnerItems = useMemo(
    () => partners.map((p) => ({ value: p.id, label: p.name })),
    [partners],
  );

  const expenseTypeItems = useMemo(
    () => expenseTypes.map((e) => ({ value: e.id, label: e.name })),
    [expenseTypes],
  );

  const allContactItems = useMemo(
    () =>
      allContacts
        .filter((c) => c.company_name)
        .map((c) => ({ value: c.id, label: c.company_name as string })),
    [allContacts],
  );

  const unpaidInvoiceItems = useMemo(
    () =>
      unpaidInvoices.map((i) => {
        const ref = i.reference_number ?? "INV-—";
        const outStr = formatInvoiceOutstanding(i.outstanding, i.currency);
        return {
          value: i.id,
          label: `${ref} · ${i.transaction_date} · Outstanding ${outStr}`,
        };
      }),
    [unpaidInvoices],
  );

  const createExpenseTypeMut = useMutation({
    mutationFn: (name: string) => createExpenseType(name),
    onSuccess: (et) => {
      qc.invalidateQueries({ queryKey: transactionKeys.expenseTypes() });
      form.setValue("expense_type_id", et.id, { shouldDirty: true });
      toast.success(`Expense type "${et.name}" created`);
    },
    onError: (e: Error) =>
      toast.error(e.message ?? "Failed to create expense type"),
  });

  const createPartnerMut = useMutation({
    mutationFn: (name: string) => createPartner(name),
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: transactionKeys.partners() });
      form.setValue("partner_id", p.id, { shouldDirty: true });
      toast.success(`Partner "${p.name}" added`);
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed to add partner"),
  });

  const fieldsForStep = (id: StepId): FieldPath<MinimalValues>[] => {
    if (id === "kind") return ["kind"];
    if (id === "parties") {
      if (kind === "client_payment")
        return ["contact_id", "to_account_id"];
      if (kind === "client_refund")
        return ["contact_id", "from_account_id"];
      if (kind === "expense") {
        return paidBy === "business"
          ? ["expense_type_id", "from_account_id"]
          : ["expense_type_id", "partner_id"];
      }
      if (kind === "other_income") return ["to_account_id"];
      if (kind === "supplier_invoice") return ["contact_id"];
      if (kind === "supplier_payment")
        return ["contact_id", "from_account_id"];
      if (kind === "partner_loan_in")
        return ["partner_id", "to_account_id"];
      if (kind === "partner_loan_out")
        return ["partner_id", "from_account_id"];
      if (kind === "profit_distribution") return ["from_account_id"];
      if (kind === "tax_payment") return ["from_account_id"];
      return [];
    }
    if (id === "details") {
      const base: FieldPath<MinimalValues>[] = [
        "amount",
        "currency",
        "transaction_date",
      ];
      if (kind === "client_payment") base.push("fx_rate_applied");
      if (kind === "supplier_invoice") base.push("reference_number");
      return base;
    }
    if (id === "vat") return ["vat_rate"];
    return [];
  };

  const goNext = async () => {
    const ok = await form.trigger(fieldsForStep(currentStepId) as never);
    if (!ok) return;
    setStepIndex((i) => Math.min(i + 1, visibleSteps.length - 1));
  };
  const goBack = () => {
    if (currentStepId === "kind") {
      if (kindView.level === "kinds") {
        const cat = KIND_CATEGORIES.find((c) => c.id === kindView.category);
        if (cat?.subCategories) {
          setKindView({ level: "sub", category: kindView.category });
        } else {
          setKindView({ level: "categories" });
        }
        return;
      }
      if (kindView.level === "sub" || kindView.level === "move") {
        setKindView({ level: "categories" });
        return;
      }
      return;
    }
    setStepIndex((i) => Math.max(i - 1, 0));
  };

  const handlePickCategory = (id: KindCategoryId) => {
    const cat = KIND_CATEGORIES.find((c) => c.id === id);
    if (!cat) return;
    if (cat.subCategories) {
      setKindView({ level: "sub", category: id });
      return;
    }
    if (cat.kinds && cat.kinds.length === 1) {
      const only = cat.kinds[0];
      if (!(DISABLED_KINDS as readonly string[]).includes(only)) {
        form.setValue(
          "kind",
          only as Exclude<TransactionKind, (typeof DISABLED_KINDS)[number]>,
          { shouldValidate: false },
        );
        setKindView({ level: "kinds", category: id, sub: null });
        setStepIndex((i) => Math.min(i + 1, visibleSteps.length - 1));
        return;
      }
    }
    setKindView({ level: "kinds", category: id, sub: null });
  };

  const handlePickSubCategory = (id: KindSubCategoryId) => {
    if (kindView.level !== "sub") return;
    setKindView({ level: "kinds", category: kindView.category, sub: id });
  };

  const handlePickKind = (k: TransactionKind) => {
    if ((DISABLED_KINDS as readonly string[]).includes(k)) return;
    form.setValue(
      "kind",
      k as Exclude<TransactionKind, (typeof DISABLED_KINDS)[number]>,
      { shouldValidate: false },
    );
    setStepIndex((i) => Math.min(i + 1, visibleSteps.length - 1));
  };

  const saveMut = useMutation({
    mutationFn: async (values: TransactionOutput) => {
      const payload = buildInsertPayload(values);
      if (isEdit && transaction) {
        return updateTransaction({
          id: transaction.id,
          payload,
          pendingFile,
          removeAttachment:
            requestedRemoval && !pendingFile && Boolean(transaction.attachment_path),
          previousAttachmentPath: transaction.attachment_path,
        });
      }
      return createTransaction({
        id: effectiveTxnId,
        payload,
        pendingFile,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: transactionKeys.all });
      qc.invalidateQueries({ queryKey: treasuryKeys.all });
      toast.success(isEdit ? "Transaction updated" : "Transaction recorded");
      handleOpenChange(false);
    },
    onError: (e: Error) =>
      toast.error(e.message ?? "Failed to save transaction"),
  });

  const isLastStep = stepIndex === visibleSteps.length - 1;

  const errors = form.formState.errors as unknown as Record<
    string,
    { message?: string } | undefined
  >;
  const errMsg = (name: string): string | undefined => errors[name]?.message;

  const submit = form.handleSubmit((values) => saveMut.mutate(values));

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    // Always swallow native form submits (Enter keypresses, stray submitters,
    // browser autofill, etc.). The user advances steps via the Next button and
    // submits via the explicit "Record transaction" button below.
    e.preventDefault();
  };

  const handleFilePick = (file: File) => {
    if (!ACCEPTED_TRANSACTION_ATTACHMENT_TYPES.includes(file.type as never)) {
      toast.error("Unsupported file type. Use JPG, PNG, WebP, or PDF.");
      return;
    }
    if (file.size > MAX_TRANSACTION_ATTACHMENT_BYTES) {
      toast.error("File is larger than 5MB.");
      return;
    }
    setPendingFile(file);
    const isImage = file.type.startsWith("image/");
    setPendingPreview(isImage ? URL.createObjectURL(file) : null);
    setRequestedRemoval(false);
  };

  const handleRemoveAttachment = () => {
    setPendingFile(null);
    setPendingPreview(null);
    setRequestedRemoval(true);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit transaction" : "Record transaction"}
          </DialogTitle>
          <DialogDescription>
            Step {stepIndex + 1} of {visibleSteps.length} ·{" "}
            {STEP_TITLES[currentStepId]}
          </DialogDescription>
        </DialogHeader>

        <Stepper
          steps={visibleSteps.map((id) => ({ id, title: STEP_TITLES[id] }))}
          current={stepIndex}
        />

        <form onSubmit={handleFormSubmit} className="space-y-5">
          {currentStepId === "kind" ? (
            <TooltipProvider delayDuration={150}>
              {kindView.level === "categories" ? (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {KIND_CATEGORIES.map((cat) => {
                    const allKinds = cat.kinds
                      ? cat.kinds
                      : (cat.subCategories?.flatMap((s) => s.kinds) ?? []);
                    const enabledCount = allKinds.filter(
                      (k) =>
                        !(DISABLED_KINDS as readonly string[]).includes(k),
                    ).length;
                    return (
                      <button
                        type="button"
                        key={cat.id}
                        onClick={() => handlePickCategory(cat.id)}
                        className="rounded-lg border border-border p-3 text-left transition-colors hover:bg-muted/50"
                      >
                        <div className="text-sm font-medium">{cat.label}</div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {cat.description}
                        </div>
                        <div className="mt-1 text-[11px] text-muted-foreground">
                          {enabledCount} option{enabledCount === 1 ? "" : "s"}
                        </div>
                      </button>
                    );
                  })}
                  {onMoveMoney ? (
                    <button
                      type="button"
                      onClick={() => setKindView({ level: "move" })}
                      className="rounded-lg border border-border p-3 text-left transition-colors hover:bg-muted/50"
                    >
                      <div className="text-sm font-medium">Move money</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        Between your own accounts.
                      </div>
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        2 options
                      </div>
                    </button>
                  ) : null}
                </div>
              ) : null}

              {kindView.level === "move" ? (
                <div className="space-y-3">
                  <div className="text-xs text-muted-foreground">Move money</div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => {
                        onMoveMoney?.("transfer");
                        handleOpenChange(false);
                      }}
                      className="rounded-lg border border-border p-3 text-left transition-colors hover:bg-muted/50"
                    >
                      <div className="text-sm font-medium">
                        Transfer (same asset)
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        Same currency / asset on both sides — e.g. USD bank to
                        USD bank, or Kasa to Şirket.
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onMoveMoney?.("trade");
                        handleOpenChange(false);
                      }}
                      className="rounded-lg border border-border p-3 text-left transition-colors hover:bg-muted/50"
                    >
                      <div className="text-sm font-medium">
                        Trade (different assets)
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        Currency conversion or asset swap — e.g. USD → TRY.
                      </div>
                    </button>
                  </div>
                </div>
              ) : null}

              {kindView.level === "sub" ? (
                <div className="space-y-3">
                  <div className="text-xs text-muted-foreground">
                    {KIND_CATEGORIES.find((c) => c.id === kindView.category)
                      ?.label}
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {KIND_CATEGORIES.find(
                      (c) => c.id === kindView.category,
                    )?.subCategories?.map((sub) => {
                      const enabledCount = sub.kinds.filter(
                        (k) =>
                          !(DISABLED_KINDS as readonly string[]).includes(k),
                      ).length;
                      return (
                        <button
                          type="button"
                          key={sub.id}
                          onClick={() => handlePickSubCategory(sub.id)}
                          className="rounded-lg border border-border p-3 text-left transition-colors hover:bg-muted/50"
                        >
                          <div className="text-sm font-medium">
                            {sub.label}
                          </div>
                          <div className="mt-0.5 text-xs text-muted-foreground">
                            {sub.description}
                          </div>
                          <div className="mt-1 text-[11px] text-muted-foreground">
                            {enabledCount} option
                            {enabledCount === 1 ? "" : "s"}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {kindView.level === "kinds"
                ? (() => {
                    const cat = KIND_CATEGORIES.find(
                      (c) => c.id === kindView.category,
                    );
                    const sub = cat?.subCategories?.find(
                      (s) => s.id === kindView.sub,
                    );
                    const kinds = sub ? sub.kinds : (cat?.kinds ?? []);
                    const breadcrumb = sub
                      ? `${cat?.label} › ${sub.label}`
                      : (cat?.label ?? "");
                    return (
                      <div className="space-y-3">
                        <div className="text-xs text-muted-foreground">
                          {breadcrumb}
                        </div>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {kinds.map((k) => {
                            const disabled = (
                              DISABLED_KINDS as readonly string[]
                            ).includes(k);
                            const enabled = !disabled;
                            const selected = kind === k;
                            const card = (
                              <button
                                type="button"
                                key={k}
                                disabled={disabled}
                                onClick={() => handlePickKind(k)}
                                className={cn(
                                  "rounded-lg border p-3 text-left transition-colors",
                                  disabled &&
                                    "cursor-not-allowed opacity-50",
                                  enabled &&
                                    selected &&
                                    "border-primary bg-primary/5",
                                  enabled &&
                                    !selected &&
                                    "border-border hover:bg-muted/50",
                                )}
                              >
                                <div className="text-sm font-medium">
                                  {TRANSACTION_KIND_LABELS[k]}
                                </div>
                                <div className="mt-0.5 text-xs text-muted-foreground">
                                  {TRANSACTION_KIND_DESCRIPTIONS[k]}
                                </div>
                              </button>
                            );
                            if (disabled) {
                              return (
                                <Tooltip key={k}>
                                  <TooltipTrigger asChild>
                                    <div>{card}</div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    Coming in a later wave.
                                  </TooltipContent>
                                </Tooltip>
                              );
                            }
                            return card;
                          })}
                        </div>
                      </div>
                    );
                  })()
                : null}
            </TooltipProvider>
          ) : null}

          {currentStepId === "parties" ? (
            <div className="grid grid-cols-1 gap-4">
              {kind === "client_payment" || kind === "client_refund" ? (
                <>
                  <Field
                    label="Customer *"
                    error={errMsg("contact_id")}
                  >
                    <Controller
                      name="contact_id"
                      control={form.control}
                      render={({ field }) => (
                        <Combobox
                          items={customerItems}
                          value={field.value || null}
                          onChange={(v) => field.onChange(v ?? "")}
                          placeholder="Pick a customer"
                          searchPlaceholder="Search…"
                          emptyMessage="No customers yet."
                        />
                      )}
                    />
                  </Field>
                  {kind === "client_payment" ? (
                    <Field
                      label="To account *"
                      error={errMsg("to_account_id")}
                    >
                      <Controller
                        name="to_account_id"
                        control={form.control}
                        render={({ field }) => (
                          <Combobox
                            items={accountItems}
                            value={field.value || null}
                            onChange={(v) => field.onChange(v ?? "")}
                            placeholder="Pick an account"
                            searchPlaceholder="Search…"
                            emptyMessage="No accounts yet."
                          />
                        )}
                      />
                    </Field>
                  ) : (
                    <Field
                      label="From account *"
                      error={errMsg("from_account_id")}
                    >
                      <Controller
                        name="from_account_id"
                        control={form.control}
                        render={({ field }) => (
                          <Combobox
                            items={accountItems}
                            value={field.value || null}
                            onChange={(v) => field.onChange(v ?? "")}
                            placeholder="Pick an account"
                            searchPlaceholder="Search…"
                            emptyMessage="No accounts yet."
                          />
                        )}
                      />
                    </Field>
                  )}
                </>
              ) : null}

              {kind === "expense" ? (
                <>
                  <Field
                    label="Expense type *"
                    error={errMsg("expense_type_id")}
                  >
                    <Controller
                      name="expense_type_id"
                      control={form.control}
                      render={({ field }) => (
                        <Combobox
                          items={expenseTypeItems}
                          value={field.value || null}
                          onChange={(v) => field.onChange(v ?? "")}
                          placeholder="Pick an expense type"
                          searchPlaceholder="Search or create…"
                          emptyMessage="No expense types yet."
                          onCreate={async (label) => {
                            await createExpenseTypeMut.mutateAsync(label);
                          }}
                        />
                      )}
                    />
                  </Field>
                  {paidBy === "business" ? (
                    <Field label="Supplier (optional)">
                      <Controller
                        name="contact_id"
                        control={form.control}
                        render={({ field }) => (
                          <Combobox
                            items={supplierItems}
                            value={field.value || null}
                            onChange={(v) => field.onChange(v ?? "")}
                            placeholder="Pick a supplier"
                            searchPlaceholder="Search…"
                            emptyMessage="No suppliers."
                            clearable
                          />
                        )}
                      />
                    </Field>
                  ) : null}
                  <Field label="Paid by">
                    <Controller
                      name="paid_by"
                      control={form.control}
                      render={({ field }) => (
                        <div className="inline-flex rounded-md border p-0.5">
                          {(["business", "partner"] as const).map((v) => (
                            <button
                              key={v}
                              type="button"
                              onClick={() => {
                                field.onChange(v);
                                if (v === "business") {
                                  form.setValue("partner_id", "");
                                } else {
                                  form.setValue("from_account_id", "");
                                  form.setValue("contact_id", "");
                                }
                              }}
                              className={cn(
                                "rounded px-3 py-1.5 text-xs capitalize",
                                field.value === v
                                  ? "bg-primary text-primary-foreground"
                                  : "text-muted-foreground",
                              )}
                            >
                              {v}
                            </button>
                          ))}
                        </div>
                      )}
                    />
                  </Field>
                  {paidBy === "business" ? (
                    <Field
                      label="From account *"
                      error={errMsg("from_account_id")}
                    >
                      <Controller
                        name="from_account_id"
                        control={form.control}
                        render={({ field }) => (
                          <Combobox
                            items={accountItems}
                            value={field.value || null}
                            onChange={(v) => field.onChange(v ?? "")}
                            placeholder="Pick an account"
                            searchPlaceholder="Search…"
                            emptyMessage="No accounts."
                          />
                        )}
                      />
                    </Field>
                  ) : (
                    <Field
                      label="Partner *"
                      error={errMsg("partner_id")}
                    >
                      <Controller
                        name="partner_id"
                        control={form.control}
                        render={({ field }) => (
                          <Combobox
                            items={partnerItems}
                            value={field.value || null}
                            onChange={(v) => field.onChange(v ?? "")}
                            placeholder="Pick a partner"
                            searchPlaceholder="Search or create…"
                            emptyMessage="No partners."
                            onCreate={async (label) => {
                              await createPartnerMut.mutateAsync(label);
                            }}
                          />
                        )}
                      />
                    </Field>
                  )}
                </>
              ) : null}

              {kind === "other_income" ? (
                <Field
                  label="To account *"
                  error={errMsg("to_account_id")}
                >
                  <Controller
                    name="to_account_id"
                    control={form.control}
                    render={({ field }) => (
                      <Combobox
                        items={accountItems}
                        value={field.value || null}
                        onChange={(v) => field.onChange(v ?? "")}
                        placeholder="Pick an account"
                        searchPlaceholder="Search…"
                        emptyMessage="No accounts."
                      />
                    )}
                  />
                </Field>
              ) : null}

              {kind === "supplier_invoice" ? (
                <Field label="Supplier *" error={errMsg("contact_id")}>
                  <Controller
                    name="contact_id"
                    control={form.control}
                    render={({ field }) => (
                      <Combobox
                        items={supplierItems}
                        value={field.value || null}
                        onChange={(v) => field.onChange(v ?? "")}
                        placeholder="Pick a supplier"
                        searchPlaceholder="Search…"
                        emptyMessage="No suppliers."
                      />
                    )}
                  />
                </Field>
              ) : null}

              {kind === "supplier_payment" ? (
                <>
                  <Field label="Supplier *" error={errMsg("contact_id")}>
                    <Controller
                      name="contact_id"
                      control={form.control}
                      render={({ field }) => (
                        <Combobox
                          items={supplierItems}
                          value={field.value || null}
                          onChange={(v) => {
                            field.onChange(v ?? "");
                            form.setValue("related_payable_id", "", {
                              shouldValidate: false,
                            });
                          }}
                          placeholder="Pick a supplier"
                          searchPlaceholder="Search…"
                          emptyMessage="No suppliers."
                        />
                      )}
                    />
                  </Field>
                  <Field
                    label="From account *"
                    error={errMsg("from_account_id")}
                  >
                    <Controller
                      name="from_account_id"
                      control={form.control}
                      render={({ field }) => (
                        <Combobox
                          items={accountItems}
                          value={field.value || null}
                          onChange={(v) => field.onChange(v ?? "")}
                          placeholder="Pick an account"
                          searchPlaceholder="Search…"
                          emptyMessage="No accounts."
                        />
                      )}
                    />
                  </Field>
                  <Field label="Link to invoice (optional)">
                    <Controller
                      name="related_payable_id"
                      control={form.control}
                      render={({ field }) => (
                        <Combobox
                          items={unpaidInvoiceItems}
                          value={field.value || null}
                          onChange={(v) => field.onChange(v ?? "")}
                          placeholder={
                            contactId
                              ? unpaidInvoiceItems.length
                                ? "Pick an unpaid invoice"
                                : "No unpaid invoices for this supplier"
                              : "Pick a supplier first"
                          }
                          searchPlaceholder="Search invoices…"
                          emptyMessage="No unpaid invoices."
                          disabled={!contactId}
                          clearable
                        />
                      )}
                    />
                  </Field>
                </>
              ) : null}

              {kind === "partner_loan_in" ? (
                <>
                  <Field label="Partner *" error={errMsg("partner_id")}>
                    <Controller
                      name="partner_id"
                      control={form.control}
                      render={({ field }) => (
                        <Combobox
                          items={partnerItems}
                          value={field.value || null}
                          onChange={(v) => field.onChange(v ?? "")}
                          placeholder="Pick a partner"
                          searchPlaceholder="Search or create…"
                          emptyMessage="No partners."
                          onCreate={async (label) => {
                            await createPartnerMut.mutateAsync(label);
                          }}
                        />
                      )}
                    />
                  </Field>
                  <Field
                    label="To account *"
                    error={errMsg("to_account_id")}
                  >
                    <Controller
                      name="to_account_id"
                      control={form.control}
                      render={({ field }) => (
                        <Combobox
                          items={accountItems}
                          value={field.value || null}
                          onChange={(v) => field.onChange(v ?? "")}
                          placeholder="Pick an account"
                          searchPlaceholder="Search…"
                          emptyMessage="No accounts."
                        />
                      )}
                    />
                  </Field>
                </>
              ) : null}

              {kind === "partner_loan_out" ? (
                <>
                  <Field label="Partner *" error={errMsg("partner_id")}>
                    <Controller
                      name="partner_id"
                      control={form.control}
                      render={({ field }) => (
                        <Combobox
                          items={partnerItems}
                          value={field.value || null}
                          onChange={(v) => field.onChange(v ?? "")}
                          placeholder="Pick a partner"
                          searchPlaceholder="Search or create…"
                          emptyMessage="No partners."
                          onCreate={async (label) => {
                            await createPartnerMut.mutateAsync(label);
                          }}
                        />
                      )}
                    />
                  </Field>
                  <Field
                    label="From account *"
                    error={errMsg("from_account_id")}
                  >
                    <Controller
                      name="from_account_id"
                      control={form.control}
                      render={({ field }) => (
                        <Combobox
                          items={accountItems}
                          value={field.value || null}
                          onChange={(v) => field.onChange(v ?? "")}
                          placeholder="Pick an account"
                          searchPlaceholder="Search…"
                          emptyMessage="No accounts."
                        />
                      )}
                    />
                  </Field>
                </>
              ) : null}

              {/* profit_distribution is disabled in the kind picker — PSD legs
                  are created via the dedicated PSD dialog on /partners, which
                  supports multi-currency multi-account events. */}

              {kind === "tax_payment" ? (
                <>
                  <Field
                    label="From account *"
                    error={errMsg("from_account_id")}
                  >
                    <Controller
                      name="from_account_id"
                      control={form.control}
                      render={({ field }) => (
                        <Combobox
                          items={accountItems}
                          value={field.value || null}
                          onChange={(v) => field.onChange(v ?? "")}
                          placeholder="Pick an account"
                          searchPlaceholder="Search…"
                          emptyMessage="No accounts."
                        />
                      )}
                    />
                  </Field>
                  <Field
                    label="KDV period (YYYY-MM)"
                    error={errMsg("kdv_period")}
                  >
                    <Controller
                      name="kdv_period"
                      control={form.control}
                      render={({ field }) => (
                        <Input
                          type="month"
                          value={(field.value as string) ?? ""}
                          onChange={(e) => field.onChange(e.target.value)}
                          placeholder="2026-03"
                        />
                      )}
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      The tax period this filing covers. Leave blank for a non-KDV tax payment.
                    </p>
                  </Field>
                </>
              ) : null}

            </div>
          ) : null}

          {currentStepId === "details" ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Amount *" error={errMsg("amount")}>
                <Input
                  type="number"
                  step="any"
                  min="0"
                  placeholder="0"
                  {...form.register("amount")}
                />
              </Field>
              <Field label="Currency *" error={errMsg("currency")}>
                <Controller
                  name="currency"
                  control={form.control}
                  render={({ field }) => (
                    <Select
                      value={field.value ?? ""}
                      onValueChange={(v) => field.onChange(v as never)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select…" />
                      </SelectTrigger>
                      <SelectContent>
                        {BALANCE_CURRENCIES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field label="Date *" error={errMsg("transaction_date")}>
                <Input type="date" {...form.register("transaction_date")} />
              </Field>
              <Field label="Reference #">
                <Input
                  placeholder={prefill?.reference_number_placeholder ?? undefined}
                  {...form.register("reference_number")}
                />
              </Field>
              <Field label="Description" className="md:col-span-2">
                <Textarea rows={2} {...form.register("description")} />
              </Field>

              {showFxBlock ? (
                <div className="md:col-span-2 space-y-3 rounded-md border bg-muted/30 p-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <p className="text-xs text-muted-foreground">
                      {currency} does not match client balance currency (
                      {selectedCustomer?.balance_currency}). Fill in either the
                      FX rate or the converted amount — the other is computed
                      and frozen on the transaction.
                    </p>
                    <div className="inline-flex shrink-0 rounded-md border p-0.5 text-[11px]">
                      {(["rate", "converted"] as const).map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => switchFxMode(m)}
                          className={cn(
                            "rounded px-2 py-1 capitalize",
                            fxInputMode === m
                              ? "bg-primary text-primary-foreground"
                              : "text-muted-foreground",
                          )}
                        >
                          {m === "rate" ? "Enter rate" : "Enter converted"}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <Field
                      label={`FX rate (${currency} → ${selectedCustomer?.balance_currency})`}
                      error={
                        fxInputMode === "rate"
                          ? errMsg("fx_rate_applied")
                          : undefined
                      }
                    >
                      {fxInputMode === "rate" ? (
                        <Input
                          type="number"
                          step="any"
                          min="0"
                          {...form.register("fx_rate_applied")}
                        />
                      ) : (
                        <Input
                          value={
                            Number.isFinite(Number(fxRate)) && Number(fxRate) > 0
                              ? Number(fxRate).toFixed(6)
                              : ""
                          }
                          readOnly
                          className="bg-background"
                          placeholder="—"
                        />
                      )}
                    </Field>
                    <Field
                      label={`Converted amount (${selectedCustomer?.balance_currency})`}
                      error={
                        fxInputMode === "converted"
                          ? errMsg("fx_rate_applied")
                          : undefined
                      }
                    >
                      {fxInputMode === "converted" ? (
                        <Input
                          type="number"
                          step="any"
                          min="0"
                          value={convertedInput}
                          onChange={(e) => setConvertedInput(e.target.value)}
                        />
                      ) : (
                        <Input
                          value={
                            fxPreview != null ? fxPreview.toFixed(4) : ""
                          }
                          readOnly
                          className="bg-background"
                          placeholder="—"
                        />
                      )}
                    </Field>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {currentStepId === "vat" ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="VAT rate" className="md:col-span-2">
                <Controller
                  name="vat_rate"
                  control={form.control}
                  render={({ field }) => (
                    <Select
                      value={
                        field.value == null ? "skip" : String(field.value)
                      }
                      onValueChange={(v) => {
                        if (v === "skip") {
                          field.onChange(null);
                          form.setValue("net_amount", "" as never);
                          form.setValue("vat_amount", "" as never);
                        } else {
                          field.onChange(Number(v));
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select rate…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="skip">Skip VAT</SelectItem>
                        {KDV_RATES.map((r) => (
                          <SelectItem key={r} value={String(r)}>
                            %{r}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              {vatComputed ? (
                <>
                  <Field label="Net amount">
                    <Input value={vatComputed.net.toFixed(2)} readOnly />
                  </Field>
                  <Field label="VAT amount">
                    <Input value={vatComputed.vat.toFixed(2)} readOnly />
                  </Field>
                </>
              ) : null}
            </div>
          ) : null}

          {currentStepId === "attachment" ? (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Attach a receipt or invoice (optional). JPG, PNG, WebP, or PDF,
                up to 5MB.
              </p>
              <AttachmentPreview
                pendingFile={pendingFile}
                pendingPreview={pendingPreview}
                existingPath={
                  isEdit && !requestedRemoval && !pendingFile
                    ? transaction?.attachment_path ?? null
                    : null
                }
                onPick={handleFilePick}
                onRemove={handleRemoveAttachment}
              />
            </div>
          ) : null}

          <DialogFooter className="flex-row items-center justify-between gap-2 sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              onClick={goBack}
              disabled={
                (stepIndex === 0 && kindView.level === "categories") ||
                saveMut.isPending
              }
            >
              <ArrowLeft className="mr-2 size-4" />
              Back
            </Button>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={saveMut.isPending}
              >
                Cancel
              </Button>
              {isLastStep ? (
                <Button
                  type="button"
                  disabled={saveMut.isPending}
                  onClick={() => void submit()}
                >
                  {saveMut.isPending
                    ? "Saving…"
                    : isEdit
                      ? "Save changes"
                      : "Record transaction"}
                </Button>
              ) : currentStepId === "kind" ? null : (
                <Button type="button" onClick={() => void goNext()}>
                  Next
                  <ArrowRight className="ml-2 size-4" />
                </Button>
              )}
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function toFormValues(t: TransactionWithRelations): MinimalValues {
  const base = {
    kind: t.kind as TransactionKind,
    transaction_date: t.transaction_date,
    amount: Number(t.amount) as number,
    currency: (BALANCE_CURRENCIES as readonly string[]).includes(t.currency)
      ? (t.currency as MinimalValues["currency"])
      : "USD",
    description: t.description ?? "",
    reference_number: t.reference_number ?? "",
    contact_id: t.contact_id ?? "",
    contact_balance_currency: t.contacts?.balance_currency ?? "",
    to_account_id: t.to_account_id ?? "",
    from_account_id: t.from_account_id ?? "",
    fx_rate_applied: (t.fx_rate_applied ?? ("" as unknown)) as number,
    fx_target_currency: t.fx_target_currency ?? "",
    fx_converted_amount: (t.fx_converted_amount ?? ("" as unknown)) as number,
    expense_type_id: t.expense_type_id ?? "",
    paid_by: (t.partner_id ? "partner" : "business") as "business" | "partner",
    partner_id: t.partner_id ?? "",
    vat_rate: t.vat_rate == null ? null : (Number(t.vat_rate) as never),
    vat_amount: (t.vat_amount ?? ("" as unknown)) as number,
    net_amount: (t.net_amount ?? ("" as unknown)) as number,
    related_order_id: (t.related_order_id ?? "") as string,
    related_payable_id: (t.related_payable_id ?? "") as string,
    kdv_period: (t.kdv_period ?? "") as string,
  };
  return base as MinimalValues;
}

function buildInsertPayload(
  v: TransactionOutput,
): Omit<
  TransactionInsert,
  | "id"
  | "created_by"
  | "created_time"
  | "edited_by"
  | "edited_time"
  | "attachment_path"
> {
  const common = {
    transaction_date: v.transaction_date,
    kind: v.kind,
    amount: Number(v.amount),
    currency: v.currency,
    description: v.description?.trim() ? v.description.trim() : null,
    reference_number: v.reference_number?.trim()
      ? v.reference_number.trim()
      : null,
  };

  switch (v.kind) {
    case "client_payment": {
      const needsFx =
        v.contact_balance_currency &&
        v.contact_balance_currency !== v.currency;
      return {
        ...common,
        contact_id: v.contact_id,
        to_account_id: v.to_account_id,
        from_account_id: null,
        partner_id: null,
        fx_rate_applied: needsFx && v.fx_rate_applied ? Number(v.fx_rate_applied) : null,
        fx_target_currency: needsFx ? v.contact_balance_currency : null,
        fx_converted_amount:
          needsFx && v.fx_rate_applied
            ? Number(v.amount) * Number(v.fx_rate_applied)
            : null,
      };
    }
    case "client_refund":
      return {
        ...common,
        contact_id: v.contact_id,
        from_account_id: v.from_account_id,
        to_account_id: null,
        partner_id: null,
      };
    case "expense":
      return {
        ...common,
        expense_type_id: v.expense_type_id,
        contact_id: v.paid_by === "partner" ? null : v.contact_id || null,
        from_account_id: v.paid_by === "business" ? v.from_account_id : null,
        partner_id: v.paid_by === "partner" ? v.partner_id : null,
        to_account_id: null,
        vat_rate: v.vat_rate == null ? null : Number(v.vat_rate),
        vat_amount:
          v.vat_rate == null ? null : Number(v.amount) - Number(v.amount) / (1 + Number(v.vat_rate) / 100),
        net_amount:
          v.vat_rate == null ? null : Number(v.amount) / (1 + Number(v.vat_rate) / 100),
      };
    case "other_income":
      return {
        ...common,
        to_account_id: v.to_account_id,
        from_account_id: null,
        contact_id: null,
        partner_id: null,
      };
    case "supplier_invoice":
      return {
        ...common,
        contact_id: v.contact_id,
        from_account_id: null,
        to_account_id: null,
        partner_id: null,
        vat_rate: v.vat_rate == null ? null : Number(v.vat_rate),
        vat_amount:
          v.vat_rate == null
            ? null
            : Number(v.amount) - Number(v.amount) / (1 + Number(v.vat_rate) / 100),
        net_amount:
          v.vat_rate == null
            ? null
            : Number(v.amount) / (1 + Number(v.vat_rate) / 100),
      };
    case "supplier_payment":
      return {
        ...common,
        contact_id: v.contact_id,
        from_account_id: v.from_account_id,
        to_account_id: null,
        partner_id: null,
        related_payable_id: v.related_payable_id ? v.related_payable_id : null,
      };
    case "partner_loan_in":
      return {
        ...common,
        partner_id: v.partner_id,
        to_account_id: v.to_account_id,
        from_account_id: null,
        contact_id: null,
      };
    case "partner_loan_out":
      return {
        ...common,
        partner_id: v.partner_id,
        from_account_id: v.from_account_id,
        to_account_id: null,
        contact_id: null,
      };
    case "profit_distribution":
      // Disabled in the kind picker — PSD legs are created via the PSD dialog
      // on /partners, which builds payloads directly. This branch is kept
      // for exhaustiveness only and never fires from this form.
      return {
        ...common,
        partner_id: null,
        from_account_id: v.from_account_id,
        to_account_id: null,
        contact_id: null,
      };
    case "tax_payment":
      return {
        ...common,
        from_account_id: v.from_account_id,
        to_account_id: null,
        contact_id: null,
        partner_id: null,
        kdv_period: v.kdv_period && v.kdv_period.trim() ? v.kdv_period.trim() : null,
      };
    default:
      return common;
  }
}

function AttachmentPreview({
  pendingFile,
  pendingPreview,
  existingPath,
  onPick,
  onRemove,
}: {
  pendingFile: File | null;
  pendingPreview: string | null;
  existingPath: string | null;
  onPick: (file: File) => void;
  onRemove: () => void;
}) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSignedUrl(null);
    if (!existingPath) return;
    (async () => {
      const { attachmentSignedUrl } = await import("./queries");
      const url = await attachmentSignedUrl(existingPath, 600);
      if (!cancelled) setSignedUrl(url);
    })();
    return () => {
      cancelled = true;
    };
  }, [existingPath]);

  const hasAnything = pendingFile || existingPath;

  return (
    <div className="flex flex-col items-start gap-3">
      {hasAnything ? (
        <div className="flex items-center gap-3 rounded-md border p-3">
          {pendingPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={pendingPreview}
              alt="Preview"
              className="size-16 rounded object-cover"
            />
          ) : (
            <div className="flex size-16 items-center justify-center rounded bg-muted">
              <FileText className="size-6 text-muted-foreground" />
            </div>
          )}
          <div className="flex flex-col gap-1 text-xs">
            {pendingFile ? (
              <span className="font-medium">{pendingFile.name}</span>
            ) : (
              <a
                href={signedUrl ?? undefined}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium underline underline-offset-2"
              >
                View existing attachment
              </a>
            )}
            <button
              type="button"
              onClick={onRemove}
              className="inline-flex items-center gap-1 text-destructive"
            >
              <Trash2 className="size-3" /> Remove
            </button>
          </div>
        </div>
      ) : null}

      <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-xs hover:bg-muted/50">
        <Upload className="size-3.5" />
        <span>{hasAnything ? "Replace file" : "Choose file"}</span>
        <input
          type="file"
          className="hidden"
          accept={ACCEPTED_TRANSACTION_ATTACHMENT_TYPES.join(",")}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onPick(f);
            e.currentTarget.value = "";
          }}
        />
      </label>
    </div>
  );
}

function Stepper({
  steps,
  current,
}: {
  steps: { id: string; title: string }[];
  current: number;
}) {
  return (
    <ol className="flex flex-wrap items-center gap-1 border-y py-3 text-xs">
      {steps.map((s, i) => {
        const state =
          i < current ? "done" : i === current ? "active" : "pending";
        return (
          <li key={s.id} className="flex items-center gap-1">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1",
                state === "active" &&
                  "border-primary bg-primary text-primary-foreground",
                state === "done" && "border-border bg-muted text-foreground",
                state === "pending" && "border-border text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "flex size-4 items-center justify-center rounded-full text-[10px] font-medium",
                  state === "active" && "bg-primary-foreground/20",
                  state === "done" && "bg-foreground/10",
                  state === "pending" && "bg-muted",
                )}
              >
                {state === "done" ? (
                  <Check className="size-3" />
                ) : (
                  <span>{i + 1}</span>
                )}
              </span>
              <span>{s.title}</span>
            </span>
            {i < steps.length - 1 ? (
              <span className="text-muted-foreground/40">·</span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

const formatInvoiceOutstanding = formatCurrency;

function Field({
  label,
  error,
  children,
  className,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
