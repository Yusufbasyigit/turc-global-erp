import { ClipboardList } from "lucide-react";
import { ComingSoon } from "@/components/coming-soon";

export const metadata = { title: "Orders · Turc Global" };

export default function OrdersPage() {
  return (
    <ComingSoon
      title="Orders"
      description="From inquiry through shipped — every client order lives here."
      icon={ClipboardList}
    />
  );
}
