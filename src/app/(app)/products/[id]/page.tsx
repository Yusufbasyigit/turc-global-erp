import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProductDetail } from "@/features/products/product-detail";

export const metadata = { title: "Product · Turc Global" };

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select("product_id")
    .eq("product_id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!data) notFound();

  return <ProductDetail productId={id} />;
}
