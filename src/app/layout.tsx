import type { Metadata } from "next";
import "./globals.css";
import { SidebarInset, SidebarLayout, SidebarProvider } from "@decocms/ui/components/sidebar";
import { Toaster } from "@decocms/ui/components/sonner";
import { TooltipProvider } from "@decocms/ui/components/tooltip";
import { AppSidebar } from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "Build in Public · deco",
  description: "Avalie, organize e agende seus posts de LinkedIn.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className="h-dvh bg-sidebar antialiased">
        <TooltipProvider delayDuration={300}>
          <SidebarProvider defaultOpen>
            <SidebarLayout>
              <AppSidebar />
              <SidebarInset className="overflow-y-auto md:max-h-[calc(100dvh-1rem)]">{children}</SidebarInset>
            </SidebarLayout>
          </SidebarProvider>
          <Toaster />
        </TooltipProvider>
      </body>
    </html>
  );
}
