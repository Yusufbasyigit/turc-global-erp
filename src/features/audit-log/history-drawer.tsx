"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { History } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { auditLogKeys, listAuditEntries, type AuditEntry } from "./queries";
import {
  computeDiff,
  formatJsonValue,
  prettyFieldLabel,
  type AuditAction,
} from "./diff";

type Props = {
  table: string;
  rowId: string | null | undefined;
  /** Optional label rendered in the drawer header (e.g. order number, shipment name). */
  label?: string;
  /** Visual: defaults to a small ghost icon-only button with tooltip. */
  variant?: "icon" | "icon-sm" | "outline-sm";
};

const ACTION_BADGE_CLASSES: Record<AuditAction, string> = {
  insert: "bg-emerald-50 text-emerald-900 border-emerald-200",
  update: "bg-amber-50 text-amber-900 border-amber-200",
  delete: "bg-rose-50 text-rose-900 border-rose-200",
};

function formatTimestamp(ts: string): string {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}

function formatActor(uuid: string | null): string {
  if (!uuid) return "—";
  return uuid.slice(0, 8);
}

export function HistoryDrawer({
  table,
  rowId,
  label,
  variant = "icon",
}: Props) {
  const [open, setOpen] = useState(false);

  const enabled = open && Boolean(rowId);
  const q = useQuery({
    queryKey: rowId ? auditLogKeys.forRow(table, rowId) : ["audit_log", "noop"],
    queryFn: () => listAuditEntries(table, rowId as string),
    enabled,
  });

  const trigger =
    variant === "outline-sm" ? (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        disabled={!rowId}
      >
        <History className="mr-1 h-3.5 w-3.5" />
        History
      </Button>
    ) : (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size={variant === "icon-sm" ? "icon-sm" : "icon"}
            onClick={() => setOpen(true)}
            disabled={!rowId}
            aria-label="View history"
          >
            <History className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>View change history</TooltipContent>
      </Tooltip>
    );

  return (
    <>
      {trigger}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Change history</SheetTitle>
            <SheetDescription>
              {label ? <>{label} · </> : null}
              <span className="font-mono text-[11px]">{table}</span>
              {rowId ? (
                <span className="ml-1 font-mono text-[11px] text-muted-foreground">
                  · {rowId.slice(0, 8)}
                </span>
              ) : null}
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 px-4 pb-6">
            {q.isPending && enabled ? (
              <div className="space-y-3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : null}
            {q.isError ? (
              <p className="text-sm text-destructive">
                Couldn’t load history: {(q.error as Error).message}
              </p>
            ) : null}
            {q.data && q.data.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No changes recorded yet. The audit log captures changes from
                2026-05-05 onward.
              </p>
            ) : null}
            {q.data && q.data.length > 0 ? (
              <ol className="space-y-0 divide-y">
                {q.data.map((entry) => (
                  <HistoryEntry key={entry.id} entry={entry} />
                ))}
              </ol>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function HistoryEntry({ entry }: { entry: AuditEntry }) {
  const action = entry.action as AuditAction;
  const diff = computeDiff(action, entry.old_data, entry.new_data);
  const [showRaw, setShowRaw] = useState(false);

  return (
    <li className="space-y-2 py-3">
      <div className="flex flex-wrap items-baseline gap-2 text-xs">
        <Badge
          className={cn(
            "border text-[10px] uppercase tracking-wide",
            ACTION_BADGE_CLASSES[action],
          )}
        >
          {action}
        </Badge>
        <span className="font-mono text-[11px] text-muted-foreground">
          {formatTimestamp(entry.changed_at)}
        </span>
        <span className="text-muted-foreground">·</span>
        <span className="text-muted-foreground">
          by{" "}
          <span className="font-mono text-[11px]">
            {formatActor(entry.changed_by)}
          </span>
        </span>
      </div>

      {diff.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">
          (no field-level differences captured)
        </p>
      ) : (
        <ul className="space-y-1 text-xs">
          {diff.map((d) => (
            <li key={d.field} className="flex flex-wrap items-baseline gap-1.5">
              <span className="font-medium">{prettyFieldLabel(d.field)}:</span>
              {action === "insert" ? (
                <span className="font-mono text-emerald-900">
                  {formatJsonValue(d.newValue)}
                </span>
              ) : action === "delete" ? (
                <span className="font-mono text-rose-900 line-through">
                  {formatJsonValue(d.oldValue)}
                </span>
              ) : (
                <>
                  <span className="font-mono text-muted-foreground line-through">
                    {formatJsonValue(d.oldValue)}
                  </span>
                  <span className="text-muted-foreground">→</span>
                  <span className="font-mono text-foreground">
                    {formatJsonValue(d.newValue)}
                  </span>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        className="text-[11px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
        onClick={() => setShowRaw((v) => !v)}
      >
        {showRaw ? "hide raw" : "show raw"}
      </button>
      {showRaw ? (
        <pre className="overflow-x-auto rounded bg-muted/40 p-2 text-[10px] font-mono">
          {JSON.stringify(
            { old_data: entry.old_data, new_data: entry.new_data },
            null,
            2,
          )}
        </pre>
      ) : null}
    </li>
  );
}
