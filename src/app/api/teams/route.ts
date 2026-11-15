import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/teams — List user's teams
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Get teams the user is a member of
  const { data: memberships, error } = await admin
    .from("team_members")
    .select("team_id, role, teams(id, name, slug, owner_id, max_members, created_at, updated_at)")
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const teams = (memberships ?? []).map((m) => ({
    ...(m.teams as unknown as Record<string, unknown>),
    role: m.role,
  }));

  return NextResponse.json(
    { teams },
    {
      headers: {
        "Cache-Control": "private, max-age=30, stale-while-revalidate=60",
        "Vary": "Cookie",
      },
    }
  );
}

/**
 * POST /api/teams — Create a team
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Check if user already owns a team
  const { data: existingTeam } = await admin
    .from("teams")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (existingTeam) {
    return NextResponse.json(
      { error: "You already own a team. One team per account." },
      { status: 409 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { name } = body;
  if (!name || typeof name !== "string" || name.trim().length < 2) {
    return NextResponse.json(
      { error: "Team name must be at least 2 characters" },
      { status: 400 }
    );
  }

  // Generate slug
  const { data: slugData, error: slugError } = await admin.rpc("generate_team_slug", {
    p_name: name.trim(),
  });

  if (slugError || !slugData) {
    return NextResponse.json({ error: "Failed to generate team slug" }, { status: 500 });
  }

  const slug = slugData as string;

  // Create team
  const { data: team, error: createError } = await admin
    .from("teams")
    .insert({
      name: name.trim(),
      slug,
      owner_id: user.id,
    })
    .select()
    .single();

  if (createError) {
    return NextResponse.json({ error: createError.message }, { status: 500 });
  }

  // Add owner as team member
  const { error: memberError } = await admin.from("team_members").insert({
    team_id: team.id,
    user_id: user.id,
    role: "owner",
  });

  if (memberError) {
    // Rollback team creation
    await admin.from("teams").delete().eq("id", team.id);
    return NextResponse.json({ error: memberError.message }, { status: 500 });
  }

  return NextResponse.json({ team }, { status: 201 });
}
