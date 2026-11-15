import { redirect } from "next/navigation";
import Image from "next/image";
import { SiteHeader } from "@/components/site-header";
import { getUser } from "@/lib/auth/actions";
import { TeamSettings } from "@/components/settings/team-settings";
import { ApiTokenSettings } from "@/components/settings/api-token-settings";
import { createAdminClient } from "@/lib/supabase/admin";
import type { TeamWithMembers, ApiSession } from "@/types/database";

export const metadata = {
  title: "Settings",
  description: "Manage your account settings",
};

export default async function SettingsPage() {
  const user = await getUser();

  if (!user) {
    redirect("/?login=required");
  }

  const { profile } = user;
  const displayName = profile.full_name ?? profile.email ?? "User";
  const memberSince = profile.created_at
    ? new Date(profile.created_at).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      })
    : null;

  // Fetch team data and API sessions
  let teamData: TeamWithMembers | null = null;
  let tokenSessions: ApiSession[] = [];
  {
    const admin = createAdminClient();

    // Fetch team membership and API sessions in parallel
    const [membershipResult, sessionsResult] = await Promise.all([
      admin
        .from("team_members")
        .select("team_id")
        .eq("user_id", profile.id)
        .limit(1)
        .maybeSingle(),
      admin.rpc("list_api_sessions", { p_user_id: profile.id }),
    ]);

    tokenSessions = (sessionsResult.data ?? []) as unknown as ApiSession[];

    const membership = membershipResult.data;

    if (membership) {
      const [teamResult, membersResult, invitesResult] = await Promise.all([
        admin.from("teams").select("*").eq("id", membership.team_id).single(),
        admin
          .from("team_members")
          .select("id, team_id, user_id, role, created_at, profiles(id, email, full_name, avatar_url)")
          .eq("team_id", membership.team_id)
          .order("created_at", { ascending: true }),
        admin
          .from("team_invites")
          .select("*")
          .eq("team_id", membership.team_id)
          .eq("status", "pending")
          .order("created_at", { ascending: false }),
      ]);

      if (teamResult.data) {
        const members = (membersResult.data ?? []).map((m) => ({
          id: m.id,
          team_id: m.team_id,
          user_id: m.user_id,
          role: m.role as "owner" | "admin" | "member",
          created_at: m.created_at,
          profile: (m.profiles as unknown as Record<string, unknown> | null) ?? undefined,
        }));

        teamData = {
          ...teamResult.data,
          members,
          invites: invitesResult.data ?? [],
        } as TeamWithMembers;
      }
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <div className="flex-1 px-4 lg:px-20 xl:px-40 py-8">
        <div className="max-w-2xl mx-auto space-y-6">
          <h1 className="text-2xl font-semibold text-black dark:text-white">
            Settings
          </h1>

          {/* Profile card */}
          <div className="p-5 rounded-xl border border-black/5 dark:border-white/5 bg-white/50 dark:bg-white/[0.02]">
            <h2 className="text-sm font-medium text-muted-foreground mb-4">
              Profile
            </h2>
            <div className="flex items-center gap-4">
              <div className="relative w-12 h-12 rounded-full overflow-hidden bg-black/10 dark:bg-white/10 flex items-center justify-center shrink-0">
                {profile.avatar_url ? (
                  <Image
                    src={profile.avatar_url}
                    alt={displayName}
                    width={48}
                    height={48}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-sm font-medium text-black/70 dark:text-white/70">
                    {displayName
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2)}
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-black dark:text-white truncate">
                  {displayName}
                </p>
                {profile.email && (
                  <p className="text-sm text-muted-foreground truncate">
                    {profile.email}
                  </p>
                )}
                {memberSince && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Member since {memberSince}
                  </p>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              Managed by your sign-in provider
            </p>
          </div>

          <ApiTokenSettings initialSessions={tokenSessions} />
          <TeamSettings initialTeam={teamData} userId={profile.id} />
        </div>
      </div>
    </div>
  );
}
