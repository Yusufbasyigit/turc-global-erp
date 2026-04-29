"use client";

import { useEffect, useMemo } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";

import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import {
  productBatchImportSchema,
  type ProductBatchImport,
} from "./product-batch-import-schema";

type ParseState =
  | { status: "empty" }
  | { status: "parseError"; message: string }
  | { status: "zodError"; message: string }
  | { status: "ok"; parsed: ProductBatchImport };

function parseJson(text: string): ParseState {
  const trimmed = text.trim();
  if (!trimmed) return { status: "empty" };
  let raw: unknown;
  try {
    raw = JSON.parse(trimmed);
  } catch (e) {
    return {
      status: "parseError",
      message: e instanceof Error ? e.message : "Invalid JSON",
    };
  }
  const result = productBatchImportSchema.safeParse(raw);
  if (!result.success) {
    const issue = result.error.issues[0];
    const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
    return {
      status: "zodError",
      message: `${path}: ${issue.message}`,
    };
  }
  return { status: "ok", parsed: result.data };
}

export function BatchAddProductsStep2Paste({
  jsonText,
  onJsonTextChange,
  onValid,
}: {
  jsonText: string;
  onJsonTextChange: (v: string) => void;
  onValid: (parsed: ProductBatchImport | null) => void;
}) {
  const state = useMemo(() => parseJson(jsonText), [jsonText]);

  useEffect(() => {
    onValid(state.status === "ok" ? state.parsed : null);
  }, [state, onValid]);

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-medium">Paste JSON</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Paste the JSON response from your Claude/Gemini chat.
        </p>
      </div>

      <Textarea
        value={jsonText}
        onChange={(e) => onJsonTextChange(e.target.value)}
        placeholder="Paste the JSON here."
        rows={12}
        className="font-mono text-xs"
      />

      <div
        className={cn(
          "flex items-start gap-2 rounded-md border p-2 text-xs",
          state.status === "empty" && "border-border text-muted-foreground",
          state.status === "parseError" &&
            "border-destructive/50 bg-destructive/5 text-destructive",
          state.status === "zodError" &&
            "border-amber-500/40 bg-amber-50 text-amber-900",
          state.status === "ok" &&
            "border-emerald-500/40 bg-emerald-50 text-emerald-900",
        )}
      >
        {state.status === "ok" ? (
          <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />
        ) : state.status === "empty" ? null : (
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
        )}
        <div>
          {state.status === "empty" && "Paste the JSON from your chat."}
          {state.status === "parseError" &&
            `Couldn't parse as JSON: ${state.message}`}
          {state.status === "zodError" &&
            `JSON structure issue: ${state.message}`}
          {state.status === "ok" &&
            `Found ${state.parsed.products.length} product${state.parsed.products.length === 1 ? "" : "s"}.`}
        </div>
      </div>
    </div>
  );
}
