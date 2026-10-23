-- Persistent Stripe webhook idempotency tracking across instances/retries

CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  event_id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'processed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_status_attempt
  ON public.stripe_webhook_events (status, last_attempt_at);

ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

-- Service-role only access in app code; block direct client access.
DROP POLICY IF EXISTS "No direct access to webhook events" ON public.stripe_webhook_events;
CREATE POLICY "No direct access to webhook events"
  ON public.stripe_webhook_events
  FOR ALL
  USING (FALSE)
  WITH CHECK (FALSE);
