"use client";

import { useState } from "react";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ManagePartnersDrawer } from "./manage-partners-drawer";
import { PendingReimbursementsSection } from "./pending-reimbursements-section";
import { PsdSection } from "./psd-section";
import { LoansSection } from "./loans-section";

export function PartnersIndex() {
  const [manageOpen, setManageOpen] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Partners</h1>
          <p className="text-sm text-muted-foreground">
            Reimbursements, profit share, loans
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => setManageOpen(true)}
          className="sm:self-end"
        >
          <Settings className="mr-2 size-4" />
          Manage partners
        </Button>
      </header>

      <PendingReimbursementsSection />
      <PsdSection />
      <LoansSection />

      <ManagePartnersDrawer open={manageOpen} onOpenChange={setManageOpen} />
    </div>
  );
}
