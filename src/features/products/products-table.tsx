"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Package, Pencil, Trash2 } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { productImageUrl } from "./queries";

function formatPrice(
  amount: number | null | undefined,
  currency: string | null | undefined,
): string {
  if (amount === null || amount === undefined) return "—";
  const amt = Number(amount).toFixed(2);
  return currency ? `${currency} ${amt}` : amt;
}

function formatNumber(
  value: number | null | undefined,
  digits = 2,
): string {
  if (value === null || value === undefined) return "—";
  return Number(value).toFixed(digits);
}

export function ProductsTable({
  products,
  onEdit,
  onDelete,
}: {
  products: ProductWithRelations[];
  onEdit: (id: string) => void;
  onDelete: (id: string, name: string) => void;
}) {
  const router = useRouter();
  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[56px]" />
            <TableHead>Name</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Supplier</TableHead>
            <TableHead>Unit</TableHead>
            <TableHead className="text-right">CBM</TableHead>
            <TableHead className="text-right">Weight (kg)</TableHead>
            <TableHead className="text-right">Sales price</TableHead>
            <TableHead className="text-right">KDV</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-[48px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((p) => {
            const imgUrl = productImageUrl(p.product_image);
            const dimmed = !p.is_active;
            const name = p.product_name ?? "Untitled product";
            return (
              <TableRow
                key={p.product_id}
                className={cn(
                  "cursor-pointer hover:bg-muted/30",
                  dimmed && "opacity-60",
                )}
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest("[data-row-action]"))
                    return;
                  router.push(`/products/${p.product_id}`);
                }}
              >
                <TableCell>
                  <Thumb url={imgUrl} />
                </TableCell>
                <TableCell className="font-medium">
                  <Link
                    href={`/products/${p.product_id}`}
                    className="hover:underline"
                  >
                    {name}
                  </Link>
                  {p.client_product_name ? (
                    <div className="text-xs text-muted-foreground truncate max-w-[24ch]">
                      {p.client_product_name}
                    </div>
                  ) : null}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {p.product_categories?.name ?? "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {p.supplier?.company_name ?? "—"}
                </TableCell>
                <TableCell className="text-muted-foreground font-mono text-xs">
                  {p.unit ?? "—"}
                </TableCell>
                <TableCell className="text-right font-mono text-xs text-muted-foreground">
                  {formatNumber(p.cbm_per_unit, 4)}
                </TableCell>
                <TableCell className="text-right font-mono text-xs text-muted-foreground">
                  {formatNumber(p.weight_kg_per_unit, 2)}
                </TableCell>
                <TableCell className="text-right font-mono text-xs">
                  {formatPrice(p.default_sales_price, p.sales_currency)}
                </TableCell>
                <TableCell className="text-right font-mono text-xs text-muted-foreground">
                  {p.kdv_rate === null || p.kdv_rate === undefined
                    ? "—"
                    : `${p.kdv_rate}%`}
                </TableCell>
                <TableCell>
                  <ActiveBadge active={p.is_active} />
                </TableCell>
                <TableCell data-row-action>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        aria-label="Row actions"
                      >
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      onClick={(e) => e.stopPropagation()}
                    >
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
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function Thumb({ url }: { url: string | null }) {
  if (!url) {
    return (
      <div className="flex size-10 items-center justify-center rounded-md bg-muted">
        <Package className="size-4 text-muted-foreground" />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      className="size-10 rounded-md object-cover"
      loading="lazy"
    />
  );
}
