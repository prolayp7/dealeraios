"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

interface SafeMarketplaceAccount {
  id: string;
  label: string;
  platform: string;
  status: "pending" | "active" | "blocked" | "error";
  status_message: string | null;
  last_login_at: string | null;
  last_used_at: string | null;
  created_at: string;
}

function relativeTime(iso: string | null): string {
  if (!iso) return "never";
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function statusBadgeClass(status: SafeMarketplaceAccount["status"]): string {
  switch (status) {
    case "active":
      return "border-transparent bg-emerald-600 text-white";
    case "blocked":
      return "border-transparent bg-red-600 text-white";
    case "error":
      return "border-transparent bg-amber-600 text-white";
    default:
      return "border-transparent bg-slate-700 text-slate-100";
  }
}

export function MarketplaceAccountsPanel() {
  const [accounts, setAccounts] = useState<SafeMarketplaceAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [cookiesJson, setCookiesJson] = useState("");
  const [multiloginProfileId, setMultiloginProfileId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/marketplace-accounts")
      .then((res) => res.json())
      .then((data) => setAccounts(Array.isArray(data) ? data : []))
      .catch(() => setError("Failed to load marketplace accounts"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const resetForm = () => {
    setEditingId(null);
    setLabel("");
    setCookiesJson("");
    setMultiloginProfileId("");
  };

  const startEdit = (account: SafeMarketplaceAccount) => {
    setEditingId(account.id);
    setLabel(account.label);
    setCookiesJson(""); // write-only — never pre-filled from the server
    setError(null);
  };

  const handleAdd = async () => {
    setError(null);
    setSubmitting(true);
    try {
      let cookies: unknown;
      try {
        cookies = JSON.parse(cookiesJson);
      } catch {
        setError("Cookies must be valid JSON (paste the browser-exported array)");
        return;
      }

      const res = await fetch("/api/marketplace-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label,
          cookies,
          ...(multiloginProfileId.trim() ? { multiloginProfileId: multiloginProfileId.trim() } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add account");

      resetForm();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add account");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    setError(null);
    setSubmitting(true);
    try {
      const body: { label: string; cookies?: unknown } = { label };
      if (cookiesJson.trim()) {
        try {
          body.cookies = JSON.parse(cookiesJson);
        } catch {
          setError("Cookies must be valid JSON (paste the browser-exported array)");
          return;
        }
      }

      const res = await fetch(`/api/marketplace-accounts/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save account");

      resetForm();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save account");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetry = async (id: string) => {
    setError(null);
    setRetryingId(id);
    try {
      const res = await fetch(`/api/marketplace-accounts/${id}/login`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Retry failed");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Retry failed");
    } finally {
      setRetryingId(null);
    }
  };

  const handleRemove = async (id: string) => {
    setError(null);
    try {
      const res = await fetch(`/api/marketplace-accounts/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to remove account");
      }
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove account");
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">
        Add unlimited Facebook accounts. One server posts to each sequentially.
      </p>

      <div className="space-y-2 rounded-md border border-slate-800 p-4">
        <div>
          <Label htmlFor="account-label">Label</Label>
          <Input
            id="account-label"
            placeholder="e.g. 23 Motorsports — Main"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="account-cookies">
            Cookies (browser-exported JSON array)
            {editingId && " — leave blank to keep the current session"}
          </Label>
          <Textarea
            id="account-cookies"
            placeholder='[{"name":"c_user","value":"...","domain":".facebook.com","path":"/"}, ...]'
            value={cookiesJson}
            onChange={(e) => setCookiesJson(e.target.value)}
            rows={4}
          />
        </div>
        {!editingId && (
          <div>
            <Label htmlFor="account-profile-id">
              Existing Multilogin Profile ID (optional)
            </Label>
            <Input
              id="account-profile-id"
              placeholder="Leave blank to auto-create — or paste an ID from a profile you made in the Multilogin app"
              value={multiloginProfileId}
              onChange={(e) => setMultiloginProfileId(e.target.value)}
            />
          </div>
        )}
        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="flex gap-2">
          {editingId ? (
            <>
              <Button onClick={handleSaveEdit} disabled={submitting || !label.trim()}>
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
              <Button variant="outline" onClick={resetForm} disabled={submitting}>
                Cancel
              </Button>
            </>
          ) : (
            <Button onClick={handleAdd} disabled={submitting || !label.trim() || !cookiesJson.trim()}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Logging in… this can take up to a minute
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" /> Add Account
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      <div className="divide-y divide-slate-800">
        {loading && <p className="py-3 text-sm text-slate-500">Loading accounts...</p>}
        {!loading && accounts.length === 0 && (
          <p className="py-3 text-sm text-slate-500">No accounts added yet.</p>
        )}
        {accounts.map((account) => (
          <div key={account.id} className="flex items-center justify-between py-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-200">{account.label}</span>
                <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusBadgeClass(account.status)}`}>
                  {account.status}
                </span>
              </div>
              {account.status_message && (
                <p className="text-xs text-slate-500">{account.status_message}</p>
              )}
              <p className="text-xs text-slate-600">used {relativeTime(account.last_used_at)}</p>
            </div>
            <div className="flex items-center gap-2">
              {(account.status === "blocked" || account.status === "error") && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRetry(account.id)}
                  disabled={retryingId === account.id}
                >
                  {retryingId === account.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    "Retry"
                  )}
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => startEdit(account)}>
                Edit
              </Button>
              <button onClick={() => handleRemove(account.id)}>
                <X className="h-4 w-4 text-slate-500 hover:text-red-400" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
