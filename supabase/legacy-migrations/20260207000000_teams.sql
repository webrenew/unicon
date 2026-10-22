-- Teams, Team Members, Team Invites
-- Adds team/org system for Pro users to share bundles

-- =============================================================================
-- TYPES
-- =============================================================================
CREATE TYPE public.team_role AS ENUM ('owner', 'admin', 'member');
CREATE TYPE public.invite_status AS ENUM ('pending', 'accepted', 'expired', 'revoked');

-- =============================================================================
-- TEAMS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  max_members INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_teams_owner_id ON public.teams(owner_id);
CREATE INDEX idx_teams_slug ON public.teams(slug);

-- =============================================================================
-- TEAM MEMBERS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role public.team_role NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, user_id)
);

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_team_members_team_id ON public.team_members(team_id);
CREATE INDEX idx_team_members_user_id ON public.team_members(user_id);

-- =============================================================================
-- TEAM INVITES TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.team_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role public.team_role NOT NULL DEFAULT 'member',
  token TEXT NOT NULL UNIQUE,
  invited_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status public.invite_status NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, email)
);

ALTER TABLE public.team_invites ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_team_invites_team_id ON public.team_invites(team_id);
CREATE INDEX idx_team_invites_token ON public.team_invites(token);
CREATE INDEX idx_team_invites_email ON public.team_invites(email);

-- =============================================================================
-- ALTER BUNDLES TABLE — add team_id
-- =============================================================================
ALTER TABLE public.bundles
  ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE;

CREATE INDEX idx_bundles_team_id ON public.bundles(team_id) WHERE team_id IS NOT NULL;

-- =============================================================================
-- RLS POLICIES (all tables exist now)
-- =============================================================================

-- Teams: Owner has full access
CREATE POLICY "Team owners can manage their teams" ON public.teams
  FOR ALL USING (auth.uid() = owner_id);

-- Teams: Members can view teams they belong to
CREATE POLICY "Team members can view their teams" ON public.teams
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.team_members
      WHERE team_members.team_id = teams.id
      AND team_members.user_id = auth.uid()
    )
  );

-- Team members: Users can see members of teams they belong to
CREATE POLICY "Team members can view other members" ON public.team_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.team_members AS my_membership
      WHERE my_membership.team_id = team_members.team_id
      AND my_membership.user_id = auth.uid()
    )
  );

-- Team members: Admins and owners can manage members
CREATE POLICY "Team admins can manage members" ON public.team_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.team_members AS admin_check
      WHERE admin_check.team_id = team_members.team_id
      AND admin_check.user_id = auth.uid()
      AND admin_check.role IN ('owner', 'admin')
    )
  );

-- Team invites: Admins can manage invites for their teams
CREATE POLICY "Team admins can manage invites" ON public.team_invites
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.team_members
      WHERE team_members.team_id = team_invites.team_id
      AND team_members.user_id = auth.uid()
      AND team_members.role IN ('owner', 'admin')
    )
  );

-- Team invites: Users can view invites sent to their email
CREATE POLICY "Users can view their pending invites" ON public.team_invites
  FOR SELECT USING (
    email = (SELECT email FROM public.profiles WHERE id = auth.uid())
    AND status = 'pending'
  );

-- Bundles: Team members can view team bundles
CREATE POLICY "Team members can view team bundles" ON public.bundles
  FOR SELECT USING (
    team_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.team_members
      WHERE team_members.team_id = bundles.team_id
      AND team_members.user_id = auth.uid()
    )
  );

-- Bundles: Team admins/owners can manage team bundles
CREATE POLICY "Team admins can manage team bundles" ON public.bundles
  FOR ALL USING (
    team_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.team_members
      WHERE team_members.team_id = bundles.team_id
      AND team_members.user_id = auth.uid()
      AND team_members.role IN ('owner', 'admin')
    )
  );

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Updated_at trigger for teams
CREATE TRIGGER update_teams_updated_at
  BEFORE UPDATE ON public.teams
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Generate a URL-safe slug from a team name
CREATE OR REPLACE FUNCTION public.generate_team_slug(p_name TEXT)
RETURNS TEXT AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INTEGER := 0;
BEGIN
  -- Lowercase, replace non-alphanumeric with hyphens, trim hyphens
  base_slug := trim(both '-' from regexp_replace(lower(p_name), '[^a-z0-9]+', '-', 'g'));

  -- Ensure minimum length
  IF length(base_slug) < 2 THEN
    base_slug := base_slug || '-team';
  END IF;

  final_slug := base_slug;

  -- Append numeric suffix if slug already exists
  WHILE EXISTS (SELECT 1 FROM public.teams WHERE slug = final_slug) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;

  RETURN final_slug;
END;
$$ LANGUAGE plpgsql;

-- Generate a cryptographically secure invite token
CREATE OR REPLACE FUNCTION public.generate_invite_token()
RETURNS TEXT AS $$
BEGIN
  RETURN 'inv_' || encode(gen_random_bytes(24), 'hex');
END;
$$ LANGUAGE plpgsql;
