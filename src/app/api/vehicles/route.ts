import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getSessionDealership } from "@/lib/supabase/session";
import { enrichVehicle, enrichVehicleRecord } from "@/lib/vehicle-logic";
import { attachStoredImageUrls } from "@/lib/vehicle-image-store";
import {
  extractVehicleImages,
  saveVehicleWithOptionalImage,
} from "@/lib/vehicle-persistence";
import type { VehicleFormData } from "@/lib/types";

export async function GET() {
  try {
    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from("vehicles")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    const withImages = await attachStoredImageUrls(data ?? []);
    const vehicles = withImages.map(enrichVehicleRecord);
    return NextResponse.json(vehicles);
  } catch (error) {
    console.error("GET /api/vehicles:", error);
    return NextResponse.json(
      { error: "Failed to fetch vehicles" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body: VehicleFormData = await request.json();
    const vehicleId = crypto.randomUUID();
    const { imageUrls, coverUrl } = extractVehicleImages(body);
    const enriched = enrichVehicle({ ...body, id: vehicleId });

    const supabase = await createServerClient();
    const session = await getSessionDealership(supabase);
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { data, error } = await saveVehicleWithOptionalImage({
      vehicleId,
      enriched,
      imageUrls,
      coverUrl,
      save: async (payload) =>
        supabase
          .from("vehicles")
          .insert({ ...payload, dealership_id: session.dealershipId })
          .select()
          .single(),
    });

    if (error) throw error;
    if (!data) throw new Error("Failed to create vehicle");

    const withImages = await attachStoredImageUrls([data]);

    return NextResponse.json(enrichVehicleRecord(withImages[0]), {
      status: 201,
    });
  } catch (error) {
    console.error("POST /api/vehicles:", error);
    return NextResponse.json(
      { error: "Failed to create vehicle" },
      { status: 500 }
    );
  }
}
