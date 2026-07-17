import Link from "next/link";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { moneyTrapVehicles } from "@/lib/money-trap";
import { getVehicleLabel } from "@/lib/vehicle-logic";
import { formatCurrency } from "@/lib/utils";
import type { Vehicle } from "@/lib/types";

export function MoneyTrapsPanel({ vehicles }: { vehicles: Vehicle[] }) {
  const trapped = [...moneyTrapVehicles(vehicles)]
    .sort((a, b) => (b.days_in_stock ?? 0) - (a.days_in_stock ?? 0))
    .slice(0, 2);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Money Traps
        </CardTitle>
        <Link href="/cashflow" className="text-xs font-medium text-info hover:underline">
          Cashflow →
        </Link>
      </CardHeader>
      <CardContent className="space-y-3">
        {trapped.length === 0 ? (
          <p className="text-sm text-muted-foreground">No money traps right now.</p>
        ) : (
          trapped.map((vehicle) => (
            <Link
              key={vehicle.id}
              href={`/inventory/${vehicle.id}`}
              className="flex items-center gap-3 rounded-lg hover:bg-slate-800/40"
            >
              <div className="relative h-12 w-16 shrink-0 overflow-hidden rounded-md bg-slate-800">
                {vehicle.image_url && (
                  <Image
                    src={vehicle.image_url}
                    alt={getVehicleLabel(vehicle)}
                    fill
                    sizes="64px"
                    className="object-cover"
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {getVehicleLabel(vehicle)}
                </p>
                <p className="text-xs text-danger">
                  {vehicle.days_in_stock ?? 0}d trapped
                </p>
              </div>
              <p className="shrink-0 text-sm font-semibold text-danger">
                {formatCurrency(vehicle.total_invested)}
              </p>
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  );
}
