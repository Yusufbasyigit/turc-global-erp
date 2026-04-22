import { Ship } from "lucide-react";
import { ComingSoon } from "@/components/coming-soon";

export const metadata = { title: "Shipments · Turc Global" };

export default function ShipmentsPage() {
  return (
    <ComingSoon
      title="Shipments"
      description="Containers, Yükleme Talimatı, and freight — grouping one or more orders."
      icon={Ship}
    />
  );
}
