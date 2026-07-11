import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionDealership } from "@/lib/supabase/session";

export async function GET() {
  try {
    const supabase = await createServerClient();
    const session = await getSessionDealership(supabase);

    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // RLS already scopes this to the caller's dealership via same_dealership_read.
    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, role, full_name, created_at")
      .order("created_at", { ascending: true });

    if (error) throw error;

    return NextResponse.json(data ?? []);
  } catch (error) {
    console.error("GET /api/auth/invite:", error);
    return NextResponse.json({ error: "Failed to load users" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createServerClient();
    const session = await getSessionDealership(supabase);

    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    if (session.role !== "admin") {
      return NextResponse.json(
        { error: "Only admins can invite staff" },
        { status: 403 }
      );
    }

    const { email } = await request.json();
    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json(
        { error: "Server is missing SUPABASE_SERVICE_ROLE_KEY" },
        { status: 500 }
      );
    }

    const { data: existingProfile } = await admin
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existingProfile) {
      return NextResponse.json(
        { error: "This email is already part of a dealership account" },
        { status: 409 }
      );
    }

    const origin = new URL(request.url).origin;
    const { data: inviteData, error: inviteError } =
      await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${origin}/auth/callback`,
      });

    if (inviteError || !inviteData.user) {
      return NextResponse.json(
        { error: inviteError?.message ?? "Failed to send invite" },
        { status: 500 }
      );
    }

    const { error: profileError } = await admin.from("profiles").insert({
      id: inviteData.user.id,
      dealership_id: session.dealershipId,
      role: "staff",
      email,
    });

    if (profileError) {
      await admin.auth.admin.deleteUser(inviteData.user.id);
      return NextResponse.json(
        { error: "Failed to create staff profile" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("POST /api/auth/invite:", error);
    return NextResponse.json({ error: "Invite failed" }, { status: 500 });
  }
}
