-- ============================================================================
-- NeuroArena Seasonal Ranked & Cross-Progression Schema (Supabase PostgreSQL)
-- Tables: player_ranked_profiles, seasonal_leaderboard_archives, account_cosmetics
-- ============================================================================

-- 1. CROSS-PLATFORM PLAYER RANKED PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.player_ranked_profiles (
    account_id TEXT PRIMARY KEY, -- Supabase Auth User ID or Guest UUID
    player_name TEXT NOT NULL,
    character_build TEXT DEFAULT 'scholar',
    season_id TEXT NOT NULL DEFAULT 'season_1',
    rating INT NOT NULL DEFAULT 1500,
    rd NUMERIC(6, 2) NOT NULL DEFAULT 350.00,
    volatility NUMERIC(6, 4) NOT NULL DEFAULT 0.0600,
    tier TEXT NOT NULL DEFAULT 'BRONZE',
    highest_tier TEXT NOT NULL DEFAULT 'BRONZE',
    wins INT NOT NULL DEFAULT 0,
    losses INT NOT NULL DEFAULT 0,
    draws INT NOT NULL DEFAULT 0,
    total_matches INT NOT NULL DEFAULT 0,
    quantum_shards INT NOT NULL DEFAULT 0,
    guild_id TEXT DEFAULT NULL,
    active_title TEXT DEFAULT 'Novice Gradient',
    unlocked_titles JSONB NOT NULL DEFAULT '["Novice Gradient"]'::jsonb,
    unlocked_cosmetics JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_player_ranked_season_rating ON public.player_ranked_profiles (season_id, rating DESC);
CREATE INDEX IF NOT EXISTS idx_player_ranked_account_id ON public.player_ranked_profiles (account_id);

-- 2. SEASONAL LEADERBOARD ARCHIVES TABLE
CREATE TABLE IF NOT EXISTS public.seasonal_leaderboard_archives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    season_id TEXT NOT NULL,
    season_number INT NOT NULL,
    season_name TEXT NOT NULL,
    duration_weeks INT NOT NULL DEFAULT 6,
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    total_participants INT NOT NULL DEFAULT 0,
    top_100_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_seasonal_archives_season ON public.seasonal_leaderboard_archives (season_id);

-- 3. RLS POLICIES FOR CROSS-PROGRESSION
ALTER TABLE public.player_ranked_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seasonal_leaderboard_archives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read for ranked profiles and archives"
    ON public.player_ranked_profiles FOR SELECT USING (true);

CREATE POLICY "Allow public read for season archives"
    ON public.seasonal_leaderboard_archives FOR SELECT USING (true);

CREATE POLICY "Allow service role full access on player ranked"
    ON public.player_ranked_profiles FOR ALL TO service_role USING (true);

CREATE POLICY "Allow service role full access on season archives"
    ON public.seasonal_leaderboard_archives FOR ALL TO service_role USING (true);
