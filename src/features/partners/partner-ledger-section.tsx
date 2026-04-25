"use client";

import { useMemo, useState } from "react";
import { formatISO, subMonths } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PartnerTransactionRow } from "./queries/partner-transactions";
import {
  PartnerLedgerFilters,
  type PartnerLedgerFilterState,
} from "./partner-ledger-filters";
import { PartnerLedgerTable } from "./partner-ledger-table";

function initialFilters(): PartnerLedgerFilterState {
  return {
    fromDate: formatISO(subMonths(new Date(), 12), { representation: "date" }),
    toDate: formatISO(new Date(), { representation: "date" }),
    kinds: [],
    currencies: [],
  };
}

export function PartnerLedgerSection({
  rows,
}: {
  rows: PartnerTransactionRow[];
}) {
  const [filters, setFilters] = useState<PartnerLedgerFilterState>(
    initialFilters,
  );

  const currenciesPresent = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) set.add(r.currency);
    return set;
  }, [rows]);

  const showCurrencyFilter = currenciesPresent.size > 1;

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (r.transaction_date < filters.fromDate) return false;
      if (r.transaction_date > filters.toDate) return false;
      if (filters.kinds.length > 0 && !filters.kinds.includes(r.kind))
        return false;
      if (
        filters.currencies.length > 0 &&
        !filters.currencies.includes(r.currency)
      )
        return false;
      return true;
    });
  }, [rows, filters]);

  const tallyCurrency = useMemo(() => {
    if (filteredRows.length > 0) return filteredRows[0].currency;
    if (rows.length > 0) return rows[0].currency;
    return "USD";
  }, [filteredRows, rows]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Ledger</CardTitle>
        <p className="text-xs text-muted-foreground">
          Chronological activity. Running tally in {tallyCurrency}; rows in
          other currencies leave the tally unchanged.
        </p>
      </CardHeader>
      <CardContent className="space-y-4 pb-4">
        <PartnerLedgerFilters
          state={filters}
          showCurrencyFilter={showCurrencyFilter}
          onChange={setFilters}
          onReset={() => setFilters(initialFilters())}
        />
        <PartnerLedgerTable rows={filteredRows} tallyCurrency={tallyCurrency} />
      </CardContent>
    </Card>
  );
}
