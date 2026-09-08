/**
 * SeasonalRankedClient.js
 * Client-Side Seasonal Ranked, Tier League & Cross-Progression Manager for NeuroArena Web.
 * 
 * Features:
 * - Unified cross-platform account MMR & Tier synchronization.
 * - Local Juice triggering on Rank-Up moments (particles, hit-stop, camera shake, fanfares).
 * - Season standings and historical top 100 leaderboard viewer.
 * - End-of-season reward notifications.
 */

export class SeasonalRankedClient {
    constructor(options = {}) {
        this.endpointUrl = options.endpointUrl || "/api/ranked";
        this.activeProfile = null;
        this.activeSeason = null;
        this.listeners = [];
    }

    onUpdate(callback) {
        if (typeof callback === "function") {
            this.listeners.push(callback);
        }
    }

    _notify() {
        for (const cb of this.listeners) {
            try { cb(this.activeProfile, this.activeSeason); } catch (e) {}
        }
    }

    /**
     * Fetch player's cross-platform ranked profile
     */
    async fetchProfile(accountId, playerName = "Duelist", characterBuild = "scholar") {
        try {
            const res = await fetch(`${this.endpointUrl}/profile?accountId=${encodeURIComponent(accountId)}&name=${encodeURIComponent(playerName)}&build=${encodeURIComponent(characterBuild)}`);
            if (res.ok) {
                const data = await res.json();
                if (data.success && data.profile) {
                    this.activeProfile = data.profile;
                    this.activeSeason = data.season;
                    this._notify();
                    return this.activeProfile;
                }
            }
        } catch (err) {
            console.warn("[SeasonalRankedClient] Profile fetch error:", err);
        }
        return this.activeProfile;
    }

    /**
     * Fetch active season leaderboard
     */
    async fetchLeaderboard(limit = 100) {
        try {
            const res = await fetch(`${this.endpointUrl}/leaderboard?limit=${limit}`);
            if (res.ok) {
                return await res.json();
            }
        } catch (err) {
            console.warn("[SeasonalRankedClient] Leaderboard fetch error:", err);
        }
        return { success: false, leaderboard: [] };
    }

    /**
     * Fetch historical season archive (e.g. Season 1 Top 100)
     */
    async fetchArchivedSeason(seasonId) {
        try {
            const res = await fetch(`${this.endpointUrl}/seasons/${encodeURIComponent(seasonId)}/leaderboard`);
            if (res.ok) {
                return await res.json();
            }
        } catch (err) {
            console.warn("[SeasonalRankedClient] Archived season fetch error:", err);
        }
        return { success: false, archive: null };
    }

    /**
     * Evaluate and trigger Rank-Up Juice presentation on the client
     */
    triggerRankJuice(tierChangeData) {
        if (!tierChangeData || tierChangeData.type !== "RANK_UP") return;

        const juice = tierChangeData.juiceFeedback;
        console.log(`🎉 [RANK UP] Ascended from ${tierChangeData.fromTier} to ${tierChangeData.toTier}!`);

        if (typeof window !== "undefined") {
            // Trigger 3D GPU Particles
            if (window.NeuroParticles && typeof window.NeuroParticles.spawnJuiceBurst === "function") {
                window.NeuroParticles.spawnJuiceBurst({ x: 0, y: 1.5, z: 0 }, 150, juice.tierColorHex);
            }

            // Trigger Rank Banner Toast
            const toast = document.createElement("div");
            toast.className = "rank-up-banner-toast glow-cyan";
            toast.style.position = "fixed";
            toast.style.top = "15%";
            toast.style.left = "50%";
            toast.style.transform = "translateX(-50%)";
            toast.style.padding = "18px 32px";
            toast.style.background = "linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.95))";
            toast.style.border = `2px solid ${juice.tierColorHex || "#38bdf8"}`;
            toast.style.borderRadius = "12px";
            toast.style.boxShadow = `0 0 35px ${juice.tierColorHex || "#38bdf8"}`;
            toast.style.zIndex = "99999";
            toast.style.textAlign = "center";
            toast.innerHTML = `
                <div style="font-size:12px; color:#94a3b8; letter-spacing:2px; font-weight:700;">⭐ SEASONAL LEAGUE PROMOTION ⭐</div>
                <div style="font-size:24px; font-weight:900; color:${juice.tierColorHex || "#38bdf8"}; margin:6px 0;">RANK UP: ${tierChangeData.toTier}</div>
                <div style="font-size:13px; color:#e2e8f0;">Title Unlocked: <b>${juice.tierTitle || "Champion"}</b></div>
            `;
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 5000);
        }
    }
}

export const NeuroSeasonalRanked = new SeasonalRankedClient();
if (typeof window !== "undefined") {
    window.NeuroSeasonalRanked = NeuroSeasonalRanked;
}
