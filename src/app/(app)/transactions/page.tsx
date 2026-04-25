import { Suspense } from "react";
import { TransactionsIndex } from "@/features/transactions/transactions-index";

export const metadata = { title: "Transactions · Turc Global" };

export default function TransactionsPage() {
  return (
    <Suspense fallback={null}>
      <TransactionsIndex />
    </Suspense>
  );
}
