import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PartnerDetail } from "@/features/partners/partner-detail";

export const metadata = { title: "Partner · Turc Global" };

export default async function PartnerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const { data } = await supabase
    .from("partners")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (!data) notFound();

  return <PartnerDetail partnerId={id} />;
}
