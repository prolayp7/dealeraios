import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const { dealershipName, email, password } = await request.json();

    if (!dealershipName || !email || !password) {
      return NextResponse.json(
        { error: "Dealership name, email, and password are required" },
        { status: 400 }
      );
    }

    const supabase = await createServerClient();
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (signUpError) {
      const message = signUpError.message.toLowerCase().includes("already registered")
        ? "An account with this email already exists. Try logging in instead."
        : signUpError.message;
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const userId = signUpData.user?.id;
    if (!userId) {
      return NextResponse.json(
        { error: "Signup failed — no user was created" },
        { status: 500 }
      );
    }

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json(
        { error: "Server is missing SUPABASE_SERVICE_ROLE_KEY" },
        { status: 500 }
      );
    }

    const { data: dealership, error: dealershipError } = await admin
      .from("dealerships")
      .insert({ name: dealershipName })
      .select()
      .single();

    const { error: profileError } = dealershipError
      ? { error: dealershipError }
      : await admin.from("profiles").insert({
          id: userId,
          dealership_id: dealership!.id,
          role: "admin",
          email,
        });

    if (dealershipError || profileError) {
      await admin.auth.admin.deleteUser(userId);
      if (dealership) await admin.from("dealerships").delete().eq("id", dealership.id);
      return NextResponse.json(
        { error: "Failed to create dealership account. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      needsEmailConfirmation: !signUpData.session,
    });
  } catch (error) {
    console.error("POST /api/auth/signup:", error);
    return NextResponse.json({ error: "Signup failed" }, { status: 500 });
  }
}
