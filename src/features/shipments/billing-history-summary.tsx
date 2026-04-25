"use client";

function formatMoney(n: number): string {
  return Number(n).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDateTime(d: string | null): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString();
  } catch {
    return d;
  }
}

export function BillingHistorySummary({
  currentAmount,
  currency,
  createdTime,
  editedTime,
  createdBy,
  editedBy,
}: {
  currentAmount: number;
  currency: string;
  createdTime: string;
  editedTime: string | null;
  createdBy: string | null;
  editedBy: string | null;
}) {
  return (
    <div className="rounded-md border p-3 text-xs">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div>
          <div className="text-[10px] uppercase text-muted-foreground">
            Originally booked
          </div>
          <div className="mt-0.5">
            {formatDateTime(createdTime)}{" "}
            {createdBy ? (
              <span className="text-muted-foreground">· by {createdBy}</span>
            ) : null}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase text-muted-foreground">
            Last amended
          </div>
          <div className="mt-0.5">
            {formatDateTime(editedTime)}{" "}
            {editedBy ? (
              <span className="text-muted-foreground">· by {editedBy}</span>
            ) : null}
          </div>
        </div>
        <div className="sm:col-span-2">
          <div className="text-[10px] uppercase text-muted-foreground">
            Current billed amount
          </div>
          <div className="mt-0.5 font-semibold tabular-nums">
            {formatMoney(currentAmount)} {currency}
          </div>
        </div>
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground">
        This row is refreshed in place on each line or freight change. Only the
        most recent amendment is retained — there is no separate history log.
      </p>
    </div>
  );
}
