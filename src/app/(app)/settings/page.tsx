import { Settings } from "lucide-react";
import { ComingSoon } from "@/components/coming-soon";

export const metadata = { title: "Settings · Turc Global" };

export default function SettingsPage() {
  return (
    <ComingSoon
      title="Settings"
      description="Custody locations, FX sources, pricing thresholds, and more."
      icon={Settings}
    />
  );
}
