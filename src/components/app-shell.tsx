"use client";

import { usePathname } from "next/navigation";
import { HeaderProvider, TopBar } from "@/components/header";
import { Sidebar } from "@/components/sidebar";

const CHROMELESS_PREFIXES = ["/login", "/signup", "/auth"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isChromeless = CHROMELESS_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  if (isChromeless) {
    return <div className="min-h-screen bg-background">{children}</div>;
  }

  return (
    <HeaderProvider>
      <div className="min-h-screen bg-background">
        <TopBar />
        <Sidebar />
        <main className="pt-14 lg:pl-64 lg:pt-20">
          <div className="min-h-screen px-4 pb-8 pt-6 lg:px-8 lg:pt-8">
            {children}
          </div>
        </main>
      </div>
    </HeaderProvider>
  );
}
