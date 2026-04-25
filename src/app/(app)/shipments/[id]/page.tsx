import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ShipmentDetail } from "@/features/shipments/shipment-detail";

export const metadata = { title: "Shipment · Turc Global" };

export default async function ShipmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const { data } = await supabase
    .from("shipments")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (!data) notFound();

  return <ShipmentDetail id={id} />;
}
