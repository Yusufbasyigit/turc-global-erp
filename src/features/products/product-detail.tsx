"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Package, Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PACKAGING_TYPE_LABELS } from "@/lib/constants";
import type { PackagingType } from "@/lib/supabase/types";

import { ActiveBadge } from "./active-badge";
import { productKeys, getProduct, productImageUrl } from "./queries";
import { ProductFormDialog } from "./product-form-dialog";
import { DeleteProductDialog } from "./delete-product-dialog";
import { ProductOrdersList } from "./product-orders-list";

function formatPrice(
  amount: number | null | undefined,
  currency: string | null | undefined,
): string | null {
  if (amount === null || amount === undefined) return null;
  const amt = Number(amount).toFixed(2);
  return currency ? `${currency} ${amt}` : amt;
}

export function ProductDetail({ productId }: { productId: string }) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const {
    data: product,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: productKeys.detail(productId),
    queryFn: () => getProduct(productId),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
        Failed to load product: {(error as Error).message}
      </div>
    );
  }

  if (!product) {
    return (
      <div className="space-y-4">
        <BackLink />
        <div className="rounded-lg border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">
            This product does not exist or was deleted.
          </p>
        </div>
      </div>
    );
  }

  const imgUrl = productImageUrl(product.product_image);
  const name = product.product_name ?? "Untitled product";
  const salesPrice = formatPrice(
    product.default_sales_price,
    product.sales_currency,
  );
  const purchasePrice = formatPrice(
    product.est_purchase_price,
    product.est_currency,
  );
  const packagingLabel = product.packaging_type
    ? (PACKAGING_TYPE_LABELS[product.packaging_type as PackagingType] ??
      product.packaging_type)
    : null;

  return (
    <div className="space-y-6">
      <BackLink />

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex gap-4">
          {imgUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imgUrl}
              alt=""
              className="size-24 shrink-0 rounded-lg object-cover"
            />
          ) : (
            <div className="flex size-24 shrink-0 items-center justify-center rounded-lg bg-muted">
              <Package className="size-8 text-muted-foreground" />
            </div>
          )}
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <ActiveBadge active={product.is_active} />
              {product.product_categories?.name ? (
                <span className="text-xs text-muted-foreground">
                  {product.product_categories.name}
                </span>
              ) : null}
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">{name}</h1>
            {product.client_product_name ? (
              <p className="text-sm text-muted-foreground">
                Client-facing: {product.client_product_name}
              </p>
            ) : null}
            {product.barcode_value ? (
              <p className="text-xs text-muted-foreground">
                Barcode:{" "}
                <span className="font-mono text-foreground">
                  {product.barcode_value}
                </span>
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil className="mr-2 size-4" />
            Edit
          </Button>
          <Button
            variant="outline"
            onClick={() => setDeleteOpen(true)}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="mr-2 size-4" />
            Delete
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Basics</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-y-4 gap-x-8 pb-4 md:grid-cols-2">
          <DetailField
            label="Category"
            value={product.product_categories?.name}
          />
          <DetailField
            label="Supplier"
            value={product.supplier?.company_name}
          />
          <DetailField label="Unit" value={product.unit} />
          <DetailField label="Barcode" value={product.barcode_value} />
          <DetailField
            label="HS code (GTİP)"
            value={
              product.hs_code ? (
                <span className="font-mono">{product.hs_code}</span>
              ) : null
            }
          />
        </CardContent>
      </Card>

      {product.client_description ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Client description</CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <p className="whitespace-pre-wrap text-sm">
              {product.client_description}
            </p>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Pricing</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-y-4 gap-x-8 pb-4 md:grid-cols-2">
          <DetailField label="Est. purchase price" value={purchasePrice} />
          <DetailField label="Default sales price" value={salesPrice} />
          <DetailField
            label="KDV rate"
            value={
              product.kdv_rate === null || product.kdv_rate === undefined
                ? null
                : `${product.kdv_rate}%`
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Logistics</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-y-4 gap-x-8 pb-4 md:grid-cols-2">
          <DetailField
            label="CBM per unit"
            value={
              product.cbm_per_unit !== null &&
              product.cbm_per_unit !== undefined
                ? `${Number(product.cbm_per_unit).toFixed(4)} m³`
                : null
            }
          />
          <DetailField
            label="Weight per unit"
            value={
              product.weight_kg_per_unit !== null &&
              product.weight_kg_per_unit !== undefined
                ? `${Number(product.weight_kg_per_unit).toFixed(2)} kg`
                : null
            }
          />
        </CardContent>
      </Card>

      {packagingLabel ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Packaging</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-y-4 gap-x-8 pb-4 md:grid-cols-2">
            <DetailField label="Packaging type" value={packagingLabel} />
            <DetailField
              label="Units per package"
              value={
                product.units_per_package !== null &&
                product.units_per_package !== undefined
                  ? String(product.units_per_package)
                  : null
              }
            />
            <DetailField
              label="Length"
              value={
                product.package_length_cm !== null &&
                product.package_length_cm !== undefined
                  ? `${product.package_length_cm} cm`
                  : null
              }
            />
            <DetailField
              label="Width"
              value={
                product.package_width_cm !== null &&
                product.package_width_cm !== undefined
                  ? `${product.package_width_cm} cm`
                  : null
              }
            />
            <DetailField
              label="Height"
              value={
                product.package_height_cm !== null &&
                product.package_height_cm !== undefined
                  ? `${product.package_height_cm} cm`
                  : null
              }
            />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Used in orders</CardTitle>
        </CardHeader>
        <CardContent className="pb-4">
          <ProductOrdersList productId={productId} />
        </CardContent>
      </Card>

      <ProductFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        productId={productId}
      />
      <DeleteProductDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        productId={productId}
        productName={name}
        redirectOnSuccess
      />
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/products"
      className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" />
      Back to products
    </Link>
  );
}

function DetailField({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-1 text-sm">
        {value == null || value === "" ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          value
        )}
      </div>
    </div>
  );
}
