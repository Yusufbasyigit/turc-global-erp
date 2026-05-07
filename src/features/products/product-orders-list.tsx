"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatDateOnly } from "@/lib/format-date";
import { formatCurrency } from "@/lib/format-money";
import {
  ORDER_STATUS_BADGE_CLASSES,
  ORDER_STATUS_LABELS,
} from "@/features/orders/constants";
import { listOrdersForProduct, orderKeys } from "@/features/orders/queries";
import type { OrderStatus } from "@/lib/supabase/types";

export function ProductOrdersList({ productId }: { productId: string }) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: orderKeys.forProduct(productId),
    queryFn: () => listOrdersForProduct(productId),
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <p className="text-sm text-destructive">
        Failed to load orders: {(error as Error).message}
      </p>
    );
  }

  const rows = data ?? [];
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        This product is not on any order yet.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-xs text-muted-foreground">
          <tr className="border-b">
            <th className="px-3 py-2 text-left font-normal">Order</th>
            <th className="px-3 py-2 text-left font-normal">Date</th>
            <th className="px-3 py-2 text-left font-normal">Customer</th>
            <th className="px-3 py-2 text-left font-normal">Status</th>
            <th className="px-3 py-2 text-right font-normal">Qty</th>
            <th className="px-3 py-2 text-right font-normal">Line total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => {
            const lineTotal =
              row.unit_sales_price !== null
                ? row.quantity * row.unit_sales_price
                : null;
            return (
              <tr
                key={`${row.order_id}-${idx}`}
                className="border-b last:border-b-0 transition-colors hover:bg-muted/30"
              >
                <td className="px-3 py-2 font-mono text-xs">
                  <Link
                    href={`/orders/${row.order_id}`}
                    className="text-primary hover:underline"
                  >
                    {row.order_id.slice(0, 8)}
                  </Link>
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {formatDateOnly(row.order_date)}
                </td>
                <td className="px-3 py-2">{row.customer_name ?? "—"}</td>
                <td className="px-3 py-2">
                  <Badge
                    className={cn(
                      "text-[10px]",
                      ORDER_STATUS_BADGE_CLASSES[row.status as OrderStatus],
                    )}
                  >
                    {ORDER_STATUS_LABELS[row.status as OrderStatus] ??
                      row.status}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {row.quantity}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {lineTotal !== null && row.order_currency
                    ? formatCurrency(lineTotal, row.order_currency)
                    : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
