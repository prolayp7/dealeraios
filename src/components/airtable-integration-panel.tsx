"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ColumnMappingEditor } from "@/components/column-mapping-editor";
import type { ColumnMapping } from "@/lib/import-column-mapper";
import type { AirtableConfig } from "@/lib/types";

export function AirtableIntegrationPanel({
  config,
  onConfigSaved,
}: {
  config: AirtableConfig;
  onConfigSaved: () => void;
}) {
  const [pat, setPat] = useState("");
  const [baseId, setBaseId] = useState(config.base_id);
  const [tableName, setTableName] = useState(config.table_name);
  const [lastModifiedField, setLastModifiedField] = useState(config.last_modified_field);
  const [fieldNames, setFieldNames] = useState<string[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>(config.column_mapping);
  const [previewing, setPreviewing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handlePreview = async () => {
    setPreviewing(true);
    setError(null);
    setMessage(null);
    setFieldNames([]);
    setMapping({});
    try {
      const res = await fetch("/api/airtable/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personalAccessToken: pat, baseId, tableName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Preview failed");
      setFieldNames(data.fieldNames);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setPreviewing(false);
    }
  };

  const handleImport = async () => {
    setImporting(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/airtable/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personalAccessToken: pat,
          baseId,
          tableName,
          lastModifiedField,
          columnMapping: mapping,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");
      setMessage(
        `Imported ${data.imported} vehicles.` +
          (data.errors?.length
            ? ` ${data.errors.length} record(s) failed — see server logs.`
            : " Sync enabled.")
      );
      onConfigSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  };

  const handleSyncNow = async () => {
    setSyncing(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/airtable-sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sync failed");
      setMessage(
        `Synced: ${data.created} created, ${data.updated} updated, ${data.pushedToAirtable} pushed to Airtable.` +
          (data.errors.length ? ` ${data.errors.length} error(s) — see server logs.` : "")
      );
      onConfigSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  if (config.enabled) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-slate-400">
          Connected to base <span className="text-slate-200">{config.base_id}</span>, table{" "}
          <span className="text-slate-200">{config.table_name}</span>.
        </p>
        <p className="text-sm text-slate-400">
          Last synced:{" "}
          {config.last_synced_at ? new Date(config.last_synced_at).toLocaleString() : "never"}
        </p>
        {config.last_sync_error && (
          <p className="text-sm text-red-400">Last sync error: {config.last_sync_error}</p>
        )}
        <Button onClick={handleSyncNow} disabled={syncing}>
          {syncing ? "Syncing..." : "Sync Now"}
        </Button>
        {message && <p className="text-sm text-emerald-400">{message}</p>}
        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="airtable-pat">Personal Access Token</Label>
          <Input id="airtable-pat" type="password" value={pat} onChange={(e) => setPat(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="airtable-base">Base ID</Label>
          <Input id="airtable-base" value={baseId} onChange={(e) => setBaseId(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="airtable-table">Table Name</Label>
          <Input id="airtable-table" value={tableName} onChange={(e) => setTableName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="airtable-last-modified">Last Modified field name</Label>
          <Input
            id="airtable-last-modified"
            value={lastModifiedField}
            onChange={(e) => setLastModifiedField(e.target.value)}
          />
        </div>
      </div>

      <Button onClick={handlePreview} disabled={previewing || !pat || !baseId || !tableName}>
        {previewing ? "Loading..." : "Preview"}
      </Button>

      {fieldNames.length > 0 && (
        <>
          <ColumnMappingEditor availableColumns={fieldNames} mapping={mapping} onChange={setMapping} />
          <Button onClick={handleImport} disabled={importing}>
            {importing ? "Importing..." : "Import & Enable Sync"}
          </Button>
        </>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}
      {message && <p className="text-sm text-emerald-400">{message}</p>}
    </div>
  );
}
