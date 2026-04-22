import { Wallet } from "lucide-react";
import { ComingSoon } from "@/components/coming-soon";

export const metadata = { title: "Accounts · Turc Global" };

export default function AccountsPage() {
  return (
    <ComingSoon
      title="Accounts"
      description="Holdings across Şirket, Ortak, Kasa — cash, crypto, metals, funds."
      icon={Wallet}
    />
  );
}
