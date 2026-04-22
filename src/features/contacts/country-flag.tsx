import { cn } from "@/lib/utils";

type CountryInfo = {
  code?: string | null;
  name_en?: string | null;
  flag_emoji?: string | null;
};

export function CountryFlag({
  country,
  showName = true,
  className,
}: {
  country: CountryInfo | null | undefined;
  showName?: boolean;
  className?: string;
}) {
  if (!country || !country.code) {
    return (
      <span className={cn("text-muted-foreground text-sm", className)}>—</span>
    );
  }
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span aria-hidden="true" className="text-base leading-none">
        {country.flag_emoji ?? "🏳️"}
      </span>
      {showName ? (
        <span className="text-sm">
          {country.name_en ?? country.code}
        </span>
      ) : null}
    </span>
  );
}
