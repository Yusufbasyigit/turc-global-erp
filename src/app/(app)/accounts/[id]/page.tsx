import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AccountDetail } from "@/features/accounts/account-detail";

export const metadata = { title: "Account · Turc Global" };

export default async function AccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const { data } = await supabase
    .from("accounts")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (!data) notFound();

  return <AccountDetail accountId={id} />;
}
