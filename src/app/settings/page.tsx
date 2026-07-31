"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Plus, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { LISTING_TEMPLATES } from "@/lib/listing-templates";
import { DEFAULT_AIRTABLE_CONFIG } from "@/lib/airtable-config";
import { AirtableIntegrationPanel } from "@/components/airtable-integration-panel";
import { AirtableBaseExplorer } from "@/components/airtable-base-explorer";
import type { DealershipSettings, MarketplaceAccount } from "@/lib/types";

interface Profile {
  id: string;
  email: string;
  role: "admin" | "staff";
  full_name: string | null;
  created_at: string;
}

const TABS = [
  "Company",
  "Users",
  "Marketplace Accounts",
  "AI Settings",
  "Automation",
  "Notifications",
  "Integrations",
  "API Keys",
  "Billing",
  "Security",
] as const;

type Tab = (typeof TABS)[number];

// Company, Users, Marketplace Accounts, and AI Settings are fully built —
// the remaining six ship as "coming soon" per the sprint's own cut-order,
// which explicitly lists Settings as the section to trim first if behind.
const STUB_TABS = new Set<Tab>([
  "Automation",
  "Notifications",
  "API Keys",
  "Billing",
  "Security",
]);

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("Company");
  const [settings, setSettings] = useState<DealershipSettings | null>(null);
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [companyName, setCompanyName] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");
  const [inactivityHours, setInactivityHours] = useState(48);
  const [defaultTemplate, setDefaultTemplate] = useState("marketplace");
  const [newAccountLabel, setNewAccountLabel] = useState("");

  const loadUsers = useCallback(() => {
    fetch("/api/auth/invite")
      .then((res) => res.json().then((data) => ({ res, data })))
      .then(({ res, data }) => {
        if (!res.ok) throw new Error(data.error || "Failed to load users");
        setUsers(Array.isArray(data) ? data : []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load users"));
  }, []);

  const loadSettings = useCallback(() => {
    setLoading(true);
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data: DealershipSettings) => {
        setSettings(data);
        setCompanyName(data.company?.name ?? "");
        setCompanyAddress(data.company?.address ?? "");
        setCompanyPhone(data.company?.phone ?? "");
        setInactivityHours(data.inactivity_threshold_hours ?? 48);
        setDefaultTemplate(data.ai_settings?.default_listing_template ?? "marketplace");
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    loadUsers();
    loadSettings();
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => setIsAdmin(data.role === "admin"))
      .catch(() => setIsAdmin(false));
  }, [loadUsers, loadSettings]);

  async function handleInvite(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setInviting(true);

    const res = await fetch("/api/auth/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: inviteEmail }),
    });
    const body = await res.json();

    setInviting(false);

    if (!res.ok) {
      setError(body.error ?? "Failed to send invite");
      return;
    }

    setMessage(`Invite sent to ${inviteEmail}`);
    setInviteEmail("");
    loadUsers();
  }

  async function saveSettings(patch: Partial<DealershipSettings>) {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (res.ok) setSettings(data);
    } finally {
      setSaving(false);
    }
  }

  const saveCompany = () =>
    saveSettings({
      company: { name: companyName, address: companyAddress, phone: companyPhone },
    });

  const saveInactivity = () =>
    saveSettings({ inactivity_threshold_hours: inactivityHours });

  const saveAiSettings = (template: string) => {
    setDefaultTemplate(template);
    saveSettings({ ai_settings: { default_listing_template: template } });
  };

  const addMarketplaceAccount = () => {
    if (!newAccountLabel.trim() || !settings) return;
    const account: MarketplaceAccount = {
      id: crypto.randomUUID(),
      platform: "facebook",
      label: newAccountLabel.trim(),
    };
    const next = [...(settings.marketplace_accounts ?? []), account];
    setNewAccountLabel("");
    saveSettings({ marketplace_accounts: next });
  };

  const removeMarketplaceAccount = (id: string) => {
    if (!settings) return;
    const next = (settings.marketplace_accounts ?? []).filter((a) => a.id !== id);
    saveSettings({ marketplace_accounts: next });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-100">Settings</h1>
        <p className="text-sm text-slate-400">Manage your dealership's configuration.</p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-3">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              activeTab === tab
                ? "bg-orange-500 text-white"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "Company" && (
        <Card>
          <CardHeader>
            <CardTitle>Company</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="company-name">Dealership Name</Label>
              <Input id="company-name" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="company-address">Address</Label>
              <Input id="company-address" value={companyAddress} onChange={(e) => setCompanyAddress(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="company-phone">Phone</Label>
              <Input id="company-phone" value={companyPhone} onChange={(e) => setCompanyPhone(e.target.value)} />
            </div>
            <Button onClick={saveCompany} disabled={saving}>
              {saving ? "Saving..." : "Save Company Info"}
            </Button>
          </CardContent>
        </Card>
      )}

      {activeTab === "Users" && (
        <Card>
          <CardHeader>
            <CardTitle>Users</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={handleInvite} className="flex gap-2">
              <Input
                type="email"
                placeholder="staff@dealership.com"
                required
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
              <Button type="submit" disabled={inviting}>
                <UserPlus className="mr-2 h-4 w-4" />
                {inviting ? "Sending..." : "Invite"}
              </Button>
            </form>
            {error && <p className="text-sm text-red-400">{error}</p>}
            {message && <p className="text-sm text-emerald-400">{message}</p>}

            <div className="divide-y divide-slate-800">
              {users.length === 0 && (
                <p className="py-3 text-sm text-slate-500">No users yet.</p>
              )}
              {users.map((user) => (
                <div key={user.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm text-slate-100">{user.full_name || user.email}</p>
                    <p className="text-xs text-slate-500">{user.email}</p>
                  </div>
                  <Badge variant="secondary" className="uppercase">
                    {user.role}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === "Marketplace Accounts" && (
        <Card>
          <CardHeader>
            <CardTitle>Marketplace Accounts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-400">
              Add unlimited Facebook accounts. One server posts to each sequentially.
            </p>
            <div className="flex gap-2">
              <Input
                placeholder="e.g. 23 Motorsports — Main"
                value={newAccountLabel}
                onChange={(e) => setNewAccountLabel(e.target.value)}
              />
              <Button onClick={addMarketplaceAccount} disabled={saving}>
                <Plus className="h-4 w-4" /> Add Account
              </Button>
            </div>
            <div className="divide-y divide-slate-800">
              {(settings?.marketplace_accounts ?? []).length === 0 && (
                <p className="py-3 text-sm text-slate-500">No accounts added yet.</p>
              )}
              {(settings?.marketplace_accounts ?? []).map((account) => (
                <div key={account.id} className="flex items-center justify-between py-2">
                  <span className="text-sm text-slate-200">{account.label}</span>
                  <button onClick={() => removeMarketplaceAccount(account.id)}>
                    <X className="h-4 w-4 text-slate-500 hover:text-red-400" />
                  </button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === "AI Settings" && (
        <Card>
          <CardHeader>
            <CardTitle>AI Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label htmlFor="default-template">Default Listing Template</Label>
              <select
                id="default-template"
                value={defaultTemplate}
                onChange={(e) => saveAiSettings(e.target.value)}
                className="flex h-10 w-full max-w-xs rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              >
                {LISTING_TEMPLATES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="inactivity-hours">
                Lead Inactivity Threshold (hours) — drives AI GM's follow-up flags
              </Label>
              <div className="flex gap-2">
                <Input
                  id="inactivity-hours"
                  type="number"
                  className="max-w-xs"
                  value={inactivityHours}
                  onChange={(e) => setInactivityHours(parseInt(e.target.value, 10) || 48)}
                />
                <Button onClick={saveInactivity} disabled={saving}>
                  Save
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === "Integrations" && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Integrations</CardTitle>
            </CardHeader>
            <CardContent>
              <AirtableIntegrationPanel
                config={settings?.airtable_config ?? DEFAULT_AIRTABLE_CONFIG}
                onConfigSaved={loadSettings}
              />
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Airtable Base Explorer</CardTitle>
              <p className="text-sm text-slate-500">
                Browse any table in your connected Airtable base, edit records inline, and
                {isAdmin ? " add new fields." : " (admins can also add new fields here)."}
              </p>
            </CardHeader>
            <CardContent>
              <AirtableBaseExplorer isAdmin={isAdmin} />
            </CardContent>
          </Card>
        </>
      )}

      {STUB_TABS.has(activeTab) && (
        <Card>
          <CardHeader>
            <CardTitle>{activeTab}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-500">Coming soon.</p>
          </CardContent>
        </Card>
      )}

      {loading && <p className="text-sm text-slate-500">Loading settings...</p>}
    </div>
  );
}
