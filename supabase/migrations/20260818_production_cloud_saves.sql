-- ============================================================================
-- NeuroArena 2.0 Production Cloud Save & Player Identity Migration
-- Table: player_cloud_saves
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.player_cloud_saves (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL DEFAULT 'NeuralTrainer',
    auth_provider TEXT NOT NULL DEFAULT 'guest',
    save_version INT NOT NULL DEFAULT 2,
    unlocked_biomes BOOLEAN[] NOT NULL DEFAULT '{true, false, false, false, false, false}',
    max_biome_index INT NOT NULL DEFAULT 0,
    crystal_count_x INT NOT NULL DEFAULT 0,
    shard_count_y INT NOT NULL DEFAULT 0,
    kernel_count_z INT NOT NULL DEFAULT 0,
    total_harvested INT NOT NULL DEFAULT 0,
    trained_models JSONB NOT NULL DEFAULT '[]'::jsonb,
    active_model_config JSONB DEFAULT NULL,
    save_data_payload TEXT NOT NULL,
    checksum TEXT NOT NULL,
    client_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    server_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indices for fast lookups
CREATE INDEX IF NOT EXISTS idx_player_cloud_saves_user_id ON public.player_cloud_saves (user_id);
CREATE INDEX IF NOT EXISTS idx_player_cloud_saves_synced_at ON public.player_cloud_saves (server_synced_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.player_cloud_saves ENABLE ROW LEVEL SECURITY;

-- Allow anonymous & authenticated users to read their own cloud save
CREATE POLICY "Allow users to read their own cloud save"
    ON public.player_cloud_saves
    FOR SELECT
    USING (auth.uid()::text = user_id OR user_id = current_setting('request.jwt.claim.sub', true));

-- Allow users to insert / upsert their own cloud save
CREATE POLICY "Allow users to upsert their own cloud save"
    ON public.player_cloud_saves
    FOR ALL
    USING (auth.uid()::text = user_id OR user_id = current_setting('request.jwt.claim.sub', true))
    WITH CHECK (auth.uid()::text = user_id OR user_id = current_setting('request.jwt.claim.sub', true));

-- Trigger for automatic server_synced_at update on mutation
CREATE OR REPLACE FUNCTION public.handle_cloud_save_sync()
RETURNS TRIGGER AS $$
BEGIN
    NEW.server_synced_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_cloud_save_synced ON public.player_cloud_saves;
CREATE TRIGGER tr_cloud_save_synced
    BEFORE UPDATE ON public.player_cloud_saves
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_cloud_save_sync();
