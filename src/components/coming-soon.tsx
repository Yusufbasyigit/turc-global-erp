import { Hammer, type LucideIcon } from "lucide-react";

interface ComingSoonProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
}

export function ComingSoon({
  title,
  description = "We're still building this module. Check back soon.",
  icon: Icon = Hammer,
}: ComingSoonProps) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <div className="rounded-full bg-primary/10 p-4 text-primary">
        <Icon className="size-8" strokeWidth={1.5} />
      </div>
      <div className="flex flex-col gap-1 max-w-sm">
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
