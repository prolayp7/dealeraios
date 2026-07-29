import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { enrichVehicle, enrichVehicleRecord } from "@/lib/vehicle-logic";
import {
  attachStoredImages,
  getStoredVehicleImagesRecord,
} from "@/lib/vehicle-image-store";
import {
  extractVehicleImages,
  saveVehicleWithOptionalImage,
} from "@/lib/vehicle-persistence";
import type { VehicleFormData } from "@/lib/types";

export async function GET(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from("vehicles")
      .select("*")
      .eq("id", params.id)
      .single();

    if (error) throw error;

    const storedImages = await getStoredVehicleImagesRecord(params.id);
    const withImages = attachStoredImages(data, storedImages);

    return NextResponse.json(enrichVehicleRecord(withImages));
  } catch (error) {
    console.error("GET /api/vehicles/[id]:", error);
    return NextResponse.json(
      { error: "Vehicle not found" },
      { status: 404 }
    );
  }
}

export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const body: VehicleFormData = await request.json();
    const { imageUrls, coverUrl } = extractVehicleImages(body);
    const enriched = enrichVehicle({ ...body, id: params.id });

    const supabase = await createServerClient();
    const { data, error } = await saveVehicleWithOptionalImage({
      vehicleId: params.id,
      enriched,
      imageUrls,
      coverUrl,
      save: async (payload) =>
        supabase
          .from("vehicles")
          .update(payload)
          .eq("id", params.id)
          .select()
          .single(),
    });

    if (error) throw error;
    if (!data) throw new Error("Vehicle not found");

    const storedImages = await getStoredVehicleImagesRecord(params.id);
    const withImages = attachStoredImages(data, storedImages);

    return NextResponse.json(enrichVehicleRecord(withImages));
  } catch (error) {
    console.error("PATCH /api/vehicles/[id]:", error);
    return NextResponse.json(
      { error: "Failed to update vehicle" },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const supabase = await createServerClient();

    // Deletion is never propagated to Airtable (explicit non-goal), so deleting
    // a linked vehicle while sync is on is silently undone: the next sync sees
    // an Airtable record with no local link and recreates it under a fresh id,
    // losing local-only data. Block it with a 409 instead of pretending.
    const { data: vehicle, error: fetchError } = await supabase
      .from("vehicles")
      .select("airtable_record_id, dealership_id")
      .eq("id", params.id)
      .single();

    if (fetchError || !vehicle) {
      return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
    }

    if (vehicle.airtable_record_id) {
      const { data: settings, error: settingsError } = await supabase
        .from("dealership_settings")
        .select("airtable_config")
        .eq("dealership_id", vehicle.dealership_id)
        .maybeSingle();

      if (settingsError) throw settingsError;

      const airtableConfig = settings?.airtable_config as { enabled?: boolean } | undefined;
      if (airtableConfig?.enabled) {
        return NextResponse.json(
          {
            error:
              "This vehicle is linked to Airtable and sync is enabled — the next sync would recreate it. Disable Airtable sync first, or delete the record in Airtable to unlink it before deleting here.",
          },
          { status: 409 }
        );
      }
    }

    const { error } = await supabase
      .from("vehicles")
      .delete()
      .eq("id", params.id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/vehicles/[id]:", error);
    return NextResponse.json(
      { error: "Failed to delete vehicle" },
      { status: 500 }
    );
  }
}
