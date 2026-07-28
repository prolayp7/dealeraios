"use client";

import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  applyColumnMapping,
  parseCsvText,
  suggestColumnMapping,
  type ColumnMapping,
  type ParsedCsv,
} from "@/lib/import-column-mapper";
import { ColumnMappingEditor } from "@/components/column-mapping-editor";

interface CsvImportButtonProps {
  onImported: () => void;
}

export function CsvImportButton({ onImported }: CsvImportButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<ParsedCsv | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    const text = await file.text();
    const csv = parseCsvText(text);

    if (csv.headers.length === 0 || csv.rows.length === 0) {
      setError("CSV must have a header row and at least one data row");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    setParsed(csv);
    setMapping(suggestColumnMapping(csv.headers));
  };

  const handleImport = async () => {
    if (!parsed) return;

    setImporting(true);
    setError(null);

    try {
      const vehicles = applyColumnMapping(parsed, mapping);

      if (vehicles.length === 0) {
        throw new Error("No valid vehicles found — map at least Make or Model");
      }

      const res = await fetch("/api/vehicles/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vehicles }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Import failed");

      setParsed(null);
      onImported();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={handleFile}
      />
      <Button variant="outline" onClick={() => inputRef.current?.click()}>
        <Upload className="h-4 w-4" />
        Import CSV
      </Button>

      <Dialog open={parsed != null} onOpenChange={(open) => !open && setParsed(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Map CSV columns</DialogTitle>
            <DialogDescription>
              We detected {parsed?.headers.length ?? 0} columns and{" "}
              {parsed?.rows.length ?? 0} rows. Confirm which column maps to each
              field before importing.
            </DialogDescription>
          </DialogHeader>

          <ColumnMappingEditor
            availableColumns={parsed?.headers ?? []}
            mapping={mapping}
            onChange={setMapping}
          />

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setParsed(null)}>
              Cancel
            </Button>
            <Button onClick={handleImport} disabled={importing}>
              {importing ? "Importing..." : `Import ${parsed?.rows.length ?? 0} rows`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
