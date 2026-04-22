import { ArrowLeftRight } from "lucide-react";
import { ComingSoon } from "@/components/coming-soon";

export const metadata = { title: "Transactions · Turc Global" };

export default function TransactionsPage() {
  return (
    <ComingSoon
      title="Transactions"
      description="Every movement on every holding — buys, sells, transfers, deposits, withdrawals."
      icon={ArrowLeftRight}
    />
  );
}
