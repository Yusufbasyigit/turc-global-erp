import { CompanyInfoSection } from "@/features/settings/company-info-section";
import { CustodyLocationsSection } from "@/features/settings/custody-locations-section";
import { Separator } from "@/components/ui/separator";

export const metadata = { title: "Settings · Turc Global" };

export default function SettingsPage() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-10 p-6">
      <header className="space-y-1">
        <h1 className="editorial-h1">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Company letterhead and custody locations.
        </p>
      </header>

      <CompanyInfoSection />

      <Separator />

      <CustodyLocationsSection />
    </div>
  );
}
