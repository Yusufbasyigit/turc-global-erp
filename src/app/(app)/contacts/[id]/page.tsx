import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ContactDetail } from "@/features/contacts/contact-detail";

export const metadata = { title: "Contact · Turc Global" };

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const { data } = await supabase
    .from("contacts")
    .select("id, company_name")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!data) notFound();

  return <ContactDetail contactId={id} />;
}
