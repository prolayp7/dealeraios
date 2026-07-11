import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { moneyTrapVehicles, vehicleMoneyTrapAction } from "@/lib/money-trap";
import { getVehicleLabel } from "@/lib/vehicle-logic";
import type { Vehicle } from "@/lib/types";

export function MoneyTrapWidget({ vehicles }: { vehicles: Vehicle[] }) {
  const trapped = moneyTrapVehicles(vehicles);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-slate-400">
          Money Trap
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold text-white">{trapped.length}</p>
        <p className="mt-1 text-xs text-slate-500">
          Days in stock &gt; 60 and ROI &lt; 10%
        </p>

        {trapped.length > 0 && (
          <div className="mt-4 space-y-2 border-t border-slate-800 pt-3">
            {trapped.slice(0, 5).map((vehicle) => (
              <Link
                key={vehicle.id}
                href={`/inventory/${vehicle.id}`}
                className="flex items-center justify-between rounded-md px-1 py-1 text-sm hover:bg-slate-800/50"
              >
                <span className="truncate text-slate-200">
                  {getVehicleLabel(vehicle)}
                </span>
                <Badge variant="moneyTrap" className="ml-2 shrink-0">
                  {vehicleMoneyTrapAction(vehicle)}
                </Badge>
              </Link>
            ))}
            {trapped.length > 5 && (
              <p className="pt-1 text-xs text-slate-500">
                +{trapped.length - 5} more
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
