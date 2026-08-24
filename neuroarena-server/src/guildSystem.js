/**
 * Guild & Clan Faction Warfare Engine for NeuroArena Server.
 * Supports team creation, role hierarchies, shared tech/perk trees,
 * seasonal trophy scoring, and guild war declarations.
 */
class GuildEngine {
  constructor() {
    this.guilds = new Map(); // guildId -> guildObject
    this.playerGuildMap = new Map(); // playerId -> guildId
  }

  createGuild(guildId, guildName, leaderId, tag = 'NEURO') {
    if (this.guilds.has(guildId)) {
      throw new Error(`Guild ${guildId} already exists`);
    }
    if (this.playerGuildMap.has(leaderId)) {
      throw new Error(`Player ${leaderId} is already in a guild`);
    }

    const guild = {
      id: guildId,
      name: guildName,
      tag: tag.toUpperCase(),
      level: 1,
      exp: 0,
      treasuryGold: 0,
      trophies: 0,
      members: new Map([[leaderId, { role: 'LEADER', joinedAt: Date.now(), contribution: 0 }]]),
      unlockedPerks: new Set(['BASE_EXP_BOOST']),
      warRecord: { wins: 0, losses: 0, draws: 0 }
    };

    this.guilds.set(guildId, guild);
    this.playerGuildMap.set(leaderId, guildId);
    return guild;
  }

  addMember(guildId, playerId, role = 'MEMBER') {
    const guild = this.guilds.get(guildId);
    if (!guild) throw new Error('Guild not found');
    if (this.playerGuildMap.has(playerId)) throw new Error('Player already in a guild');
    if (guild.members.size >= 50) throw new Error('Guild roster is full (max 50)');

    guild.members.set(playerId, { role, joinedAt: Date.now(), contribution: 0 });
    this.playerGuildMap.set(playerId, guildId);
    return true;
  }

  contributeExp(playerId, expAmount) {
    const guildId = this.playerGuildMap.get(playerId);
    if (!guildId) return null;
    const guild = this.guilds.get(guildId);
    if (!guild) return null;

    const member = guild.members.get(playerId);
    if (member) member.contribution += expAmount;

    guild.exp += expAmount;
    const expNeeded = guild.level * 1000;
    while (guild.exp >= expNeeded) {
      guild.exp -= expNeeded;
      guild.level++;
      this.checkPerkUnlocks(guild);
    }
    return { level: guild.level, exp: guild.exp };
  }

  checkPerkUnlocks(guild) {
    if (guild.level >= 3) guild.unlockedPerks.add('BURST_TRAIN_COOLDOWN_REDUCTION');
    if (guild.level >= 5) guild.unlockedPerks.add('CLOUD_SAVE_EXTRA_SLOT');
    if (guild.level >= 10) guild.unlockedPerks.add('ARENA_FACTION_AURA');
  }

  recordWarVictory(winningGuildId, losingGuildId, trophyReward = 25) {
    const winner = this.guilds.get(winningGuildId);
    const loser = this.guilds.get(losingGuildId);

    if (winner) {
      winner.trophies += trophyReward;
      winner.warRecord.wins++;
    }
    if (loser) {
      loser.trophies = Math.max(0, loser.trophies - Math.floor(trophyReward * 0.5));
      loser.warRecord.losses++;
    }
  }

  getGuildSummary(guildId) {
    const guild = this.guilds.get(guildId);
    if (!guild) return null;

    return {
      id: guild.id,
      name: guild.name,
      tag: guild.tag,
      level: guild.level,
      memberCount: guild.members.size,
      trophies: guild.trophies,
      unlockedPerks: Array.from(guild.unlockedPerks),
      warRecord: guild.warRecord
    };
  }
}

module.exports = { GuildEngine };
