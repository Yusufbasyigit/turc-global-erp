"use client";

import Link from "next/link";
import { MoreHorizontal, Package, Pencil, Trash2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { ProductWithRelations } from "@/lib/supabase/types";
import { ActiveBadge } from "./active-badge";
import { NeedsDetailsBadge, productNeedsDetails } from "./needs-details-badge";
import { productImageUrl } from "./queries";

function formatPrice(
  amount: number | null | undefined,
  currency: string | null | undefined,
): string {
  if (amount === null || amount === undefined) return "—";
  const amt = Number(amount).toFixed(2);
  return currency ? `${currency} ${amt}` : amt;
}

export function ProductsCardList({
  products,
  onEdit,
  onDelete,
}: {
  products: ProductWithRelations[];
  onEdit: (id: string) => void;
  onDelete: (id: string, name: string) => void;
}) {
  return (
    <div className="space-y-3">
      {products.map((p) => {
        const imgUrl = productImageUrl(p.product_image);
        const dimmed = !p.is_active;
        const name = p.product_name ?? "Untitled product";
        return (
          <Card key={p.product_id} className={cn(dimmed && "opacity-60")}>
            <CardHeader className="flex-row items-start gap-3 pb-2">
              {imgUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imgUrl}
                  alt=""
                  className="size-12 shrink-0 rounded-md object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="flex size-12 shrink-0 items-center justify-center rounded-md bg-muted">
                  <Package className="size-5 text-muted-foreground" />
                </div>
              )}
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-1">
                  <ActiveBadge active={p.is_active} />
                  {productNeedsDetails(p) ? <NeedsDetailsBadge /> : null}
                </div>
                <CardTitle className="truncate text-base">
                  <Link
                    href={`/products/${p.product_id}`}
                    className="hover:underline"
                  >
                    {name}
                  </Link>
                </CardTitle>
                {p.product_categories?.name ? (
                  <p className="truncate text-xs text-muted-foreground">
                    {p.product_categories.name}
                  </p>
                ) : null}
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    aria-label="Actions"
                  >
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => onEdit(p.product_id)}>
                    <Pencil className="mr-2 size-4" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => onDelete(p.product_id, name)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 size-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </CardHeader>
            <CardContent className="pb-4 pt-0 text-sm">
              <dl className="grid grid-cols-2 gap-y-1 text-xs">
                <dt className="text-muted-foreground">Supplier</dt>
                <dd className="truncate text-right">
                  {p.supplier?.company_name ?? "—"}
                </dd>
                <dt className="text-muted-foreground">Unit</dt>
                <dd className="text-right font-mono">{p.unit ?? "—"}</dd>
                <dt className="text-muted-foreground">Sales price</dt>
                <dd className="text-right font-mono">
                  {formatPrice(p.default_sales_price, p.sales_currency)}
                </dd>
                <dt className="text-muted-foreground">KDV</dt>
                <dd className="text-right font-mono">
                  {p.kdv_rate === null || p.kdv_rate === undefined
                    ? "—"
                    : `${p.kdv_rate}%`}
                </dd>
              </dl>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
