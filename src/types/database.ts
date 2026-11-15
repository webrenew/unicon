export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface Bundle {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  is_public: boolean;
  share_slug: string | null;
  stroke_preset: string | null;
  normalize_strokes: boolean;
  target_stroke_width: number | null;
  normalize_viewbox: boolean;
  target_viewbox: string | null;
  icons: BundleIcon[];
  icon_count: number;
  created_at: string;
  updated_at: string;
}

export interface BundleIcon {
  id: string;
  name: string;
  normalizedName: string;
  sourceId: string;
  svg: string;
  viewBox: string;
  strokeWidth?: string | null;
  defaultFill?: boolean;
  defaultStroke?: boolean;
}

export interface UserWithProfile {
  profile: Profile;
}

// Teams

export type TeamRole = "owner" | "admin" | "member";
export type InviteStatus = "pending" | "accepted" | "expired" | "revoked";

export interface Team {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  logo_url: string | null;
  max_members: number;
  created_at: string;
  updated_at: string;
}

export interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  role: TeamRole;
  created_at: string;
  profile?: Profile;
}

export interface TeamInvite {
  id: string;
  team_id: string;
  email: string;
  role: TeamRole;
  token: string;
  invited_by: string;
  status: InviteStatus;
  expires_at: string;
  created_at: string;
  inviter?: Profile;
}

export interface TeamWithMembers extends Team {
  members: TeamMember[];
  invites: TeamInvite[];
}

// API Sessions

export interface ApiSession {
  id: string;
  name: string | null;
  client_name: string;
  scope: string;
  last_used_at: string | null;
  created_at: string;
  token_preview: string;
}
