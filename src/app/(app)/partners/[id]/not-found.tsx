import Link from "next/link";

export default function PartnerNotFound() {
  return (
    <div className="space-y-4">
      <Link
        href="/partners"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        ← Back to partners
      </Link>
      <div className="rounded-lg border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">
          This partner does not exist or was deleted.
        </p>
      </div>
    </div>
  );
}
