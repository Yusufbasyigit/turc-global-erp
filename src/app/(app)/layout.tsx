import { redirect } from "next/navigation";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
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
          <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background/80 backdrop-blur px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="h-4" />
            <span className="text-sm text-muted-foreground">Turc Global ERP</span>
          </header>
          <div className="flex-1 p-6">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
