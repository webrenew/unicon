-- Add logo_url column to teams
ALTER TABLE teams ADD COLUMN logo_url TEXT;

-- Create team-logos storage bucket (public so logos display without auth)
INSERT INTO storage.buckets (id, name, public)
VALUES ('team-logos', 'team-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies for team-logos bucket

-- Anyone can view team logos (public bucket)
CREATE POLICY "team_logos_select"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'team-logos');

-- Team owners/admins can upload logos (path: {team_id}/*)
CREATE POLICY "team_logos_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'team-logos'
    AND EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = (storage.foldername(name))[1]::uuid
        AND team_members.user_id = auth.uid()
        AND team_members.role IN ('owner', 'admin')
    )
  );

-- Team owners/admins can update logos
CREATE POLICY "team_logos_update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'team-logos'
    AND EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = (storage.foldername(name))[1]::uuid
        AND team_members.user_id = auth.uid()
        AND team_members.role IN ('owner', 'admin')
    )
  );

-- Team owners/admins can delete logos
CREATE POLICY "team_logos_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'team-logos'
    AND EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = (storage.foldername(name))[1]::uuid
        AND team_members.user_id = auth.uid()
        AND team_members.role IN ('owner', 'admin')
    )
  );
