-- =============================================================================
-- Use a CSPRNG (pgcrypto gen_random_bytes) for all security-sensitive tokens.
--
-- Previously these functions built tokens with random(), which is a
-- non-cryptographic PRNG whose output is predictable. This migration also
-- repairs generate_invite_token: it had already been switched to
-- gen_random_bytes but called it unqualified while running with
-- search_path = '', so every invocation raised "function does not exist".
-- pgcrypto lives in the extensions schema on Supabase, hence the
-- extensions.gen_random_bytes qualification below.
--
-- All signatures and output formats are preserved except token length:
-- generate_secure_token and generate_invite_token now emit 48 hex chars
-- (192 bits) after the prefix instead of 32 alphanumerics. Tokens are
-- opaque TEXT values with no format validation on any caller.
-- =============================================================================

-- Device-flow user code: 8 chars from a 32-char unambiguous alphabet,
-- formatted XXXX-XXXX. 32 divides 256 evenly, so byte % 32 is unbiased.
CREATE OR REPLACE FUNCTION public.generate_user_code()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path TO ''
AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';  -- Removed confusing chars (0, O, 1, I)
  bytes BYTEA := extensions.gen_random_bytes(8);
  code TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 0..7 LOOP
    code := code || substr(chars, get_byte(bytes, i) % 32 + 1, 1);
  END LOOP;
  -- Format as XXXX-XXXX for readability
  RETURN substr(code, 1, 4) || '-' || substr(code, 5, 4);
END;
$$;

-- Opaque bearer tokens (device codes 'dev_', access tokens 'uni_',
-- refresh tokens 'unr_'): prefix + 48 hex chars = 192 bits of entropy.
CREATE OR REPLACE FUNCTION public.generate_secure_token(prefix TEXT DEFAULT '')
RETURNS TEXT
LANGUAGE plpgsql
SET search_path TO ''
AS $$
BEGIN
  RETURN prefix || encode(extensions.gen_random_bytes(24), 'hex');
END;
$$;

-- Team invite tokens: 'inv_' + 48 hex chars.
CREATE OR REPLACE FUNCTION public.generate_invite_token()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path TO ''
AS $$
BEGIN
  RETURN 'inv_' || encode(extensions.gen_random_bytes(24), 'hex');
END;
$$;

-- Public share slugs: 8 chars of [a-z0-9]. 36 does not divide 256, so
-- rejection-sample (accept bytes < 252 = 7 * 36) to avoid modulo bias.
CREATE OR REPLACE FUNCTION public.generate_share_slug()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path TO ''
AS $$
DECLARE
  chars TEXT := 'abcdefghijklmnopqrstuvwxyz0123456789';
  slug TEXT := '';
  b INTEGER;
BEGIN
  WHILE length(slug) < 8 LOOP
    b := get_byte(extensions.gen_random_bytes(1), 0);
    IF b < 252 THEN
      slug := slug || substr(chars, (b % 36) + 1, 1);
    END IF;
  END LOOP;
  RETURN slug;
END;
$$;
