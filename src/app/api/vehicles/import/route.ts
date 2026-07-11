import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getSessionDealership } from "@/lib/supabase/session";
import { enrichVehicle, enrichVehicleRecord } from "@/lib/vehicle-logic";
import type { VehicleFormData } from "@/lib/types";

interface ImportRequestBody {
  vehicles: VehicleFormData[];
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ImportRequestBody;

    if (!Array.isArray(body.vehicles) || body.vehicles.length === 0) {
      return NextResponse.json(
        { error: "No vehicles provided to import" },
        { status: 400 }
      );
    }

    const vehicles = body.vehicles
      .filter((row) => row.make || row.model)
      .map((row) => enrichVehicle({ ...row, id: crypto.randomUUID() }));

    if (vehicles.length === 0) {
      return NextResponse.json(
        { error: "No valid vehicles found — each row needs at least a make or model" },
        { status: 400 }
      );
    }

    const supabase = await createServerClient();
    const session = await getSessionDealership(supabase);
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("vehicles")
      .insert(vehicles.map((v) => ({ ...v, dealership_id: session.dealershipId })))
      .select();

    if (error) throw error;

    return NextResponse.json({
      imported: data?.length ?? 0,
      vehicles: (data ?? []).map(enrichVehicleRecord),
    });
  } catch (error) {
    console.error("POST /api/vehicles/import:", error);
    return NextResponse.json(
      { error: "Failed to import vehicles" },
      { status: 500 }
    );
  }
}
