
-- Fix infinite recursion in team_members RLS policies.
-- The problem: team_members policies reference team_members in subqueries,
-- causing infinite recursion when Postgres re-applies RLS on the subquery.
-- The fix: SECURITY DEFINER functions that bypass RLS for permission checks.

-- Helper: get all team IDs for the current user
CREATE OR REPLACE FUNCTION public.get_user_team_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT team_id FROM team_members WHERE user_id = auth.uid()
$$;

-- Helper: check if current user is admin/owner of a team
CREATE OR REPLACE FUNCTION public.is_team_admin(check_team_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM team_members
    WHERE team_id = check_team_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
  )
$$;

-- Fix team_members policies (self-referencing → use helper functions)
DROP POLICY IF EXISTS "Team members can view other members" ON team_members;
CREATE POLICY "Team members can view other members" ON team_members
  FOR SELECT USING (team_id IN (SELECT get_user_team_ids()));

DROP POLICY IF EXISTS "Team admins can manage members" ON team_members;
CREATE POLICY "Team admins can manage members" ON team_members
  FOR ALL USING (is_team_admin(team_id));

-- Fix bundles policies that reference team_members
DROP POLICY IF EXISTS "Team members can view team bundles" ON bundles;
CREATE POLICY "Team members can view team bundles" ON bundles
  FOR SELECT USING (team_id IS NOT NULL AND team_id IN (SELECT get_user_team_ids()));

DROP POLICY IF EXISTS "Team admins can manage team bundles" ON bundles;
CREATE POLICY "Team admins can manage team bundles" ON bundles
  FOR ALL USING (team_id IS NOT NULL AND is_team_admin(team_id));

-- Fix teams policies that reference team_members
DROP POLICY IF EXISTS "Team members can view their teams" ON teams;
CREATE POLICY "Team members can view their teams" ON teams
  FOR SELECT USING (id IN (SELECT get_user_team_ids()));
