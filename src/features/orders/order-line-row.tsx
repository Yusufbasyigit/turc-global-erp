"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Package, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { KDV_RATES, type OrderDetailWithRelations } from "@/lib/supabase/types";
import { updateOrderLine } from "./mutations";
import { orderKeys } from "./queries";
import { shipmentKeys } from "@/features/shipments/queries";
import type { OrderDetailUpdate } from "@/lib/supabase/types";

type EditFields = {
  qty: string;
  price: string;
  estPurchase: string;
  vat: string;
  supplierId: string | null;
};

function fieldsFromLine(line: OrderDetailWithRelations): EditFields {
  return {
    qty: String(line.quantity ?? ""),
    price: line.unit_sales_price === null ? "" : String(line.unit_sales_price),
    estPurchase:
      line.est_purchase_unit_price === null
        ? ""
        : String(line.est_purchase_unit_price),
    vat:
      line.vat_rate === null || line.vat_rate === undefined
        ? ""
        : String(line.vat_rate),
    supplierId: line.supplier_id,
  };
}

export function OrderLineRow({
  line,
  orderId,
  supplierItems,
  onDelete,
  onEditPackaging,
}: {
  line: OrderDetailWithRelations;
  orderId: string;
  supplierItems: { value: string; label: string }[];
  onDelete: () => void;
  onEditPackaging: () => void;
}) {
  const qc = useQueryClient();
  const [fields, setFields] = useState<EditFields>(() => fieldsFromLine(line));
  const focusedRef = useRef<keyof EditFields | null>(null);

  // Resync from props when the underlying line changes (e.g. after a refetch
  // from another tab or a parent mutation). Skip the field that's currently
  // focused so we don't stomp the user's keystrokes.
  useEffect(() => {
    setFields((prev) => {
      const next = fieldsFromLine(line);
      const focused = focusedRef.current;
      if (focused === null) return next;
      if (focused === "supplierId") {
        next.supplierId = prev.supplierId;
      } else {
        next[focused] = prev[focused];
      }
      return next;
    });
    // Track every persisted value so updates from outside flow through.
    // We list each field rather than `line` itself so a new wrapping array
    // reference from React Query doesn't trigger an unnecessary resync.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    line.id,
    line.quantity,
    line.unit_sales_price,
    line.est_purchase_unit_price,
    line.vat_rate,
    line.supplier_id,
  ]);

  const updateMut = useMutation({
    mutationFn: (payload: OrderDetailUpdate) =>
      updateOrderLine({ line_id: line.id, payload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: orderKeys.detail(orderId) });
      qc.invalidateQueries({ queryKey: orderKeys.list() });
      qc.invalidateQueries({ queryKey: shipmentKeys.all });
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed"),
  });

  const commitNumeric = (
    key: "qty" | "price" | "estPurchase",
    rawValue: string,
  ) => {
    // Quantity is required — empty input must not silently no-op the
    // mutation. Snap back to the persisted value instead.
    if (key === "qty" && rawValue.trim() === "") {
      setFields((prev) => ({ ...prev, qty: String(line.quantity ?? "") }));
      return;
    }
    const trimmed = rawValue.trim();
    const dbField =
      key === "qty"
        ? "quantity"
        : key === "price"
          ? "unit_sales_price"
          : "est_purchase_unit_price";
    const parsed = trimmed === "" ? null : Number(trimmed);
    if (parsed !== null && !Number.isFinite(parsed)) {
      toast.error("Enter a valid number");
      return;
    }
    const previous =
      dbField === "quantity"
        ? line.quantity
        : dbField === "unit_sales_price"
          ? line.unit_sales_price
          : line.est_purchase_unit_price;
    if (parsed === previous) return;
    if (dbField === "quantity") {
      updateMut.mutate({ quantity: parsed as number });
    } else if (dbField === "unit_sales_price") {
      updateMut.mutate({ unit_sales_price: parsed });
    } else {
      updateMut.mutate({ est_purchase_unit_price: parsed });
    }
  };

  return (
    <tr>
      <td className="px-3 py-2 tabular-nums text-xs text-muted-foreground">
        {line.line_number}
      </td>
      <td className="px-3 py-2">
        <div className="font-medium">{line.product_name_snapshot}</div>
        {line.unit_snapshot ? (
          <div className="text-[11px] text-muted-foreground">
            {line.unit_snapshot}
          </div>
        ) : null}
      </td>
      <td className="px-3 py-2 text-right">
        <Input
          type="number"
          step="0.01"
          min="0"
          value={fields.qty}
          onFocus={() => {
            focusedRef.current = "qty";
          }}
          onChange={(e) =>
            setFields((prev) => ({ ...prev, qty: e.target.value }))
          }
          onBlur={() => {
            focusedRef.current = null;
            commitNumeric("qty", fields.qty);
          }}
          className="h-8 w-20 text-right tabular-nums"
        />
      </td>
      <td className="px-3 py-2 text-right text-xs text-muted-foreground">
        {line.unit_snapshot || "—"}
      </td>
      <td className="px-3 py-2 text-right">
        <Input
          type="number"
          step="0.01"
          min="0"
          value={fields.price}
          onFocus={() => {
            focusedRef.current = "price";
          }}
          onChange={(e) =>
            setFields((prev) => ({ ...prev, price: e.target.value }))
          }
          onBlur={() => {
            focusedRef.current = null;
            commitNumeric("price", fields.price);
          }}
          className="h-8 w-24 text-right tabular-nums"
        />
      </td>
      <td className="px-3 py-2 text-right">
        <Input
          type="number"
          step="0.01"
          min="0"
          value={fields.estPurchase}
          onFocus={() => {
            focusedRef.current = "estPurchase";
          }}
          onChange={(e) =>
            setFields((prev) => ({ ...prev, estPurchase: e.target.value }))
          }
          onBlur={() => {
            focusedRef.current = null;
            commitNumeric("estPurchase", fields.estPurchase);
          }}
          className="h-8 w-24 text-right tabular-nums"
        />
      </td>
      <td className="px-3 py-2 text-right">
        <Select
          value={fields.vat === "" ? "" : fields.vat}
          onValueChange={(v) => {
            setFields((prev) => ({ ...prev, vat: v }));
            const next = v === "" ? null : Number(v);
            updateMut.mutate({ vat_rate: next });
          }}
        >
          <SelectTrigger className="h-8 w-20">
            <SelectValue placeholder="—" />
          </SelectTrigger>
          <SelectContent>
            {KDV_RATES.map((r) => (
              <SelectItem key={r} value={String(r)}>
                {r}%
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      <td className="px-3 py-2">
        <div className="w-40">
          <Combobox
            items={supplierItems}
            value={fields.supplierId}
            onChange={(v) => {
              setFields((prev) => ({ ...prev, supplierId: v }));
              updateMut.mutate({ supplier_id: v });
            }}
            placeholder="—"
            searchPlaceholder="Search…"
            emptyMessage="No match."
          />
        </div>
      </td>
      <td className="px-3 py-2">
        <Button
          size="sm"
          variant="ghost"
          onClick={onEditPackaging}
          title="Edit packaging"
        >
          <Package className="size-3.5" />
        </Button>
      </td>
      <td className="px-3 py-2 text-right">
        <Button size="sm" variant="ghost" onClick={onDelete}>
          <Trash2 className="size-3.5" />
        </Button>
      </td>
    </tr>
  );
}
