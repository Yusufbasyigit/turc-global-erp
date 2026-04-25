import { createClient } from "@/lib/supabase/client";
import type { Account, CustodyLocation, Transaction } from "@/lib/supabase/types";

export type PartnerTransactionRow = Transaction & {
  from_account:
    | (Pick<Account, "id" | "account_name" | "asset_code"> & {
        custody_locations: Pick<CustodyLocation, "id" | "name"> | null;
      })
    | null;
  to_account:
    | (Pick<Account, "id" | "account_name" | "asset_code"> & {
        custody_locations: Pick<CustodyLocation, "id" | "name"> | null;
      })
    | null;
};

const PARTNER_LEDGER_KINDS = [
  "partner_loan_in",
  "partner_loan_out",
  "profit_distribution",
  "expense",
  "adjustment",
] as const;

const PARTNER_TRANSACTION_SELECT = `
  *,
  from_account:accounts!transactions_from_account_id_fkey(
    id, account_name, asset_code,
    custody_locations:custody_locations!accounts_custody_location_id_fkey(id, name)
  ),
  to_account:accounts!transactions_to_account_id_fkey(
    id, account_name, asset_code,
    custody_locations:custody_locations!accounts_custody_location_id_fkey(id, name)
  )
`;

export async function listTransactionsForPartner(
  partnerId: string,
): Promise<PartnerTransactionRow[]> {
  if (!partnerId) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("transactions")
    .select(PARTNER_TRANSACTION_SELECT)
    .eq("partner_id", partnerId)
    .in("kind", PARTNER_LEDGER_KINDS as unknown as string[])
    .order("transaction_date", { ascending: true })
    .order("id", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as PartnerTransactionRow[];
}

export const partnerDetailKeys = {
  all: ["partner-detail"] as const,
  transactions: (partnerId: string) =>
    [...partnerDetailKeys.all, "transactions", partnerId] as const,
};
