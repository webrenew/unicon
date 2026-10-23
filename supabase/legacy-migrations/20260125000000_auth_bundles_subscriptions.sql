-- Unicon Auth, Bundles & Subscriptions Schema
-- Run this migration in Supabase SQL Editor

-- =============================================================================
-- PROFILES TABLE
-- Extends auth.users with additional profile data
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policies for profiles
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- =============================================================================
-- SUBSCRIPTIONS TABLE
-- Tracks user subscription status and plan
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('active', 'canceled', 'past_due')) DEFAULT 'active',
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro')),
  provider TEXT, -- 'stripe'
  provider_subscription_id TEXT,
  provider_customer_id TEXT,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Policies for subscriptions
CREATE POLICY "Users can view their own subscription" ON public.subscriptions
  FOR SELECT USING (auth.uid() = user_id);

-- =============================================================================
-- BUNDLES TABLE
-- Saved icon bundles with cloud storage
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.bundles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_public BOOLEAN DEFAULT FALSE,
  share_slug TEXT UNIQUE,
  stroke_preset TEXT, -- 'normal', 'thin', 'thick'
  normalize_strokes BOOLEAN DEFAULT FALSE,
  target_stroke_width NUMERIC(3,1),
  icons JSONB NOT NULL DEFAULT '[]',
  icon_count INTEGER GENERATED ALWAYS AS (jsonb_array_length(icons)) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.bundles ENABLE ROW LEVEL SECURITY;

-- Create index for faster lookups
CREATE INDEX idx_bundles_user_id ON public.bundles(user_id);
CREATE INDEX idx_bundles_share_slug ON public.bundles(share_slug) WHERE share_slug IS NOT NULL;
CREATE INDEX idx_bundles_is_public ON public.bundles(is_public) WHERE is_public = TRUE;

-- Policies for bundles
CREATE POLICY "Users can view their own bundles" ON public.bundles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view public bundles" ON public.bundles
  FOR SELECT USING (is_public = TRUE);

CREATE POLICY "Users can create their own bundles" ON public.bundles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own bundles" ON public.bundles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own bundles" ON public.bundles
  FOR DELETE USING (auth.uid() = user_id);

-- =============================================================================
-- FUNCTIONS & TRIGGERS
-- =============================================================================

-- Function to handle new user signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Create profile
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture')
  );

  -- Create free subscription
  INSERT INTO public.subscriptions (user_id, status, plan)
  VALUES (NEW.id, 'active', 'free');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile + subscription on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for bundles updated_at
DROP TRIGGER IF EXISTS update_bundles_updated_at ON public.bundles;
CREATE TRIGGER update_bundles_updated_at
  BEFORE UPDATE ON public.bundles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Trigger for subscriptions updated_at
DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Function to generate a unique share slug
CREATE OR REPLACE FUNCTION public.generate_share_slug()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'abcdefghijklmnopqrstuvwxyz0123456789';
  slug TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..8 LOOP
    slug := slug || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN slug;
END;
$$ LANGUAGE plpgsql;

-- Function to get bundle count for a user (for free tier limit check)
CREATE OR REPLACE FUNCTION public.get_user_bundle_count(p_user_id UUID)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER FROM public.bundles WHERE user_id = p_user_id;
$$ LANGUAGE sql SECURITY DEFINER;

-- Function to check if user can create more bundles
CREATE OR REPLACE FUNCTION public.can_create_bundle(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_plan TEXT;
  v_bundle_count INTEGER;
BEGIN
  -- Get user's plan
  SELECT plan INTO v_plan FROM public.subscriptions WHERE user_id = p_user_id;

  -- Pro users have unlimited bundles
  IF v_plan = 'pro' THEN
    RETURN TRUE;
  END IF;

  -- Free users limited to 3 bundles
  SELECT COUNT(*)::INTEGER INTO v_bundle_count FROM public.bundles WHERE user_id = p_user_id;

  RETURN v_bundle_count < 3;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
