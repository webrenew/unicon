-- Bind invite acceptance to invited email identity.
-- Prevents invite token redemption by authenticated users with mismatched emails.

DROP FUNCTION IF EXISTS public.accept_team_invite_atomic(TEXT, UUID);

CREATE OR REPLACE FUNCTION public.accept_team_invite_atomic(
  p_token TEXT,
  p_user_id UUID,
  p_user_email TEXT
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
  v_profile_email TEXT;
  v_normalized_invite_email TEXT;
  v_normalized_profile_email TEXT;
  v_normalized_user_email TEXT;
BEGIN
  -- Lock invite row so status transitions are serialized per token.
  SELECT * INTO v_invite
  FROM public.team_invites
  WHERE token = p_token
    AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'Invite not found or already used'::TEXT, NULL::UUID, NULL::TEXT;
    RETURN;
  END IF;

  -- Lock team row so member count + insert is serialized per team.
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

  SELECT email INTO v_profile_email
  FROM public.profiles
  WHERE id = p_user_id;

  v_normalized_invite_email := lower(trim(v_invite.email));
  v_normalized_profile_email := lower(trim(coalesce(v_profile_email, '')));
  v_normalized_user_email := lower(trim(coalesce(p_user_email, '')));

  IF v_normalized_profile_email = '' THEN
    RETURN QUERY SELECT FALSE, 'Authenticated user email is required'::TEXT, NULL::UUID, NULL::TEXT;
    RETURN;
  END IF;

  IF v_normalized_user_email = '' OR v_normalized_user_email <> v_normalized_profile_email THEN
    RETURN QUERY SELECT FALSE, 'Authenticated user email does not match profile email'::TEXT, NULL::UUID, NULL::TEXT;
    RETURN;
  END IF;

  IF v_normalized_invite_email <> v_normalized_profile_email THEN
    RETURN QUERY SELECT FALSE, 'Invite email does not match authenticated user'::TEXT, NULL::UUID, NULL::TEXT;
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

GRANT EXECUTE ON FUNCTION public.accept_team_invite_atomic(TEXT, UUID, TEXT) TO authenticated;
