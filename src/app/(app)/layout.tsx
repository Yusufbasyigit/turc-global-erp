import { redirect } from "next/navigation";
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSidebar } from "@/components/app-sidebar";
import { createClient } from "@/lib/supabase/server";
import { AUTH_DISABLED, DEV_USER_EMAIL } from "@/lib/auth-mode";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let userEmail = DEV_USER_EMAIL;

  if (!AUTH_DISABLED) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) redirect("/login");
    userEmail = user.email ?? "";
  }

  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar userEmail={userEmail} />
        <SidebarInset>
          <div className="flex-1 p-6">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
