"use client";

import { AttentionList } from "./attention-list";
import {
  ArOutstandingCard,
  PartnerReimbursementCard,
  TreasurySnapshotCard,
} from "./snapshot-cards";

// /dashboard is a read-only morning briefing: snapshot strip on top,
// attention list below. Each snapshot card runs its own useQuery so a slow
// Treasury fetch doesn't block AR or partner-reimbursement readout. The
// attention list runs as a fourth independent query batch (shipments +
// KDV summary + partner reimbursement claims) and evaluates the rules in
// JS over already-fetched data — no new server endpoints.
export function DashboardIndex() {
  return (
    <div className="flex flex-col gap-8">
      <section className="grid gap-3 grid-cols-1 md:grid-cols-3">
        <TreasurySnapshotCard />
        <ArOutstandingCard />
        <PartnerReimbursementCard />
      </section>

      <AttentionList />
    </div>
  );
}
