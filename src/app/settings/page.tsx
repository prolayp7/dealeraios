"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface Profile {
  id: string;
  email: string;
  role: "admin" | "staff";
  full_name: string | null;
  created_at: string;
}

// Only the Users section is built today. The other nine sections (Company, AI
// Settings, Automation, Notifications, Integrations, API Keys, Billing,
// Security, Marketplace Accounts) land later this sprint.
export default function SettingsPage() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadUsers = useCallback(() => {
    setLoading(true);
    fetch("/api/auth/invite")
      .then((res) => res.json().then((data) => ({ res, data })))
      .then(({ res, data }) => {
        if (!res.ok) throw new Error(data.error || "Failed to load users");
        setUsers(Array.isArray(data) ? data : []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load users"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-100">Settings</h1>
        <p className="text-sm text-slate-400">Manage your dealership's team access.</p>
      </div>

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
            {loading && <p className="py-3 text-sm text-slate-500">Loading users...</p>}
            {!loading && users.length === 0 && (
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
    </div>
  );
}
