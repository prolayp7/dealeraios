import { MapPin } from "lucide-react";
import { VehicleImageGallery } from "@/components/inventory/vehicle-image-gallery";
import { formatCurrency } from "@/lib/utils";

interface ListingSimulatorProps {
  title: string;
  description: string;
  price: string | number;
  photos: string[];
  location?: string;
  platformLabel?: string;
}

export function ListingSimulator({
  title,
  description,
  price,
  photos,
  location,
  platformLabel = "Facebook Marketplace",
}: ListingSimulatorProps) {
  const numericPrice = typeof price === "number" ? price : parseFloat(price);
  const displayTitle = title.trim() || "Untitled listing";
  const displayDescription = description.trim() || "No description yet";

  return (
    <div className="overflow-hidden rounded-lg border border-slate-700 bg-slate-950">
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Marketplace Preview
        </span>
        <span className="text-xs text-slate-500">{platformLabel}</span>
      </div>

      <VehicleImageGallery images={photos} alt={displayTitle} />

      <div className="space-y-2 p-4">
        <p className="text-2xl font-bold text-white">
          {formatCurrency(Number.isFinite(numericPrice) ? numericPrice : null)}
        </p>
        <p className="text-base font-medium text-slate-200">{displayTitle}</p>
        {location && (
          <p className="flex items-center gap-1 text-sm text-slate-500">
            <MapPin className="h-3.5 w-3.5" />
            {location}
          </p>
        )}
        <p className="whitespace-pre-wrap text-sm text-slate-400">
          {displayDescription}
        </p>
      </div>
    </div>
  );
}
