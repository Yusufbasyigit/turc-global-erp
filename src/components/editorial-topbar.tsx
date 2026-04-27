"use client";

import { usePathname } from "next/navigation";

const PATH_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/contacts": "Contacts",
  "/products": "Products",
  "/orders": "Orders",
  "/shipments": "Shipments",
  "/treasury": "Treasury",
  "/profit-loss": "Profit & Loss",
  "/transactions": "Transactions",
  "/accounts": "Accounts",
  "/partners": "Partners",
  "/tax": "Tax",
  "/settings": "Settings",
};

function titleFromPath(pathname: string): string {
  if (PATH_TITLES[pathname]) return PATH_TITLES[pathname];
  // Match the longest known prefix.
  const segments = pathname.split("/").filter(Boolean);
  for (let i = segments.length; i > 0; i -= 1) {
    const prefix = "/" + segments.slice(0, i).join("/");
    if (PATH_TITLES[prefix]) return PATH_TITLES[prefix];
  }
  const first = segments[0] ?? "";
  return first ? first.charAt(0).toUpperCase() + first.slice(1) : "";
}

export function EditorialTopbar() {
  const pathname = usePathname() ?? "/";
  const title = titleFromPath(pathname);

  return (
    <div className="flex items-center gap-3 w-full">
      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-1.5 text-[12px] text-muted-foreground"
      >
        <span>Turc Global</span>
        <span aria-hidden="true">·</span>
        <span className="font-semibold text-foreground">{title}</span>
      </nav>

      <div className="flex-1" />

      <div
        className="editorial-mono text-[11px] text-muted-foreground tracking-[0.06em]"
        aria-hidden="true"
      >
        VOL. III · NO. 115
      </div>
    </div>
  );
}
