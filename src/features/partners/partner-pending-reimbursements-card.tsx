"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatCurrency as formatMoney } from "@/lib/format-money";
import type { PartnerReimbursementResult } from "@/lib/ledger/partner-reimbursement-allocation";
import {
  PayReimbursementsButton,
  type PayableCurrency,
} from "./pay-reimbursements-button";

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

export function PartnerPendingReimbursementsCard({
  partnerId,
  result,
}: {
  partnerId: string;
  result: PartnerReimbursementResult;
}) {
  const currencies = Object.keys(result.by_currency)
    .filter((c) => result.by_currency[c].total_outstanding > 0.001)
    .sort();

  if (currencies.length === 0) return null;

  const payable: PayableCurrency[] = currencies.map((c) => ({
    currency: c,
    outstanding: result.by_currency[c].total_outstanding,
  }));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
        <div>
          <CardTitle className="text-base">Pending reimbursements</CardTitle>
          <p className="text-xs text-muted-foreground">
            Partner-paid expenses still owed back.
          </p>
        </div>
        <PayReimbursementsButton partnerId={partnerId} payable={payable} />
      </CardHeader>
      <CardContent className="space-y-4 pb-4">
        {currencies.map((currency) => (
          <CurrencyGroup
            key={currency}
            currency={currency}
            bucket={result.by_currency[currency]}
          />
        ))}
      </CardContent>
    </Card>
  );
}

function CurrencyGroup({
  currency,
  bucket,
}: {
  currency: string;
  bucket: PartnerReimbursementResult["by_currency"][string];
}) {
  const openClaims = bucket.claim_allocations.filter((a) => a.outstanding > 0.001);
  const [expanded, setExpanded] = useState(openClaims.length <= 3);

  if (openClaims.length === 0) return null;

  return (
    <div className="rounded-md border p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {currency}
          </p>
          <p className="mt-0.5 text-2xl font-semibold tabular-nums">
            {formatMoney(bucket.total_outstanding, currency)}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {openClaims.length} open claim{openClaims.length === 1 ? "" : "s"}
          </p>
        </div>
        {openClaims.length > 3 ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded((v) => !v)}
            className="text-xs"
          >
            {expanded ? (
              <>
                <ChevronDown className="mr-1 size-3.5" /> Hide
              </>
            ) : (
              <>
                <ChevronRight className="mr-1 size-3.5" /> Show {openClaims.length}
              </>
            )}
          </Button>
        ) : null}
      </div>

      {expanded ? (
        <ul className="mt-3 divide-y text-xs">
          {openClaims.map((claim) => (
            <li
              key={claim.claim_id}
              className={cn(
                "flex items-center justify-between gap-3 py-1.5",
              )}
            >
              <span className="text-muted-foreground">
                {formatDate(claim.claim_date)}
              </span>
              <span className="flex-1 truncate">
                {claim.claim_description ?? (
                  <span className="text-muted-foreground">No description</span>
                )}
              </span>
              <span className="tabular-nums">
                {formatMoney(claim.outstanding, currency)}
                {claim.amount_settled > 0.001 ? (
                  <span className="ml-1 text-[10px] text-muted-foreground">
                    of {formatMoney(claim.claim_amount, currency)}
                  </span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
