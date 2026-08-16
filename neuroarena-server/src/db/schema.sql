-- ============================================================================
-- NeuroArena Leaderboards & Scores Schema (Supabase PostgreSQL)
-- Stores 1v1 Live Duel Results and Daily Seeded Challenge Scores keyed to account_id
-- ============================================================================

-- 1. 1v1 DUEL RESULTS TABLE
CREATE TABLE IF NOT EXISTS public.duel_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id TEXT NOT NULL, -- Keyed to Supabase User ID or Guest UUID
    player_name TEXT NOT NULL,
    character_build TEXT DEFAULT 'explorer',
    score INT DEFAULT 1200,   -- Competitive ELO / Rating
    wins INT DEFAULT 0,
    losses INT DEFAULT 0,
    draws INT DEFAULT 0,
    accuracy NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    mse_loss NUMERIC(8, 5) NOT NULL DEFAULT 999.00000,
    weights_w NUMERIC(8, 4) DEFAULT 0.0000,
    weights_b NUMERIC(8, 4) DEFAULT 0.0000,
    last_match_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- Index for fast account lookup and top-ranked leaderboard sorting
CREATE INDEX IF NOT EXISTS idx_duel_results_account_id ON public.duel_results (account_id);
CREATE INDEX IF NOT EXISTS idx_duel_results_ranking ON public.duel_results (score DESC, accuracy DESC, mse_loss ASC);

-- 2. DAILY CHALLENGE SCORES TABLE
CREATE TABLE IF NOT EXISTS public.daily_challenge_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id TEXT NOT NULL,
    player_name TEXT NOT NULL,
    character_build TEXT DEFAULT 'explorer',
    challenge_date DATE NOT NULL DEFAULT CURRENT_DATE,
    seed TEXT NOT NULL,
    score INT NOT NULL DEFAULT 0,
    accuracy NUMERIC(5, 2) NOT NULL,
    mse_loss NUMERIC(8, 5) NOT NULL,
    completion_time_sec NUMERIC(6, 2) DEFAULT 0.0,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_account_daily_entry UNIQUE (account_id, challenge_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_challenge_scores_date ON public.daily_challenge_scores (challenge_date, score DESC, accuracy DESC);

-- 3. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.duel_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_challenge_scores ENABLE ROW LEVEL SECURITY;

-- Allow anyone (including anonymous guests) to read leaderboards
CREATE POLICY "Allow public read access on duel_results"
    ON public.duel_results FOR SELECT USING (true);

CREATE POLICY "Allow public read access on daily_challenge_scores"
    ON public.daily_challenge_scores FOR SELECT USING (true);

-- Allow authenticated or guest users to insert/update their own scores
CREATE POLICY "Allow account write access on duel_results"
    ON public.duel_results FOR ALL USING (true);

CREATE POLICY "Allow account write access on daily_challenge_scores"
    ON public.daily_challenge_scores FOR ALL USING (true);
