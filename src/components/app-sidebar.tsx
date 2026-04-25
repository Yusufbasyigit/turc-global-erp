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
  Receipt,
  TrendingUp,
  Settings,
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
      { title: "Transactions", href: "/transactions", icon: ArrowLeftRight },
      { title: "Accounts", href: "/accounts", icon: Wallet },
      { title: "Partners", href: "/partners", icon: HandCoins },
      { title: "Tax", href: "/tax", icon: Receipt },
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
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="hover:bg-transparent active:bg-transparent"
            >
              <Image
                src="/tg-logo-white.png"
                alt="Turc Global"
                width={800}
                height={168}
                className="h-8 w-auto object-contain"
                priority
              />
            </SidebarMenuButton>
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
