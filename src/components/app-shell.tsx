import { HeaderProvider, TopBar } from "@/components/header";
import { Sidebar } from "@/components/sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
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
