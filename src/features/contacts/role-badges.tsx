import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  CONTACT_ROLE_BADGE_CLASSES,
  CONTACT_ROLE_LABELS,
} from "@/lib/constants";
import { rolesOf, type ContactRole } from "@/lib/supabase/types";

type ContactLike = {
  is_customer: boolean;
  is_supplier: boolean;
  is_logistics: boolean;
  is_real_estate: boolean;
  is_other: boolean;
};

export function ContactRoleBadges({
  contact,
  className,
}: {
  contact: ContactLike;
  className?: string;
}) {
  const roles = rolesOf(contact);
  if (roles.length === 0) {
    return (
      <Badge variant="outline" className={cn("text-muted-foreground", className)}>
        Untyped
      </Badge>
    );
  }
  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      {roles.map((role) => (
        <RoleBadge key={role} role={role} />
      ))}
    </div>
  );
}

export function RoleBadge({
  role,
  className,
}: {
  role: ContactRole;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(CONTACT_ROLE_BADGE_CLASSES[role], className)}
    >
      {CONTACT_ROLE_LABELS[role]}
    </Badge>
  );
}
