"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Users,
  Package,
  ClipboardList,
  Ship,
  ArrowLeftRight,
  Wallet,
  HandCoins,
  TrendingUp,
  LineChart,
  Building2,
  Settings,
  PanelLeftClose,
  type LucideIcon,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { UserMenu } from "@/components/user-menu";

type NavItem = { title: string; href: string; icon: LucideIcon };
type NavGroup = { label: string; items: NavItem[] };

const groups: NavGroup[] = [
  {
    label: "Operations",
    items: [
      { title: "Contacts", href: "/contacts", icon: Users },
      { title: "Products", href: "/products", icon: Package },
      { title: "Orders", href: "/orders", icon: ClipboardList },
      { title: "Shipments", href: "/shipments", icon: Ship },
    ],
  },
  {
    label: "Finance",
    items: [
      { title: "Treasury", href: "/treasury", icon: TrendingUp },
      { title: "Real Estate", href: "/real-estate", icon: Building2 },
      { title: "Profit & Loss", href: "/profit-loss", icon: LineChart },
      { title: "Transactions", href: "/transactions", icon: ArrowLeftRight },
      { title: "Accounts", href: "/accounts", icon: Wallet },
      { title: "Partners", href: "/partners", icon: HandCoins },
    ],
  },
];

const settingsItem: NavItem = {
  title: "Settings",
  href: "/settings",
  icon: Settings,
};

export function AppSidebar({ userEmail }: { userEmail: string }) {
  const pathname = usePathname();
  const { toggleSidebar } = useSidebar();
  const isActive = (href: string) =>
    pathname === href || pathname?.startsWith(`${href}/`);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center gap-2 p-2 group-data-[collapsible=icon]:p-0">
              <Image
                src="/just-tg.png"
                alt="Turc Global"
                width={128}
                height={128}
                className="size-8 shrink-0 object-contain"
                priority
              />
              <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                <span className="truncate font-semibold">Turc Global</span>
                <span className="truncate text-xs text-muted-foreground">
                  ERP
                </span>
              </div>
              <button
                type="button"
                onClick={toggleSidebar}
                className="ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors group-data-[collapsible=icon]:hidden"
                aria-label="Collapse sidebar"
              >
                <PanelLeftClose className="h-4 w-4" />
              </button>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {groups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.href)}
                      tooltip={item.title}
                    >
                      <Link href={item.href}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}

        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive(settingsItem.href)}
                  tooltip={settingsItem.title}
                >
                  <Link href={settingsItem.href}>
                    <settingsItem.icon />
                    <span>{settingsItem.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <UserMenu email={userEmail} />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
