import { Package } from "lucide-react";
import { ComingSoon } from "@/components/coming-soon";

export const metadata = { title: "Products · Turc Global" };

export default function ProductsPage() {
  return (
    <ComingSoon
      title="Products"
      description="Catalogue with default packaging, prices, and photos."
      icon={Package}
    />
  );
}
