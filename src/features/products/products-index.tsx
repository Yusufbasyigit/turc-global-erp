"use client";

// TODO: show "needs details" badge on products where hs_code is null
//       AND (cbm_per_unit is null OR weight_kg_per_unit is null)
//       AND category_id is null — i.e. a proforma-created minimum-viable product

import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Package,
  Plus,
  Search,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useIsMobile } from "@/hooks/use-mobile";
import type { ProductWithRelations } from "@/lib/supabase/types";

import {
  listProductCategories,
  listProducts,
  listSupplierContacts,
  productCategoryKeys,
  productKeys,
  supplierKeys,
} from "./queries";
import { ProductsTable } from "./products-table";
import { ProductsCardList } from "./products-card-list";
import { ProductFormDialog } from "./product-form-dialog";
import { DeleteProductDialog } from "./delete-product-dialog";

type ActiveFilter = "active" | "all";

export function ProductsIndex() {
  const isMobile = useIsMobile();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [supplierFilter, setSupplierFilter] = useState<string>("all");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("active");
  const [groupByCategory, setGroupByCategory] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const {
    data: products,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: productKeys.list(),
    queryFn: listProducts,
  });

  const { data: categories = [] } = useQuery({
    queryKey: productCategoryKeys.all,
    queryFn: listProductCategories,
    staleTime: 60_000,
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: supplierKeys.all,
    queryFn: listSupplierContacts,
    staleTime: 60_000,
  });

  const filtered = useMemo(() => {
    if (!products) return [];
    const term = search.trim().toLowerCase();
    return products.filter((p) => {
      if (activeFilter === "active" && !p.is_active) return false;
      if (categoryFilter !== "all" && p.category_id !== categoryFilter)
        return false;
      if (supplierFilter !== "all" && p.default_supplier !== supplierFilter)
        return false;
      if (!term) return true;
      return (
        (p.product_name?.toLowerCase().includes(term) ?? false) ||
        (p.client_product_name?.toLowerCase().includes(term) ?? false) ||
        (p.barcode_value?.toLowerCase().includes(term) ?? false)
      );
    });
  }, [products, search, activeFilter, categoryFilter, supplierFilter]);

  const openCreate = () => {
    setEditingId(null);
    setFormOpen(true);
  };
  const openEdit = (id: string) => {
    setEditingId(id);
    setFormOpen(true);
  };
  const openDelete = (id: string, name: string) => {
    setDeleteTarget({ id, name });
    setDeleteOpen(true);
  };

  const hasAnyProducts = (products?.length ?? 0) > 0;
  const hasFilteredProducts = filtered.length > 0;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Products</h1>
          <p className="text-sm text-muted-foreground">
            Catalog with default pricing, packaging, and photos.
          </p>
        </div>
        {hasAnyProducts ? (
          <Button onClick={openCreate} className="md:self-end">
            <Plus className="mr-2 size-4" />
            Add product
          </Button>
        ) : null}
      </header>

      {hasAnyProducts ? (
        <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center">
          <div className="relative flex-1 md:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, client name, barcode…"
              className="pl-9"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="md:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={supplierFilter} onValueChange={setSupplierFilter}>
            <SelectTrigger className="md:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All suppliers</SelectItem>
              {suppliers.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.company_name ?? "—"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={activeFilter}
            onValueChange={(v) => setActiveFilter(v as ActiveFilter)}
          >
            <SelectTrigger className="md:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active only</SelectItem>
              <SelectItem value="all">Include inactive</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant={groupByCategory ? "default" : "outline"}
            onClick={() => setGroupByCategory((v) => !v)}
          >
            Group by category
          </Button>
        </div>
      ) : null}

      {isLoading ? <ListSkeleton /> : null}

      {isError ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          Failed to load products: {(error as Error).message}
        </div>
      ) : null}

      {!isLoading && !isError && !hasAnyProducts ? (
        <EmptyState onAdd={openCreate} />
      ) : null}

      {!isLoading && !isError && hasAnyProducts && !hasFilteredProducts ? (
        <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
          No products match the current filters.
        </div>
      ) : null}

      {!isLoading && hasFilteredProducts ? (
        groupByCategory ? (
          <GroupedView
            products={filtered}
            isMobile={isMobile}
            onEdit={openEdit}
            onDelete={openDelete}
          />
        ) : isMobile ? (
          <ProductsCardList
            products={filtered}
            onEdit={openEdit}
            onDelete={openDelete}
          />
        ) : (
          <ProductsTable
            products={filtered}
            onEdit={openEdit}
            onDelete={openDelete}
          />
        )
      ) : null}

      {hasAnyProducts ? (
        <Button
          size="icon"
          onClick={openCreate}
          className="fixed bottom-6 right-6 size-14 rounded-full shadow-lg"
          aria-label="Add product"
        >
          <Plus className="size-6" />
        </Button>
      ) : null}

      <ProductFormDialog
        open={formOpen}
        onOpenChange={(o) => {
          setFormOpen(o);
          if (!o) setEditingId(null);
        }}
        productId={editingId}
      />

      {deleteTarget ? (
        <DeleteProductDialog
          open={deleteOpen}
          onOpenChange={(o) => {
            setDeleteOpen(o);
            if (!o) setDeleteTarget(null);
          }}
          productId={deleteTarget.id}
          productName={deleteTarget.name}
        />
      ) : null}
    </div>
  );
}

function GroupedView({
  products,
  isMobile,
  onEdit,
  onDelete,
}: {
  products: ProductWithRelations[];
  isMobile: boolean;
  onEdit: (id: string) => void;
  onDelete: (id: string, name: string) => void;
}) {
  const groups = useMemo(() => {
    const map = new Map<
      string,
      { key: string; name: string; products: ProductWithRelations[] }
    >();
    for (const p of products) {
      const key = p.category_id ?? "__none";
      const name = p.product_categories?.name ?? "Uncategorized";
      const entry = map.get(key) ?? { key, name, products: [] };
      entry.products.push(p);
      map.set(key, entry);
    }
    return Array.from(map.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [products]);

  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <CategoryGroup
          key={g.key}
          name={g.name}
          products={g.products}
          isMobile={isMobile}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}

function CategoryGroup({
  name,
  products,
  isMobile,
  onEdit,
  onDelete,
}: {
  name: string;
  products: ProductWithRelations[];
  isMobile: boolean;
  onEdit: (id: string) => void;
  onDelete: (id: string, name: string) => void;
}) {
  const [open, setOpen] = useState(true);
  return (
    <section className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left hover:bg-muted/40"
      >
        {open ? (
          <ChevronDown className="size-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-4 text-muted-foreground" />
        )}
        <h2 className="text-sm font-medium">{name}</h2>
        <span className="ml-1 text-xs text-muted-foreground">
          ({products.length})
        </span>
      </button>
      {open ? (
        isMobile ? (
          <ProductsCardList
            products={products}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ) : (
          <ProductsTable
            products={products}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        )
      ) : null}
    </section>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-card/50 p-12 text-center">
      <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted">
        <Package className="size-6 text-muted-foreground" />
      </div>
      <h2 className="text-lg font-medium">No products yet</h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Add your first product to start building the catalog for orders and
        proposals.
      </p>
      <Button onClick={onAdd} className="mt-6">
        <Plus className="mr-2 size-4" />
        Add your first product
      </Button>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-2 rounded-lg border bg-card p-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}
