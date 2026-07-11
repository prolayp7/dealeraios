"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  Bot,
  Brain,
  LayoutGrid,
  Menu,
  MessageCircle,
  Package,
  Phone,
  ScanSearch,
  Settings,
  Share2,
  ShoppingCart,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  showBadge?: boolean;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const navGroups: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { href: "/dashboard", label: "Command Center", icon: LayoutGrid },
      { href: "/ai-gm", label: "AI GM", icon: Bot },
      { href: "/reports", label: "Reports", icon: BarChart3 },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/inventory", label: "Inventory", icon: Package },
      { href: "/ai-appraiser", label: "AI Appraiser", icon: ScanSearch },
      { href: "/list-everywhere", label: "List Everywhere", icon: Share2 },
      { href: "/acquisition", label: "Acquisition", icon: ShoppingCart },
      { href: "/ai-entry", label: "AI Entry", icon: Sparkles },
    ],
  },
  {
    label: "Sales & Cash",
    items: [
      { href: "/sales-command", label: "Sales Command", icon: Phone },
      { href: "/customers", label: "Lead CRM", icon: Users },
      { href: "/cashflow", label: "Cashflow", icon: Wallet },
      {
        href: "/messenger",
        label: "Messenger",
        icon: MessageCircle,
        showBadge: true,
      },
    ],
  },
  {
    label: "Market",
    items: [
      { href: "/market-intel", label: "Market Intel", icon: TrendingUp },
      { href: "/market-search", label: "Market Pulse", icon: Activity },
      { href: "/logic-engine", label: "Logic Engine", icon: Brain },
    ],
  },
  {
    label: "System",
    items: [{ href: "/settings", label: "Settings", icon: Settings }],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const loadUnread = () => {
      fetch("/api/messenger/unread")
        .then((r) => r.json())
        .then((data) => setUnreadCount(data.unread_count ?? 0))
        .catch(() => setUnreadCount(0));
    };

    loadUnread();
    const interval = setInterval(loadUnread, 60000);
    return () => clearInterval(interval);
  }, [pathname]);

  const navContent = (
    <>
      <nav className="flex-1 space-y-6 overflow-y-auto p-4">
        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              {group.label}
            </p>
            <div className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive =
                  pathname === item.href ||
                  pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-blue-500/10 text-blue-400"
                        : "text-slate-400 hover:bg-slate-800/60 hover:text-white"
                    )}
                  >
                    <Icon className="h-[18px] w-[18px]" />
                    <span className="flex-1">{item.label}</span>
                    {item.showBadge && unreadCount > 0 && (
                      <span className="rounded-full bg-blue-500 px-2 py-0.5 text-xs font-bold text-white">
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-slate-800/60 p-4">
        <p className="text-xs text-slate-500">CEO DESK · Dealership OS</p>
      </div>
    </>
  );

  return (
    <>
      <div className="fixed left-0 top-0 z-40 flex h-14 w-full items-center border-b border-slate-800/60 bg-navy-dark px-4 lg:hidden">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
        <span className="ml-3 font-bold text-white">CEO Desk</span>
        {unreadCount > 0 && (
          <span className="ml-auto rounded-full bg-blue-500 px-2 py-0.5 text-xs font-bold text-white">
            {unreadCount}
          </span>
        )}
      </div>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed left-0 top-14 z-40 flex h-[calc(100vh-3.5rem)] w-64 flex-col bg-navy-dark transition-transform lg:top-20 lg:h-[calc(100vh-5rem)] lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {navContent}
      </aside>
    </>
  );
}
