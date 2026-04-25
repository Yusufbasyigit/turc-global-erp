import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OrderDetail } from "@/features/orders/order-detail";

export const metadata = { title: "Order · Turc Global" };

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (!data) notFound();

  return <OrderDetail id={id} />;
}
