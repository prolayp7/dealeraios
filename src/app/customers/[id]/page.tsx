"use client";

import { useEffect, useState, useCallback, type ReactNode } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ExternalLink, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Customer, CustomerInquiry, Message, Tag } from "@/lib/types";
import { getVehicleLabel } from "@/lib/vehicle-logic";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface InquiryWithVehicle extends CustomerInquiry {
  vehicles: {
    id: string;
    year: number | null;
    make: string | null;
    model: string | null;
    retail_price: number | null;
    status: string | null;
  } | null;
}

export default function CustomerDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inquiries, setInquiries] = useState<InquiryWithVehicle[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState("");
  const [newTagInput, setNewTagInput] = useState("");
  const [generatingFollowUp, setGeneratingFollowUp] = useState(false);
  const [followUpDraft, setFollowUpDraft] = useState<string | null>(null);
  const [followUpTemplate, setFollowUpTemplate] = useState("");

  useEffect(() => {
    setFollowUpTemplate(localStorage.getItem("dealer-follow-up-template") ?? "");
  }, []);

  const updateFollowUpTemplate = (value: string) => {
    setFollowUpTemplate(value);
    localStorage.setItem("dealer-follow-up-template", value);
  };

  const loadData = useCallback(() => {
    fetch(`/api/customers/${id}`)
      .then((res) => res.json().then((data) => ({ res, data })))
      .then(({ res, data }) => {
        if (!res.ok) throw new Error(data.error);
        setCustomer(data.customer);
        setMessages(data.messages ?? []);
        setInquiries(data.inquiries ?? []);
        setNotes(data.customer.notes ?? "");
      })
      .catch((err) => {
        console.error(err);
        setCustomer(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    fetch("/api/tags")
      .then((res) => res.json())
      .then((data) => Array.isArray(data) && setAllTags(data))
      .catch(console.error);
  }, []);

  const addTag = async (tagName: string) => {
    const trimmed = tagName.trim();
    if (!trimmed) return;

    let tag = allTags.find((t) => t.name.toLowerCase() === trimmed.toLowerCase());
    if (!tag) {
      const res = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      tag = await res.json();
      if (tag) setAllTags((prev) => [...prev, tag!]);
    }
    if (!tag) return;

    await fetch(`/api/customers/${id}/tags`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tag_id: tag.id }),
    });

    setNewTagInput("");
    loadData();
  };

  const removeTag = async (tagId: string) => {
    await fetch(`/api/customers/${id}/tags?tag_id=${tagId}`, { method: "DELETE" });
    loadData();
  };

  const generateFollowUp = async () => {
    setGeneratingFollowUp(true);
    setFollowUpDraft(null);
    try {
      const res = await fetch(`/api/customers/${id}/follow-up`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customTemplate: followUpTemplate || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate follow-up");
      setFollowUpDraft(data.message);
    } catch (err) {
      console.error(err);
    } finally {
      setGeneratingFollowUp(false);
    }
  };

  const handleSaveNotes = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/customers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      if (res.ok) {
        const updated = await res.json();
        setCustomer(updated);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-slate-400">Customer not found.</p>
        <Button variant="outline" asChild>
          <Link href="/messenger">Back to Messenger</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/messenger" className="text-slate-400 hover:text-white">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-white">
            {customer.name ?? "Customer"}
          </h1>
          <p className="mt-1 text-slate-400">
            Source: {customer.source ?? "unknown"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <ProfileRow label="Phone" value={customer.phone} />
            <ProfileRow label="Email" value={customer.email} />
            <ProfileRow
              label="Facebook"
              value={
                customer.fb_profile_url ? (
                  <a
                    href={customer.fb_profile_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-orange-500 hover:underline"
                  >
                    Profile <ExternalLink className="h-3 w-3" />
                  </a>
                ) : customer.fb_messenger_id ? (
                  <a
                    href={`https://www.messenger.com/t/${customer.fb_messenger_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-orange-500 hover:underline"
                  >
                    Messenger <ExternalLink className="h-3 w-3" />
                  </a>
                ) : null
              }
            />
            <div className="space-y-2 border-b border-slate-800 py-2">
              <span className="text-slate-400">Tags</span>
              <div className="flex flex-wrap items-center gap-2">
                {(customer.tags ?? []).map((tag) => (
                  <Badge
                    key={tag.id}
                    variant={tag.name === "Hot Lead" ? "urgent" : "secondary"}
                    className="cursor-pointer"
                    onClick={() => removeTag(tag.id)}
                    title="Click to remove"
                  >
                    {tag.name} ×
                  </Badge>
                ))}
                <Input
                  placeholder="Add tag..."
                  value={newTagInput}
                  onChange={(e) => setNewTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addTag(newTagInput);
                    }
                  }}
                  list="tag-options"
                  className="h-8 w-32 text-xs"
                />
                <datalist id="tag-options">
                  {allTags.map((t) => (
                    <option key={t.id} value={t.name} />
                  ))}
                </datalist>
              </div>
            </div>
            <div className="space-y-2 pt-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
              />
              <Button
                size="sm"
                onClick={handleSaveNotes}
                disabled={saving}
              >
                {saving ? "Saving..." : "Save Notes"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Vehicle Inquiries</CardTitle>
          </CardHeader>
          <CardContent>
            {inquiries.length === 0 ? (
              <p className="text-sm text-slate-400">
                No linked vehicle inquiries yet.
              </p>
            ) : (
              <ul className="space-y-3">
                {inquiries.map((inq) => (
                  <li
                    key={inq.id}
                    className="rounded-lg border border-slate-800 p-3"
                  >
                    {inq.vehicles ? (
                      <Link
                        href={`/inventory/${inq.vehicles.id}`}
                        className="font-medium text-orange-500 hover:underline"
                      >
                        {getVehicleLabel(inq.vehicles)}
                      </Link>
                    ) : (
                      <span className="text-slate-400">Unknown vehicle</span>
                    )}
                    {inq.vehicles?.retail_price != null && (
                      <p className="text-sm text-slate-400">
                        {formatCurrency(inq.vehicles.retail_price)} ·{" "}
                        {inq.vehicles.status}
                      </p>
                    )}
                    {inq.notes && (
                      <p className="mt-1 text-sm text-slate-500">{inq.notes}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Message History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-h-96 space-y-3 overflow-y-auto">
            {messages.length === 0 ? (
              <p className="text-center text-slate-400">No messages</p>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "flex",
                    msg.direction === "outbound"
                      ? "justify-end"
                      : "justify-start"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[80%] rounded-lg px-3 py-2 text-sm",
                      msg.direction === "outbound"
                        ? "bg-orange-500 text-white"
                        : "bg-slate-800 text-slate-100"
                    )}
                  >
                    <p>{msg.message}</p>
                    <p className="mt-1 text-xs opacity-70">
                      {new Date(msg.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-orange-500" />
            AI Follow-Up
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="follow-up-template">
              Dealer template (optional — saved in this browser for reuse)
            </Label>
            <Textarea
              id="follow-up-template"
              placeholder="e.g. Mention our end-of-month financing promo"
              value={followUpTemplate}
              onChange={(e) => updateFollowUpTemplate(e.target.value)}
              rows={2}
            />
          </div>
          <Button onClick={generateFollowUp} disabled={generatingFollowUp}>
            {generatingFollowUp ? "Generating..." : "Generate Follow-Up Message"}
          </Button>
          {followUpDraft && (
            <div className="rounded-lg border border-slate-700 bg-slate-950/50 p-3 text-sm text-slate-200">
              {followUpDraft}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ProfileRow({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex justify-between border-b border-slate-800 py-2">
      <span className="text-slate-400">{label}</span>
      <span className="text-right text-slate-200">{value ?? "—"}</span>
    </div>
  );
}
