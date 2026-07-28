"use client";

import { TARGET_FIELDS, type ColumnMapping } from "@/lib/import-column-mapper";

export function ColumnMappingEditor({
  availableColumns,
  mapping,
  onChange,
}: {
  availableColumns: string[];
  mapping: ColumnMapping;
  onChange: (mapping: ColumnMapping) => void;
}) {
  return (
    <div className="max-h-96 space-y-2 overflow-y-auto">
      {TARGET_FIELDS.map((field) => (
        <div
          key={field.key}
          className="grid grid-cols-2 items-center gap-3 rounded-md border border-slate-800 p-2"
        >
          <span className="text-sm text-slate-200">
            {field.label}
            {field.required && <span className="text-red-400"> *</span>}
          </span>
          <select
            value={mapping[field.key] ?? ""}
            onChange={(e) =>
              onChange({ ...mapping, [field.key]: e.target.value || undefined })
            }
            className="h-9 rounded-md border border-slate-700 bg-slate-950 px-2 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
          >
            <option value="">— Not mapped —</option>
            {availableColumns.map((column) => (
              <option key={column} value={column}>
                {column}
              </option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
}
