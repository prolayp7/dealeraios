"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Bell, Calendar, ChevronDown, Filter, LogOut } from "lucide-react";
import { useLogout } from "@/hooks/use-logout";

interface HeaderConfig {
  title: string;
  subtitle?: string;
  notificationCount?: number;
  userInitial?: string;
}

const DEFAULT_CONFIG: HeaderConfig = { title: "CEO Desk" };

const HeaderContext = createContext<{
  config: HeaderConfig;
  setConfig: (config: HeaderConfig) => void;
} | null>(null);

export function HeaderProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<HeaderConfig>(DEFAULT_CONFIG);
  const value = useMemo(() => ({ config, setConfig }), [config]);
  return (
    <HeaderContext.Provider value={value}>{children}</HeaderContext.Provider>
  );
}

/** Lets a page set the shared top bar's title/subtitle/notification count. */
export function usePageHeader(config: HeaderConfig) {
  const setConfig = useContext(HeaderContext)?.setConfig;
  const { title, subtitle, notificationCount, userInitial } = config;

  useEffect(() => {
    setConfig?.({ title, subtitle, notificationCount, userInitial });
    return () => setConfig?.(DEFAULT_CONFIG);
  }, [setConfig, title, subtitle, notificationCount, userInitial]);
}

function UserMenu({ userInitial }: { userInitial?: string }) {
  const [open, setOpen] = useState(false);
  const { logout, loggingOut } = useLogout();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Account menu"
        aria-expanded={open}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-sm font-semibold text-white transition-opacity hover:opacity-90"
      >
        {userInitial ?? "D"}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-40 overflow-hidden rounded-lg border border-slate-800 bg-navy-dark shadow-lg">
          <button
            onClick={logout}
            disabled={loggingOut}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-200 transition-colors hover:bg-slate-800 disabled:opacity-60"
          >
            <LogOut className="h-4 w-4 text-slate-400" />
            {loggingOut ? "Logging out..." : "Log out"}
          </button>
        </div>
      )}
    </div>
  );
}

export function TopBar() {
  const ctx = useContext(HeaderContext);
  const config = ctx?.config ?? DEFAULT_CONFIG;

  const today = useMemo(() => new Date(), []);
  const longDate =
    config.subtitle ??
    `CEO Mode · ${today.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    })}`;
  const shortDate = today.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="fixed inset-x-0 top-0 z-50 hidden h-20 border-b border-slate-800/60 bg-navy-dark lg:flex">
      <div className="flex w-64 shrink-0 items-center gap-3 px-5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-sm font-bold text-white">
          CD
        </div>
        <div>
          <h1 className="text-sm font-bold leading-tight text-white">
            CEO DESK
          </h1>
          <p className="text-xs leading-tight text-slate-500">
            Dealership Operating System
          </p>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-between px-8">
        <div>
          <h2 className="text-2xl font-bold text-white">{config.title}</h2>
          <p className="mt-1 text-sm text-slate-400">{longDate}</p>
        </div>

        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-200 transition-colors hover:bg-slate-800">
            <Calendar className="h-4 w-4 text-slate-400" />
            {shortDate}
            <ChevronDown className="h-4 w-4 text-slate-500" />
          </button>

          <button className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-200 transition-colors hover:bg-slate-800">
            <Filter className="h-4 w-4 text-slate-400" />
            Filters
          </button>

          <button
            className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-slate-800 bg-slate-900/60 text-slate-300 transition-colors hover:bg-slate-800"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
            {!!config.notificationCount && config.notificationCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                {config.notificationCount > 9 ? "9+" : config.notificationCount}
              </span>
            )}
          </button>

          <UserMenu userInitial={config.userInitial} />
        </div>
      </div>
    </div>
  );
}
