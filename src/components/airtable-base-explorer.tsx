"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface AirtableTableField {
  id: string;
  name: string;
  type: string;
  options?: { choices?: { id: string; name: string }[] };
}

interface AirtableTable {
  id: string;
  name: string;
  fields: AirtableTableField[];
}

interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
  createdTime: string;
}

const CREATABLE_FIELD_TYPES: { value: string; label: string }[] = [
  { value: "singleLineText", label: "Single line text" },
  { value: "multilineText", label: "Long text" },
  { value: "number", label: "Number" },
  { value: "singleSelect", label: "Single select" },
  { value: "multipleSelects", label: "Multiple select" },
  { value: "checkbox", label: "Checkbox" },
  { value: "date", label: "Date" },
  { value: "currency", label: "Currency" },
  { value: "email", label: "Email" },
  { value: "url", label: "URL" },
  { value: "phoneNumber", label: "Phone" },
];

const SELECT_TYPES = new Set(["singleSelect", "multipleSelects"]);

// Airtable caps writes at 5 requests/sec per base. A user editing several
// cells in quick succession could burst past that, so outgoing PATCHes are
// chained through this promise instead of fired in parallel.
let writeQueue: Promise<unknown> = Promise.resolve();
function enqueueWrite<T>(task: () => Promise<T>): Promise<T> {
  const result = writeQueue.then(task, task);
  writeQueue = result.catch(() => undefined);
  return result;
}

export function AirtableBaseExplorer({ isAdmin }: { isAdmin: boolean }) {
  const [tables, setTables] = useState<AirtableTable[]>([]);
  const [selectedTableId, setSelectedTableId] = useState<string>("");
  const [records, setRecords] = useState<AirtableRecord[]>([]);
  const [nextOffset, setNextOffset] = useState<string | null>(null);
  const [loadingTables, setLoadingTables] = useState(true);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cellErrors, setCellErrors] = useState<Record<string, string>>({});

  const [addFieldOpen, setAddFieldOpen] = useState(false);
  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldType, setNewFieldType] = useState("singleLineText");
  const [newFieldChoices, setNewFieldChoices] = useState("");
  const [savingField, setSavingField] = useState(false);
  const [addingRecord, setAddingRecord] = useState(false);

  const selectedTable = tables.find((t) => t.id === selectedTableId) ?? null;

  const tableOptions: ComboboxOption[] = useMemo(
    () => tables.map((t) => ({ value: t.id, label: t.name })),
    [tables]
  );

  const loadTables = useCallback(async () => {
    setLoadingTables(true);
    setError(null);
    try {
      const res = await fetch("/api/airtable/base/tables");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load tables");
      setTables(data.tables ?? []);
      setSelectedTableId((current) => current || data.tables?.[0]?.id || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tables");
    } finally {
      setLoadingTables(false);
    }
  }, []);

  const loadRecords = useCallback(async (tableId: string, offset?: string) => {
    if (!tableId) return;
    setLoadingRecords(true);
    setError(null);
    try {
      const params = offset ? `?offset=${encodeURIComponent(offset)}` : "";
      const res = await fetch(`/api/airtable/base/tables/${tableId}/records${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load records");
      setRecords((prev) => (offset ? [...prev, ...data.records] : data.records));
      setNextOffset(data.offset ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load records");
    } finally {
      setLoadingRecords(false);
    }
  }, []);

  useEffect(() => {
    loadTables();
  }, [loadTables]);

  useEffect(() => {
    if (selectedTableId) {
      setRecords([]);
      setNextOffset(null);
      loadRecords(selectedTableId);
    }
  }, [selectedTableId, loadRecords]);

  const cellKey = (recordId: string, fieldName: string) => `${recordId}:${fieldName}`;

  const saveCell = (recordId: string, fieldName: string, value: unknown, previous: unknown) => {
    setRecords((prev) =>
      prev.map((r) => (r.id === recordId ? { ...r, fields: { ...r.fields, [fieldName]: value } } : r))
    );
    setCellErrors((prev) => {
      const next = { ...prev };
      delete next[cellKey(recordId, fieldName)];
      return next;
    });

    enqueueWrite(async () => {
      const res = await fetch(`/api/airtable/base/tables/${selectedTableId}/records/${recordId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: { [fieldName]: value } }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setRecords((prev) =>
          prev.map((r) =>
            r.id === recordId ? { ...r, fields: { ...r.fields, [fieldName]: previous } } : r
          )
        );
        setCellErrors((prev) => ({
          ...prev,
          [cellKey(recordId, fieldName)]: data.error || "Save failed",
        }));
      }
    });
  };

  const handleAddRecord = async () => {
    setAddingRecord(true);
    setError(null);
    try {
      const res = await fetch(`/api/airtable/base/tables/${selectedTableId}/records`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: {} }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add record");
      setRecords((prev) => [...prev, data.record]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add record");
    } finally {
      setAddingRecord(false);
    }
  };

  const handleAddField = async () => {
    if (!newFieldName.trim() || !selectedTableId) return;
    setSavingField(true);
    setError(null);
    try {
      const options = SELECT_TYPES.has(newFieldType)
        ? {
            choices: newFieldChoices
              .split(",")
              .map((c) => c.trim())
              .filter(Boolean)
              .map((name) => ({ name })),
          }
        : undefined;

      const res = await fetch(`/api/airtable/base/tables/${selectedTableId}/fields`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newFieldName.trim(), type: newFieldType, options }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add field");

      setTables((prev) =>
        prev.map((t) => (t.id === selectedTableId ? { ...t, fields: [...t.fields, data.field] } : t))
      );
      setAddFieldOpen(false);
      setNewFieldName("");
      setNewFieldChoices("");
      setNewFieldType("singleLineText");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add field");
    } finally {
      setSavingField(false);
    }
  };

  if (loadingTables) {
    return <p className="text-sm text-slate-400">Loading Airtable base…</p>;
  }

  if (error && tables.length === 0) {
    return <p className="text-sm text-red-400">{error}</p>;
  }

  if (tables.length === 0) {
    return (
      <p className="text-sm text-slate-400">
        Connect Airtable in the Integrations section above to browse your base here.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-64">
          <Label>Table</Label>
          <Combobox options={tableOptions} value={selectedTableId} onChange={setSelectedTableId} />
        </div>
        <Button variant="outline" onClick={() => loadRecords(selectedTableId)} disabled={loadingRecords}>
          <RefreshCw className="mr-1.5 h-4 w-4" />
          Refresh
        </Button>
        {isAdmin && (
          <Dialog open={addFieldOpen} onOpenChange={setAddFieldOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Plus className="mr-1.5 h-4 w-4" />
                Add field
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add field to {selectedTable?.name}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="new-field-name">Field name</Label>
                  <Input
                    id="new-field-name"
                    value={newFieldName}
                    onChange={(e) => setNewFieldName(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="new-field-type">Field type</Label>
                  <Combobox
                    options={CREATABLE_FIELD_TYPES}
                    value={newFieldType}
                    onChange={setNewFieldType}
                  />
                </div>
                {SELECT_TYPES.has(newFieldType) && (
                  <div>
                    <Label htmlFor="new-field-choices">Choices (comma-separated)</Label>
                    <Input
                      id="new-field-choices"
                      placeholder="Yes, No"
                      value={newFieldChoices}
                      onChange={(e) => setNewFieldChoices(e.target.value)}
                    />
                  </div>
                )}
                {error && <p className="text-sm text-red-400">{error}</p>}
                <Button onClick={handleAddField} disabled={savingField || !newFieldName.trim()}>
                  {savingField ? "Adding…" : "Add field"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
        <Button onClick={handleAddRecord} disabled={addingRecord || !selectedTableId}>
          <Plus className="mr-1.5 h-4 w-4" />
          {addingRecord ? "Adding…" : "Add record"}
        </Button>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {selectedTable && (
        <div className="max-h-[70vh] overflow-auto rounded-md border border-slate-800">
          <Table className="border-separate border-spacing-0">
            <TableHeader>
              <TableRow>
                {selectedTable.fields.map((field) => (
                  <TableHead
                    key={field.id}
                    className="sticky top-0 z-10 border-b border-slate-800 bg-[#0b0e14]"
                  >
                    {field.name}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((record) => (
                <TableRow key={record.id}>
                  {selectedTable.fields.map((field) => (
                    <TableCell key={field.id} className="align-top">
                      <AirtableCellEditor
                        field={field}
                        value={record.fields[field.name]}
                        error={cellErrors[cellKey(record.id, field.name)]}
                        onChange={(value, previous) => saveCell(record.id, field.name, value, previous)}
                      />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {nextOffset && (
        <Button
          variant="outline"
          onClick={() => loadRecords(selectedTableId, nextOffset)}
          disabled={loadingRecords}
        >
          {loadingRecords ? "Loading…" : "Load more"}
        </Button>
      )}
    </div>
  );
}

function AirtableCellEditor({
  field,
  value,
  error,
  onChange,
}: {
  field: AirtableTableField;
  value: unknown;
  error?: string;
  onChange: (value: unknown, previous: unknown) => void;
}) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const commit = (next: unknown) => {
    if (JSON.stringify(next) === JSON.stringify(value)) return;
    onChange(next, value);
  };

  if (field.type === "checkbox") {
    return (
      <input
        type="checkbox"
        checked={Boolean(value)}
        onChange={(e) => commit(e.target.checked)}
        className="h-4 w-4 rounded border-slate-600 bg-slate-950 text-orange-500"
      />
    );
  }

  if (field.type === "singleSelect" || field.type === "multipleSelects") {
    const choices = field.options?.choices ?? [];
    const selected = new Set(
      field.type === "multipleSelects"
        ? Array.isArray(value)
          ? (value as string[])
          : []
        : typeof value === "string" && value
          ? [value]
          : []
    );

    const toggle = (choiceName: string) => {
      if (field.type === "singleSelect") {
        commit(selected.has(choiceName) ? null : choiceName);
        return;
      }
      const next = new Set(selected);
      if (next.has(choiceName)) next.delete(choiceName);
      else next.add(choiceName);
      commit(Array.from(next));
    };

    return (
      <div className="flex flex-wrap gap-1">
        {choices.map((choice) => (
          <button
            key={choice.id}
            type="button"
            onClick={() => toggle(choice.name)}
            className={cn(
              "rounded-full px-2 py-0.5 text-xs ring-1 ring-inset transition-colors",
              selected.has(choice.name)
                ? "bg-orange-500/25 text-orange-200 ring-orange-400/40"
                : "bg-slate-800/60 text-slate-400 ring-slate-700 hover:text-slate-200"
            )}
          >
            {choice.name}
          </button>
        ))}
        {error && <p className="w-full text-xs text-red-400">{error}</p>}
      </div>
    );
  }

  const inputType =
    field.type === "number" || field.type === "currency"
      ? "number"
      : field.type === "date"
        ? "date"
        : field.type === "email"
          ? "email"
          : field.type === "url"
            ? "url"
            : "text";

  return (
    <div>
      <input
        type={inputType}
        value={typeof draft === "string" || typeof draft === "number" ? draft : ""}
        onChange={(e) =>
          setDraft(inputType === "number" ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value)
        }
        onBlur={() => commit(draft === "" ? null : draft)}
        className="w-full min-w-[100px] rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-200 focus:border-orange-500 focus:outline-none"
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
