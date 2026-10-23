import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { sanitizeBundleIcons } from "@/lib/svg-sanitizer";

export async function GET() {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: bundles, error } = await supabase
      .from("bundles")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    if (error) {
      logger.error("GET /api/bundles query error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { bundles },
      {
        headers: {
          "Cache-Control": "private, max-age=30, stale-while-revalidate=60",
          "Vary": "Cookie",
        },
      }
    );
  } catch (err) {
    logger.error("GET /api/bundles error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse body early to fail fast on invalid input
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { name, description, icons, stroke_preset, normalize_strokes, target_stroke_width, normalize_viewbox, target_viewbox } = body;

    if (!name || !icons || !Array.isArray(icons)) {
      return NextResponse.json({ error: "Name and icons are required" }, { status: 400 });
    }

    const sanitizedIcons = sanitizeBundleIcons(icons);
    if (!sanitizedIcons) {
      return NextResponse.json({ error: "icons must be an array of objects" }, { status: 400 });
    }

    // Use atomic RPC to prevent race conditions on bundle limit
    const { data, error } = await supabase.rpc("create_bundle_atomic", {
      p_user_id: user.id,
      p_name: name,
      p_description: description ?? null,
      p_icons: sanitizedIcons,
      p_stroke_preset: stroke_preset ?? null,
      p_normalize_strokes: normalize_strokes ?? false,
      p_target_stroke_width: target_stroke_width ?? null,
      p_normalize_viewbox: normalize_viewbox ?? false,
      p_target_viewbox: target_viewbox ?? "0 0 24 24",
    });

    if (error) {
      if (error.code === "42501") {
        return NextResponse.json({ error: "Permission denied" }, { status: 403 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const result = data?.[0];

    if (!result?.success) {
      return NextResponse.json(
        { error: result?.error ?? "Failed to create bundle" },
        { status: 403 }
      );
    }

    return NextResponse.json({ bundle: result.bundle }, { status: 201 });
  } catch (err) {
    logger.error("POST /api/bundles error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
