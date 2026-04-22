import { HandCoins } from "lucide-react";
import { ComingSoon } from "@/components/coming-soon";

export const metadata = { title: "Partners · Turc Global" };

export default function PartnersPage() {
  return (
    <ComingSoon
      title="Partners"
      description="Ownership, loans in/out, and monthly profit-share distributions."
      icon={HandCoins}
    />
  );
}
