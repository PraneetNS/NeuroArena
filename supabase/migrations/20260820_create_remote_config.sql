-- ============================================================================
-- NeuroArena 2.0 Remote Configuration & Balance Tuning Migration
-- Tables: remote_config_active, remote_config_history
-- Functions: publish_remote_config, rollback_remote_config
-- ============================================================================

-- 1. Active Remote Configuration Table (Single Row Source of Truth)
CREATE TABLE IF NOT EXISTS public.remote_config_active (
    id INT PRIMARY KEY DEFAULT 1,
    version INT NOT NULL DEFAULT 1,
    schema_compatibility_version INT NOT NULL DEFAULT 3,
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT single_row_check CHECK (id = 1)
);

-- 2. Configuration Version History Table (Rollback & Audit Trail)
CREATE TABLE IF NOT EXISTS public.remote_config_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version INT NOT NULL,
    author TEXT NOT NULL DEFAULT 'system_admin',
    change_reason TEXT NOT NULL DEFAULT 'Balance update',
    config_snapshot JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_remote_config_history_version ON public.remote_config_history (version DESC);
CREATE INDEX IF NOT EXISTS idx_remote_config_history_created ON public.remote_config_history (created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.remote_config_active ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.remote_config_history ENABLE ROW LEVEL SECURITY;

-- Allow read access to clients for active config
CREATE POLICY "Allow public read for active remote config"
    ON public.remote_config_active
    FOR SELECT
    TO anon, authenticated, service_role
    USING (true);

-- Allow service role / admin to modify active config and write history
CREATE POLICY "Allow service role write for remote config"
    ON public.remote_config_active
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow service role all on history"
    ON public.remote_config_history
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Insert initial baseline configuration if empty
INSERT INTO public.remote_config_active (id, version, schema_compatibility_version, config, updated_at)
VALUES (
    1,
    1,
    3,
    '{
        "version": 1,
        "schemaCompatibilityVersion": 3,
        "maintenanceMode": false,
        "harvestBalance": {
            "baseYieldMultiplier": 1.0,
            "crystalSpawnMultiplier": 1.0,
            "shardDropRateMultiplier": 1.0,
            "burstHarvestDurationSec": 30.0,
            "burstHarvestMultiplier": 2.0
        },
        "bossTuning": {
            "overfit_hydra": { "maxHp": 500, "attackDamage": 25, "phaseThreshold": 0.50, "enrageTimerSec": 90 },
            "variance_golem": { "maxHp": 850, "attackDamage": 40, "phaseThreshold": 0.40, "enrageTimerSec": 120 },
            "gradient_titan": { "maxHp": 1500, "attackDamage": 65, "phaseThreshold": 0.33, "enrageTimerSec": 150 },
            "deep_synapse_core": { "maxHp": 2500, "attackDamage": 90, "phaseThreshold": 0.25, "enrageTimerSec": 180 }
        },
        "dailyChallengeTuning": {
            "baseRewardCrystals": 150,
            "bonusMasteryExp": 300,
            "targetMseThreshold": 0.08,
            "maxAllowedSteps": 100,
            "streakMultiplierCap": 3.0
        },
        "liveOpsEventSlot": {
            "id": "modifier_harvest_weekend",
            "title": "2x Harvest Yield & Compute Surge Weekend",
            "type": "HARVEST_MULTIPLIER",
            "active": false,
            "multiplier": 2.0,
            "rotatingBoss": "The Overfit Colossus (Empowered)",
            "bannerColor": "#F59E0B"
        },
        "featureFlags": {
            "dailyChallengesEnabled": true,
            "weeklyGuildObjectivesEnabled": true,
            "pvpDuelsEnabled": true,
            "federatedLearningEnabled": true,
            "telemetryEnabled": true
        }
    }'::jsonb,
    NOW()
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 3. Stored SQL Procedures for Atomic Publish & Rollback
-- ============================================================================

-- Function: Publish Remote Config
CREATE OR REPLACE FUNCTION public.publish_remote_config(
    p_config JSONB,
    p_author TEXT DEFAULT 'designer_admin',
    p_change_reason TEXT DEFAULT 'Balance tuning update'
)
RETURNS JSONB AS $$
DECLARE
    v_new_version INT;
    v_updated_config JSONB;
BEGIN
    SELECT (version + 1) INTO v_new_version FROM public.remote_config_active WHERE id = 1;
    IF v_new_version IS NULL THEN
        v_new_version := 1;
    END IF;

    v_updated_config := p_config || jsonb_build_object(
        'version', v_new_version,
        'schemaCompatibilityVersion', 3,
        'lastUpdatedAt', NOW()
    );

    -- Update active configuration
    INSERT INTO public.remote_config_active (id, version, schema_compatibility_version, config, updated_at)
    VALUES (1, v_new_version, 3, v_updated_config, NOW())
    ON CONFLICT (id) DO UPDATE
    SET version = v_new_version,
        config = v_updated_config,
        updated_at = NOW();

    -- Record into history audit trail
    INSERT INTO public.remote_config_history (version, author, change_reason, config_snapshot, created_at)
    VALUES (v_new_version, p_author, p_change_reason, v_updated_config, NOW());

    RETURN jsonb_build_object(
        'success', true,
        'version', v_new_version,
        'updatedAt', NOW()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: One-Action Rollback to Target Version
CREATE OR REPLACE FUNCTION public.rollback_remote_config(
    p_target_version INT,
    p_author TEXT DEFAULT 'rollback_admin'
)
RETURNS JSONB AS $$
DECLARE
    v_snapshot JSONB;
    v_new_version INT;
    v_restored_config JSONB;
BEGIN
    -- Look up target version snapshot
    SELECT config_snapshot INTO v_snapshot
    FROM public.remote_config_history
    WHERE version = p_target_version
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_snapshot IS NULL THEN
        RAISE EXCEPTION 'Rollback failed: Version % not found in history.', p_target_version;
    END IF;

    SELECT (version + 1) INTO v_new_version FROM public.remote_config_active WHERE id = 1;

    v_restored_config := v_snapshot || jsonb_build_object(
        'version', v_new_version,
        'schemaCompatibilityVersion', 3,
        'lastUpdatedAt', NOW()
    );

    -- Set active config
    UPDATE public.remote_config_active
    SET version = v_new_version,
        config = v_restored_config,
        updated_at = NOW()
    WHERE id = 1;

    -- Record rollback in history
    INSERT INTO public.remote_config_history (version, author, change_reason, config_snapshot, created_at)
    VALUES (
        v_new_version,
        p_author,
        format('Rollback to Version %s', p_target_version),
        v_restored_config,
        NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'rolledBackTo', p_target_version,
        'newVersion', v_new_version,
        'updatedAt', NOW()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
