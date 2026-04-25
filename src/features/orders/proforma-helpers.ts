export function notesFromLine(line: {
  supplier_sku?: string | null;
  secondary_quantities?: Record<string, number> | null;
  notes?: string | null;
}): string | null {
  const pieces: string[] = [];
  if (line.supplier_sku && line.supplier_sku.trim()) {
    pieces.push(`SKU: ${line.supplier_sku.trim()}`);
  }
  if (line.secondary_quantities) {
    for (const [k, v] of Object.entries(line.secondary_quantities)) {
      pieces.push(`${k}: ${v}`);
    }
  }
  if (line.notes && line.notes.trim()) {
    pieces.push(line.notes.trim());
  }
  return pieces.length > 0 ? pieces.join(" · ") : null;
}

export function hasLineMathMismatch(line: {
  primary_quantity: number;
  unit_price: number;
  parsed_line_total: number;
}): { stated: number; computed: number; message: string } | null {
  const computed = line.primary_quantity * line.unit_price;
  const stated = line.parsed_line_total;
  if (Math.abs(computed - stated) <= 0.01) return null;
  return {
    stated,
    computed,
    message: `LLM returned line_total = ${stated.toFixed(2)} but qty × unit_price = ${computed.toFixed(2)}. Review before adding.`,
  };
}
