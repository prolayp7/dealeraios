"use client";

import { useEffect, useState } from "react";
import { Rocket } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Combobox } from "@/components/ui/combobox";
import { FbPublishDialog } from "@/components/fb-publish-dialog";
import { FbListingBadge } from "@/components/fb-listing-badge";
import { getVehicleLabel } from "@/lib/vehicle-logic";
import type { Vehicle } from "@/lib/types";

// Facebook is the only fully working platform this sprint — architecture is
// wired for all seven via the same MarketSource-style interface used by
// Market Intelligence, but the remaining six ship as configured-but-inactive
// placeholders (~40-45 days of separate scope per platform's API/TOS work).
const PLATFORMS = [
  { id: "facebook", label: "Facebook Marketplace", active: true },
  { id: "craigslist", label: "Craigslist", active: false },
  { id: "offerup", label: "OfferUp", active: false },
  { id: "cars-com", label: "Cars.com", active: false },
  { id: "cargurus", label: "CarGurus", active: false },
  { id: "autotrader", label: "AutoTrader", active: false },
  { id: "swoopa", label: "Swoopa", active: false },
];

export default function ListEverywherePage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const loadVehicles = () => {
    fetch("/api/vehicles")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setVehicles(data);
          setSelectedId((prev) => prev || data[0]?.id || "");
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadVehicles();
  }, []);

  const selectedVehicle = vehicles.find((v) => v.id === selectedId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold text-white">
          <Rocket className="h-8 w-8 text-orange-500" />
          List Everywhere
        </h1>
        <p className="mt-1 text-slate-400">
          Every listing always shows a preview first — nothing publishes without
          your explicit approval.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Select a vehicle</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-slate-500">Loading vehicles...</p>
          ) : (
            <Combobox
              className="min-w-64"
              value={selectedId}
              onChange={setSelectedId}
              placeholder="Search vehicles..."
              options={vehicles.map((v) => ({ value: v.id, label: getVehicleLabel(v) }))}
            />
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PLATFORMS.map((platform) => (
          <Card key={platform.id}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base">{platform.label}</CardTitle>
              {platform.active ? (
                <Badge variant="buy">Connected</Badge>
              ) : (
                <Badge variant="secondary">Not connected</Badge>
              )}
            </CardHeader>
            <CardContent className="flex flex-col items-start gap-3">
              {platform.id === "facebook" && selectedVehicle && (
                <>
                  <FbListingBadge status={selectedVehicle.fb_listing_status} />
                  <FbPublishDialog vehicle={selectedVehicle} onPublished={loadVehicles} />
                </>
              )}
              {!platform.active && (
                <p className="text-sm text-slate-500">
                  Wired into the architecture, not yet live. Separate follow-on scope.
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
