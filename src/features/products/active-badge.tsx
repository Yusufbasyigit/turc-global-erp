import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function ActiveBadge({
  active,
  className,
}: {
  active: boolean | null | undefined;
  className?: string;
}) {
  const on = Boolean(active);
  return (
    <Badge
      variant="outline"
      className={cn(
        "border-transparent",
        on
          ? "bg-emerald-500/15 text-emerald-300"
          : "bg-zinc-500/15 text-zinc-400",
        className,
      )}
    >
      {on ? "Active" : "Inactive"}
    </Badge>
  );
}
