"use client";

import Link from "next/link";
import { ArrowLeft, Pencil } from "lucide-react";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Partner } from "@/lib/supabase/types";

export function PartnerDetailHeader({
  partner,
  earliestActivity,
  onEdit,
}: {
  partner: Partner;
  earliestActivity: string | null;
  onEdit: () => void;
}) {
  const isDeleted = partner.deleted_at !== null;
  const sinceDate = earliestActivity ?? partner.created_time;

  return (
    <div className="space-y-4">
      <nav className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link
          href="/partners"
          className="inline-flex items-center gap-1 hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Partners
        </Link>
        <span>›</span>
        <span className="text-foreground">{partner.name}</span>
      </nav>

      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <StatusBadge isDeleted={isDeleted} isActive={partner.is_active} />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {partner.name}
          </h1>
          {sinceDate ? (
            <p className="text-xs text-muted-foreground">
              Partner since {formatSince(sinceDate)}
            </p>
          ) : null}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onEdit}>
            <Pencil className="mr-2 size-4" />
            Edit
          </Button>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({
  isDeleted,
  isActive,
}: {
  isDeleted: boolean;
  isActive: boolean;
}) {
  if (isDeleted) return <Badge variant="destructive">Deleted</Badge>;
  if (isActive)
    return (
      <Badge className="bg-emerald-500/15 text-emerald-700 border-transparent">
        Active
      </Badge>
    );
  return <Badge variant="secondary">Inactive</Badge>;
}

function formatSince(dateStr: string): string {
  try {
    const d = dateStr.includes("T") ? parseISO(dateStr) : parseISO(dateStr);
    return format(d, "MMM yyyy");
  } catch {
    return dateStr;
  }
}
