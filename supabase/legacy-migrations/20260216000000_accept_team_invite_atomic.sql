-- Atomic team invite acceptance with capacity enforcement
-- Prevents concurrent invite acceptance from exceeding teams.max_members

CREATE OR REPLACE FUNCTION public.accept_team_invite_atomic(
  p_token TEXT,
  p_user_id UUID
)
RETURNS TABLE (
  success BOOLEAN,
  error TEXT,
  team_id UUID,
  team_name TEXT
) AS $$
DECLARE
  v_invite public.team_invites%ROWTYPE;
  v_team public.teams%ROWTYPE;
  v_member_count INTEGER;
BEGIN
  -- Lock invite row so status transitions are serialized per token
  SELECT * INTO v_invite
  FROM public.team_invites
  WHERE token = p_token
    AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'Invite not found or already used'::TEXT, NULL::UUID, NULL::TEXT;
    RETURN;
  END IF;

  -- Lock team row so member count + insert is serialized per team
  SELECT * INTO v_team
  FROM public.teams
  WHERE id = v_invite.team_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'Team not found'::TEXT, NULL::UUID, NULL::TEXT;
    RETURN;
  END IF;

  IF v_invite.expires_at < NOW() THEN
    UPDATE public.team_invites
    SET status = 'expired'
    WHERE id = v_invite.id;

    RETURN QUERY SELECT FALSE, 'This invite has expired'::TEXT, NULL::UUID, NULL::TEXT;
    RETURN;
  END IF;

  -- If user is already a member, mirror existing behavior:
  -- mark invite accepted and return a conflict message.
  IF EXISTS (
    SELECT 1
    FROM public.team_members
    WHERE team_id = v_invite.team_id
      AND user_id = p_user_id
  ) THEN
    UPDATE public.team_invites
    SET status = 'accepted'
    WHERE id = v_invite.id;

    RETURN QUERY SELECT FALSE, 'You''re already a member of this team'::TEXT, v_team.id, v_team.name;
    RETURN;
  END IF;

  SELECT COUNT(*)::INTEGER INTO v_member_count
  FROM public.team_members
  WHERE team_id = v_invite.team_id;

  IF v_member_count >= v_team.max_members THEN
    RETURN QUERY SELECT FALSE, 'Team is at maximum capacity'::TEXT, v_team.id, v_team.name;
    RETURN;
  END IF;

  BEGIN
    INSERT INTO public.team_members (team_id, user_id, role)
    VALUES (
      v_invite.team_id,
      p_user_id,
      CASE
        WHEN v_invite.role = 'owner' THEN 'member'::public.team_role
        ELSE v_invite.role
      END
    );
  EXCEPTION
    WHEN unique_violation THEN
      UPDATE public.team_invites
      SET status = 'accepted'
      WHERE id = v_invite.id;

      RETURN QUERY SELECT FALSE, 'You''re already a member of this team'::TEXT, v_team.id, v_team.name;
      RETURN;
  END;

  UPDATE public.team_invites
  SET status = 'accepted'
  WHERE id = v_invite.id;

  RETURN QUERY SELECT TRUE, NULL::TEXT, v_team.id, v_team.name;
END;
$$ LANGUAGE plpgsql;
