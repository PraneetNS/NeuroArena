-- ============================================================================
-- NeuroArena 2.0 Privacy-Conscious Telemetry & Event Analytics Migration
-- Table: analytics_events
-- Analytical Functions: get_tutorial_funnel_summary, get_player_retention_summary, get_biome_completion_summary
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.analytics_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT NOT NULL,
    player_id TEXT NOT NULL,
    is_guest BOOLEAN NOT NULL DEFAULT true,
    event_name TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    client_platform TEXT NOT NULL DEFAULT 'web',
    client_version TEXT NOT NULL DEFAULT '1.0.0',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fast lookup & range indices
CREATE INDEX IF NOT EXISTS idx_analytics_events_name_created ON public.analytics_events (event_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_player_created ON public.analytics_events (player_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_session ON public.analytics_events (session_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created ON public.analytics_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_payload_gin ON public.analytics_events USING GIN (payload);

-- Enable Row Level Security (RLS)
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- Allow anonymous and authenticated clients to insert event telemetry (Write-only for clients)
CREATE POLICY "Allow public insert for telemetry events"
    ON public.analytics_events
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

-- Allow service role / admin to read analytics events
CREATE POLICY "Allow service role read for analytics"
    ON public.analytics_events
    FOR SELECT
    TO service_role
    USING (true);

-- ============================================================================
-- Analytical Helper Functions
-- ============================================================================

-- 1. Tutorial Funnel Drop-off Summary Function
CREATE OR REPLACE FUNCTION public.get_tutorial_funnel_summary()
RETURNS TABLE (
    total_starters BIGINT,
    harvest_completed BIGINT,
    live_fit_viewed BIGINT,
    challenge_completed BIGINT,
    aha_moment_reached BIGINT,
    tutorial_completed BIGINT,
    completion_rate_pct NUMERIC
) AS $$
DECLARE
    v_starters BIGINT;
    v_harvest BIGINT;
    v_livefit BIGINT;
    v_challenge BIGINT;
    v_aha BIGINT;
    v_completed BIGINT;
    v_rate NUMERIC;
BEGIN
    SELECT COUNT(DISTINCT player_id) INTO v_starters 
    FROM public.analytics_events 
    WHERE event_name IN ('session_start', 'ftue_session_started', 'tutorial_step_harvest_started');

    SELECT COUNT(DISTINCT player_id) INTO v_harvest 
    FROM public.analytics_events 
    WHERE event_name IN ('tutorial_step_harvest_completed', 'tutorial_step');

    SELECT COUNT(DISTINCT player_id) INTO v_livefit 
    FROM public.analytics_events 
    WHERE event_name IN ('tutorial_step_livefit_viewed', 'tutorial_step');

    SELECT COUNT(DISTINCT player_id) INTO v_challenge 
    FROM public.analytics_events 
    WHERE event_name IN ('tutorial_step_challenge_completed', 'tutorial_step');

    SELECT COUNT(DISTINCT player_id) INTO v_aha 
    FROM public.analytics_events 
    WHERE event_name = 'ftue_first_aha_reached';

    SELECT COUNT(DISTINCT player_id) INTO v_completed 
    FROM public.analytics_events 
    WHERE event_name = 'tutorial_completed';

    IF v_starters > 0 THEN
        v_rate := ROUND((v_completed::numeric / v_starters::numeric) * 100.0, 1);
    ELSE
        v_rate := 0.0;
    END IF;

    RETURN QUERY SELECT 
        COALESCE(v_starters, 0),
        COALESCE(v_harvest, 0),
        COALESCE(v_livefit, 0),
        COALESCE(v_challenge, 0),
        COALESCE(v_aha, 0),
        COALESCE(v_completed, 0),
        v_rate;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. D1 / D7 / D30 Player Retention Analysis Function
CREATE OR REPLACE FUNCTION public.get_player_retention_summary()
RETURNS TABLE (
    total_cohort_players BIGINT,
    d1_eligible BIGINT,
    d1_retained BIGINT,
    d1_retention_pct NUMERIC,
    d7_eligible BIGINT,
    d7_retained BIGINT,
    d7_retention_pct NUMERIC,
    d30_eligible BIGINT,
    d30_retained BIGINT,
    d30_retention_pct NUMERIC
) AS $$
WITH player_first_days AS (
    SELECT player_id, MIN(DATE(created_at)) AS first_date
    FROM public.analytics_events
    GROUP BY player_id
),
player_active_days AS (
    SELECT DISTINCT player_id, DATE(created_at) AS active_date
    FROM public.analytics_events
),
retention_diffs AS (
    SELECT 
        f.player_id,
        f.first_date,
        (CURRENT_DATE - f.first_date) AS days_since_join,
        MAX(CASE WHEN (a.active_date - f.first_date) = 1 THEN 1 ELSE 0 END) AS has_d1,
        MAX(CASE WHEN (a.active_date - f.first_date) BETWEEN 6 AND 8 THEN 1 ELSE 0 END) AS has_d7,
        MAX(CASE WHEN (a.active_date - f.first_date) BETWEEN 28 AND 32 THEN 1 ELSE 0 END) AS has_d30
    FROM player_first_days f
    JOIN player_active_days a ON f.player_id = a.player_id
    GROUP BY f.player_id, f.first_date
)
SELECT 
    COUNT(player_id) AS total_cohort_players,
    COUNT(CASE WHEN days_since_join >= 1 THEN 1 END) AS d1_eligible,
    SUM(CASE WHEN days_since_join >= 1 THEN has_d1 ELSE 0 END) AS d1_retained,
    COALESCE(ROUND((SUM(CASE WHEN days_since_join >= 1 THEN has_d1 ELSE 0 END)::numeric / NULLIF(COUNT(CASE WHEN days_since_join >= 1 THEN 1 END), 0)) * 100.0, 1), 0.0) AS d1_retention_pct,
    COUNT(CASE WHEN days_since_join >= 7 THEN 1 END) AS d7_eligible,
    SUM(CASE WHEN days_since_join >= 7 THEN has_d7 ELSE 0 END) AS d7_retained,
    COALESCE(ROUND((SUM(CASE WHEN days_since_join >= 7 THEN has_d7 ELSE 0 END)::numeric / NULLIF(COUNT(CASE WHEN days_since_join >= 7 THEN 1 END), 0)) * 100.0, 1), 0.0) AS d7_retention_pct,
    COUNT(CASE WHEN days_since_join >= 30 THEN 1 END) AS d30_eligible,
    SUM(CASE WHEN days_since_join >= 30 THEN has_d30 ELSE 0 END) AS d30_retained,
    COALESCE(ROUND((SUM(CASE WHEN days_since_join >= 30 THEN has_d30 ELSE 0 END)::numeric / NULLIF(COUNT(CASE WHEN days_since_join >= 30 THEN 1 END), 0)) * 100.0, 1), 0.0) AS d30_retention_pct
FROM retention_diffs;
$$ LANGUAGE sql SECURITY DEFINER;
