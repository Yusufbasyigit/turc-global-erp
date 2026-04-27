import { createClient } from "@/lib/supabase/client";
import type {
  Account,
  AccountWithCustody,
  Contact,
  CustodyLocation,
  ExpenseType,
  Partner,
  TreasuryMovement,
  TransactionKind,
} from "@/lib/supabase/types";

export const accountKeys = {
  all: ["accounts"] as const,
  list: () => [...accountKeys.all, "list"] as const,
  detail: (id: string) => [...accountKeys.all, "detail", id] as const,
  ledger: (id: string) => [...accountKeys.all, "ledger", id] as const,
};

const REGISTRY_SELECT = `
  *,
  custody_locations:custody_locations!accounts_custody_location_id_fkey(
    id, name, location_type, is_active, requires_movement_type
  )
`;

// Registry: returns ALL accounts (active, inactive, soft-deleted). The page
// filters in memory based on toolbar toggles. Pickers elsewhere use
// listAccountsWithCustody from features/treasury/queries.ts which filters out
// inactive + deleted at the query level.
export async function listAccountsForRegistry(): Promise<AccountWithCustody[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("accounts")
    .select(REGISTRY_SELECT)
    .order("account_name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as AccountWithCustody[];
}

export async function getAccount(id: string): Promise<Account | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export async function getAccountWithCustody(
  id: string,
): Promise<AccountWithCustody | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("accounts")
    .select(REGISTRY_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as unknown as AccountWithCustody | null;
}

// Source transaction joined onto a movement row. Only movements that originated
// from a transaction (cash-in/cash-out kinds) carry this — manual movements
// (opening, manual deposit/withdraw, transfer/trade legs, ad-hoc adjustments)
// have source_transaction = null.
export type LedgerSourceTransaction = {
  id: string;
  kind: TransactionKind;
  reference_number: string | null;
  description: string | null;
  amount: number;
  currency: string;
  transaction_date: string;
  contact: Pick<Contact, "id" | "company_name"> | null;
  partner: Pick<Partner, "id" | "name"> | null;
  expense_type: Pick<ExpenseType, "id" | "name"> | null;
};

export type LedgerMovement = TreasuryMovement & {
  source_transaction: LedgerSourceTransaction | null;
};

// The "other side" of a paired movement (transfer/trade). For a transfer, the
// other leg has the opposite sign on the same asset; for a trade, it's a
// different asset entirely. We render this on the row for context
// ("→ Bank B" / "from Bank A").
export type PairedLegPeer = {
  id: string;
  group_id: string | null;
  account_id: string;
  quantity: number;
  account: {
    id: string;
    account_name: string;
    asset_code: string | null;
    custody_locations: Pick<CustodyLocation, "id" | "name"> | null;
  } | null;
};

export type AccountLedger = {
  movements: LedgerMovement[];
  pairedPeers: Map<string, PairedLegPeer>; // keyed by group_id
};

const LEDGER_SELECT = `
  *,
  source_transaction:transactions!treasury_movements_source_transaction_id_fkey(
    id, kind, reference_number, description, amount, currency, transaction_date,
    contact:contacts!transactions_contact_id_fkey(id, company_name),
    partner:partners!transactions_partner_id_fkey(id, name),
    expense_type:expense_types!transactions_expense_type_id_fkey(id, name)
  )
`;

const PEER_SELECT = `
  id, group_id, account_id, quantity,
  account:accounts!treasury_movements_account_id_fkey(
    id, account_name, asset_code,
    custody_locations:custody_locations!accounts_custody_location_id_fkey(id, name)
  )
`;

export async function listAccountLedger(
  accountId: string,
): Promise<AccountLedger> {
  if (!accountId) return { movements: [], pairedPeers: new Map() };
  const supabase = createClient();

  const { data: movements, error } = await supabase
    .from("treasury_movements")
    .select(LEDGER_SELECT)
    .eq("account_id", accountId)
    .order("movement_date", { ascending: true })
    .order("created_time", { ascending: true });
  if (error) throw error;

  const rows = (movements ?? []) as unknown as LedgerMovement[];

  const groupIds = Array.from(
    new Set(
      rows
        .map((m) => m.group_id)
        .filter((g): g is string => Boolean(g)),
    ),
  );

  const pairedPeers = new Map<string, PairedLegPeer>();
  if (groupIds.length > 0) {
    const { data: peers, error: peerErr } = await supabase
      .from("treasury_movements")
      .select(PEER_SELECT)
      .in("group_id", groupIds)
      .neq("account_id", accountId);
    if (peerErr) throw peerErr;
    for (const peer of (peers ?? []) as unknown as PairedLegPeer[]) {
      if (peer.group_id) pairedPeers.set(peer.group_id, peer);
    }
  }

  return { movements: rows, pairedPeers };
}
