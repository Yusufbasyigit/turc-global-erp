import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";

export type AuditEntry = Database["public"]["Tables"]["audit_log"]["Row"];

export const auditLogKeys = {
  all: ["audit_log"] as const,
  forRow: (table: string, rowId: string) =>
    [...auditLogKeys.all, table, rowId] as const,
};

export async function listAuditEntries(
  table: string,
  rowId: string,
): Promise<AuditEntry[]> {
  const sb = createClient();
  const { data, error } = await sb
    .from("audit_log")
    .select("*")
    .eq("table_name", table)
    .eq("row_id", rowId)
    .order("changed_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return data ?? [];
}
