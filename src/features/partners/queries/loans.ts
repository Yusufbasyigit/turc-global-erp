import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { istanbulToday } from "@/lib/format-date";
import type {
  Account,
  CustodyLocation,
  LoanInstallment,
  Partner,
  Transaction,
} from "@/lib/supabase/types";

export type LoanInstallmentStatus = "paid" | "partial" | "open" | "overdue";

export type LoanInstallmentState = LoanInstallment & {
  paid_amount: number;
  outstanding: number;
  status: LoanInstallmentStatus;
};

export type LoanWithInstallments = Pick<
  Transaction,
  | "id"
  | "transaction_date"
  | "amount"
  | "currency"
  | "partner_id"
  | "from_account_id"
  | "description"
> & {
  partner: Pick<Partner, "id" | "name"> | null;
  from_account:
    | (Pick<Account, "id" | "account_name" | "asset_code"> & {
        custody_locations: Pick<CustodyLocation, "id" | "name"> | null;
      })
    | null;
  installments: LoanInstallment[];
};

export type LoanRepaymentRow = Pick<
  Transaction,
  | "id"
  | "transaction_date"
  | "amount"
  | "currency"
  | "partner_id"
  | "to_account_id"
  | "description"
>;

export type LoanState = LoanWithInstallments & {
  installment_states: LoanInstallmentState[];
  total_paid: number;
  outstanding: number;
};

export type LoansSummary = {
  loans: LoanState[];
  repayments: LoanRepaymentRow[];
  outstandingByCurrency: { currency: string; amount: number }[];
};

const LOAN_SELECT = `
  id, transaction_date, amount, currency, partner_id, from_account_id, description,
  partner:partners!transactions_partner_id_fkey(id, name),
  from_account:accounts!transactions_from_account_id_fkey(
    id, account_name, asset_code,
    custody_locations:custody_locations!accounts_custody_location_id_fkey(id, name)
  ),
  installments:loan_installments(*)
`;

const REPAYMENT_SELECT = `
  id, transaction_date, amount, currency, partner_id, to_account_id, description
`;

export async function listLoansWithInstallments(): Promise<LoanWithInstallments[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("transactions")
    .select(LOAN_SELECT)
    .eq("kind", "partner_loan_out")
    .eq("is_loan", true)
    .order("transaction_date", { ascending: true })
    .order("id", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as LoanWithInstallments[];
}

export async function listLoanRepayments(): Promise<LoanRepaymentRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("transactions")
    .select(REPAYMENT_SELECT)
    .eq("kind", "partner_loan_in")
    .eq("is_loan", true)
    .order("transaction_date", { ascending: true })
    .order("id", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as LoanRepaymentRow[];
}

function bucketKey(partnerId: string | null, currency: string): string {
  return `${partnerId ?? ""}__${currency}`;
}

export function computeLoanState(
  loans: LoanWithInstallments[],
  repayments: LoanRepaymentRow[],
): LoansSummary {
  // Overdue is a date-only comparison against `installment.due_date`.
  // It must run in Istanbul time — using host-local or UTC flips the
  // status across the midnight boundary depending on when the user opens
  // the page.
  const today = istanbulToday();

  // Group loans + repayments by (partner, currency).
  const loansByBucket = new Map<string, LoanWithInstallments[]>();
  for (const l of loans) {
    const key = bucketKey(l.partner_id, l.currency);
    const list = loansByBucket.get(key) ?? [];
    list.push(l);
    loansByBucket.set(key, list);
  }

  const repaymentsByBucket = new Map<string, LoanRepaymentRow[]>();
  for (const r of repayments) {
    const key = bucketKey(r.partner_id, r.currency);
    const list = repaymentsByBucket.get(key) ?? [];
    list.push(r);
    repaymentsByBucket.set(key, list);
  }

  // For each bucket, run FIFO: walk repayments oldest-first, consume installments
  // oldest-first across that bucket's loans.
  type InstallmentRef = {
    loan_id: string;
    installment: LoanInstallment;
    paid: number;
  };

  const stateByLoanId = new Map<string, LoanInstallmentState[]>();
  const totalPaidByLoanId = new Map<string, number>();

  for (const [key, bucketLoans] of loansByBucket) {
    const installments: InstallmentRef[] = [];
    for (const loan of bucketLoans) {
      for (const inst of loan.installments) {
        installments.push({ loan_id: loan.id, installment: inst, paid: 0 });
      }
    }
    installments.sort((a, b) => {
      if (a.installment.due_date !== b.installment.due_date) {
        return a.installment.due_date < b.installment.due_date ? -1 : 1;
      }
      return a.installment.id < b.installment.id ? -1 : 1;
    });

    const bucketRepayments = (repaymentsByBucket.get(key) ?? []).slice().sort(
      (a, b) => {
        if (a.transaction_date !== b.transaction_date) {
          return a.transaction_date < b.transaction_date ? -1 : 1;
        }
        return a.id < b.id ? -1 : 1;
      },
    );

    // Track total paid per loan (independent of installment matching) so loans
    // with NO installments can still report an outstanding amount.
    const loanIds = new Set(bucketLoans.map((l) => l.id));
    const bucketLoanTotalPaid = new Map<string, number>();

    let remainingForBucket = 0;
    for (const r of bucketRepayments) remainingForBucket += Number(r.amount);

    // Consume installments FIFO within the bucket.
    let pool = remainingForBucket;
    for (const ref of installments) {
      if (pool <= 0.0001) break;
      const due = Number(ref.installment.amount);
      const take = Math.min(pool, due);
      ref.paid = take;
      pool -= take;
    }

    // Distribute total paid back to loans by summing each loan's installment
    // paid amounts. Any residual pool (over-payment beyond scheduled
    // installments) is allocated FIFO to loans that have remaining principal.
    for (const id of loanIds) bucketLoanTotalPaid.set(id, 0);
    for (const ref of installments) {
      bucketLoanTotalPaid.set(
        ref.loan_id,
        (bucketLoanTotalPaid.get(ref.loan_id) ?? 0) + ref.paid,
      );
    }

    // Apply residual pool to loans (sorted by date) for outstanding compute.
    if (pool > 0.0001) {
      const sortedLoans = bucketLoans.slice().sort((a, b) => {
        if (a.transaction_date !== b.transaction_date) {
          return a.transaction_date < b.transaction_date ? -1 : 1;
        }
        return a.id < b.id ? -1 : 1;
      });
      for (const loan of sortedLoans) {
        if (pool <= 0.0001) break;
        const principalAlreadyPaid =
          bucketLoanTotalPaid.get(loan.id) ?? 0;
        const principalLeft = Math.max(
          0,
          Number(loan.amount) - principalAlreadyPaid,
        );
        const take = Math.min(pool, principalLeft);
        if (take > 0) {
          bucketLoanTotalPaid.set(
            loan.id,
            principalAlreadyPaid + take,
          );
          pool -= take;
        }
      }
    }

    // Build per-loan installment states.
    for (const loan of bucketLoans) {
      const states: LoanInstallmentState[] = [];
      for (const inst of loan.installments) {
        const ref = installments.find(
          (i) => i.installment.id === inst.id,
        );
        const paid = ref?.paid ?? 0;
        const outstanding = Math.max(0, Number(inst.amount) - paid);
        let status: LoanInstallmentStatus;
        if (outstanding <= 0.0001) status = "paid";
        // Past-due wins over partial-paid so a part-paid loan installment
        // that is also late renders "overdue" (red) rather than "partial"
        // (amber). Without this, the partner-loan drawer would hide the
        // delinquency signal whenever any payment had been made.
        else if (inst.due_date < today) status = "overdue";
        else if (paid > 0.0001) status = "partial";
        else status = "open";
        states.push({ ...inst, paid_amount: paid, outstanding, status });
      }
      states.sort((a, b) => {
        if (a.due_date !== b.due_date) {
          return a.due_date < b.due_date ? -1 : 1;
        }
        return a.id < b.id ? -1 : 1;
      });
      stateByLoanId.set(loan.id, states);
      totalPaidByLoanId.set(loan.id, bucketLoanTotalPaid.get(loan.id) ?? 0);
    }
  }

  const loanStates: LoanState[] = loans.map((loan) => {
    const totalPaid = totalPaidByLoanId.get(loan.id) ?? 0;
    const outstanding = Math.max(0, Number(loan.amount) - totalPaid);
    return {
      ...loan,
      installment_states: stateByLoanId.get(loan.id) ?? [],
      total_paid: totalPaid,
      outstanding,
    };
  });

  const outstandingMap = new Map<string, number>();
  for (const ls of loanStates) {
    if (ls.outstanding <= 0.0001) continue;
    outstandingMap.set(
      ls.currency,
      (outstandingMap.get(ls.currency) ?? 0) + ls.outstanding,
    );
  }
  const outstandingByCurrency = Array.from(outstandingMap.entries())
    .map(([currency, amount]) => ({ currency, amount }))
    .sort((a, b) => a.currency.localeCompare(b.currency));

  return { loans: loanStates, repayments, outstandingByCurrency };
}

export const loansKeys = {
  all: ["partner-loans"] as const,
  list: () => [...loansKeys.all, "list"] as const,
};

async function fetchLoansSummary(): Promise<LoansSummary> {
  const [loans, repayments] = await Promise.all([
    listLoansWithInstallments(),
    listLoanRepayments(),
  ]);
  return computeLoanState(loans, repayments);
}

export function useLoansSummary() {
  return useQuery({
    queryKey: loansKeys.list(),
    queryFn: fetchLoansSummary,
  });
}
