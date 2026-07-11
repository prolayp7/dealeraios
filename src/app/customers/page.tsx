"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { ConversationSummary, Customer, Tag } from "@/lib/types";

const HOT_LEAD_TAG_NAME = "Hot Lead";

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTagInputs, setNewTagInputs] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/customers").then((r) => r.json()),
      fetch("/api/messenger/conversations").then((r) => r.json()),
      fetch("/api/tags").then((r) => r.json()),
    ])
      .then(([customerData, conversationData, tagData]) => {
        if (Array.isArray(customerData)) setCustomers(customerData);
        if (Array.isArray(conversationData)) setConversations(conversationData);
        if (Array.isArray(tagData)) setAllTags(tagData);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const conversationByCustomerId = useMemo(
    () => new Map(conversations.map((c) => [c.customer.id, c])),
    [conversations]
  );

  const sortedCustomers = useMemo(() => {
    const isHotLead = (c: Customer) =>
      (c.tags ?? []).some((t) => t.name === HOT_LEAD_TAG_NAME);

    return [...customers].sort((a, b) => {
      const aHot = isHotLead(a) ? 1 : 0;
      const bHot = isHotLead(b) ? 1 : 0;
      if (aHot !== bHot) return bHot - aHot;

      const aTime = conversationByCustomerId.get(a.id)?.last_message_at;
      const bTime = conversationByCustomerId.get(b.id)?.last_message_at;
      return (bTime ? new Date(bTime).getTime() : 0) - (aTime ? new Date(aTime).getTime() : 0);
    });
  }, [customers, conversationByCustomerId]);

  const addTag = async (customerId: string, tagName: string) => {
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

    await fetch(`/api/customers/${customerId}/tags`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tag_id: tag.id }),
    });

    setNewTagInputs((prev) => ({ ...prev, [customerId]: "" }));
    load();
  };

  const removeTag = async (customerId: string, tagId: string) => {
    await fetch(`/api/customers/${customerId}/tags?tag_id=${tagId}`, {
      method: "DELETE",
    });
    load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold text-white">
          <Users className="h-8 w-8 text-orange-500" />
          Lead CRM
        </h1>
        <p className="mt-1 text-slate-400">
          Unlimited custom tags. Hot Lead-tagged conversations always sort first.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading leads...</p>
      ) : sortedCustomers.length === 0 ? (
        <p className="text-sm text-slate-500">No leads yet.</p>
      ) : (
        <div className="space-y-3">
          {sortedCustomers.map((customer) => {
            const conversation = conversationByCustomerId.get(customer.id);
            return (
              <Card key={customer.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/customers/${customer.id}`}
                      className="font-medium text-slate-100 hover:underline"
                    >
                      {customer.name ?? "Unknown"}
                    </Link>
                    {conversation?.last_message && (
                      <p className="truncate text-sm text-slate-500">
                        {conversation.last_message}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {(customer.tags ?? []).map((tag) => (
                      <Badge
                        key={tag.id}
                        variant={tag.name === HOT_LEAD_TAG_NAME ? "urgent" : "secondary"}
                        className="cursor-pointer"
                        onClick={() => removeTag(customer.id, tag.id)}
                        title="Click to remove"
                      >
                        {tag.name} ×
                      </Badge>
                    ))}
                    {conversation && conversation.unread_count > 0 && (
                      <Badge variant="default">{conversation.unread_count} unread</Badge>
                    )}
                    <Input
                      placeholder="Add tag..."
                      value={newTagInputs[customer.id] ?? ""}
                      onChange={(e) =>
                        setNewTagInputs((prev) => ({ ...prev, [customer.id]: e.target.value }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addTag(customer.id, newTagInputs[customer.id] ?? "");
                        }
                      }}
                      list={`tag-options-${customer.id}`}
                      className="h-8 w-32 text-xs"
                    />
                    <datalist id={`tag-options-${customer.id}`}>
                      {allTags.map((t) => (
                        <option key={t.id} value={t.name} />
                      ))}
                    </datalist>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
