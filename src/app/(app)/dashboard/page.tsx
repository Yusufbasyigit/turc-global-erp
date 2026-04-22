import { LayoutDashboard } from "lucide-react";
import { ComingSoon } from "@/components/coming-soon";

export const metadata = { title: "Dashboard · Turc Global" };

export default function DashboardPage() {
  return (
    <ComingSoon
      title="Dashboard"
      description="A cross-module overview will live here — KPIs, open orders, treasury snapshot."
      icon={LayoutDashboard}
    />
  );
}
