"use client";

import { useState } from "react";
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
  const [qty, setQty] = useState(String(line.quantity ?? ""));
  const [price, setPrice] = useState(
    line.unit_sales_price === null ? "" : String(line.unit_sales_price),
  );
  const [estPurchase, setEstPurchase] = useState(
    line.est_purchase_unit_price === null
      ? ""
      : String(line.est_purchase_unit_price),
  );
  const [vat, setVat] = useState<string>(
    line.vat_rate === null || line.vat_rate === undefined
      ? ""
      : String(line.vat_rate),
  );
  const [supplierId, setSupplierId] = useState<string | null>(line.supplier_id);

  const updateMut = useMutation({
    mutationFn: () =>
      updateOrderLine({
        line_id: line.id,
        payload: {
          quantity: qty === "" ? line.quantity : Number(qty),
          unit_sales_price: price === "" ? null : Number(price),
          est_purchase_unit_price:
            estPurchase === "" ? null : Number(estPurchase),
          vat_rate: vat === "" ? null : Number(vat),
          supplier_id: supplierId,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: orderKeys.detail(orderId) });
      qc.invalidateQueries({ queryKey: orderKeys.list() });
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed"),
  });

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
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          onBlur={() => updateMut.mutate()}
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
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          onBlur={() => updateMut.mutate()}
          className="h-8 w-24 text-right tabular-nums"
        />
      </td>
      <td className="px-3 py-2 text-right">
        <Input
          type="number"
          step="0.01"
          min="0"
          value={estPurchase}
          onChange={(e) => setEstPurchase(e.target.value)}
          onBlur={() => updateMut.mutate()}
          className="h-8 w-24 text-right tabular-nums"
        />
      </td>
      <td className="px-3 py-2 text-right">
        <Select
          value={vat === "" ? "" : vat}
          onValueChange={(v) => {
            setVat(v);
            setTimeout(() => updateMut.mutate(), 0);
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
            value={supplierId}
            onChange={(v) => {
              setSupplierId(v);
              setTimeout(() => updateMut.mutate(), 0);
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
