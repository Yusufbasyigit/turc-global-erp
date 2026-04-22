import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  CONTACT_TYPE_BADGE_CLASSES,
  CONTACT_TYPE_LABELS,
} from "@/lib/constants";
import type { ContactType } from "@/lib/supabase/types";

export function ContactTypeBadge({
  type,
  className,
}: {
  type: string | null | undefined;
  className?: string;
}) {
  if (!type) {
    return (
      <Badge variant="outline" className={cn("text-muted-foreground", className)}>
        Untyped
      </Badge>
    );
  }
  const known = type as ContactType;
  const label = CONTACT_TYPE_LABELS[known] ?? type;
  const cls = CONTACT_TYPE_BADGE_CLASSES[known];
  return (
    <Badge variant="outline" className={cn(cls, className)}>
      {label}
    </Badge>
  );
}
