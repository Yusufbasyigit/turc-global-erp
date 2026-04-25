import { Skeleton } from "@/components/ui/skeleton";

export default function PartnerDetailLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-10 w-64" />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
      <Skeleton className="h-40 w-full" />
    </div>
  );
}
