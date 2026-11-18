/**
 * Glicko-2 Skill-Based Rating & Dynamic Bracket Matchmaker for NeuroArena.
 * Implements Mark Glickman's Glicko-2 algorithm with Rating, Rating Deviation (RD),
 * and Volatility (sigma) alongside queue expansion windows and party MMR balancing.
 */
class Glicko2Engine {
  constructor(tau = 0.5) {
    this.tau = tau; // System constant governing volatility change over time
    this.SCALE = 173.7178;
  }

  // Convert standard scale (1500, 350) to Glicko-2 scale (mu, phi)
  toGlicko2(rating = 1500, rd = 350, vol = 0.06) {
    return {
      mu: (rating - 1500) / this.SCALE,
      phi: rd / this.SCALE,
      sigma: vol
    };
  }

  // Convert Glicko-2 scale back to standard scale
  toStandard(mu, phi, sigma) {
    return {
      rating: Math.round(mu * this.SCALE + 1500),
      rd: Math.round(phi * this.SCALE),
      volatility: sigma
    };
  }

  g(phi) {
    return 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI));
  }

  E(mu, mu_j, phi_j) {
    return 1 / (1 + Math.exp(-this.g(phi_j) * (mu - mu_j)));
  }

  /**
   * Update a player's rating after match outcomes against opponents
   * @param {{ rating: number, rd: number, vol?: number }} player
   * @param {Array<{ rating: number, rd: number, score: number }>} matches (score: 1 = win, 0.5 = draw, 0 = loss)
   */
  updateRating(player, matches) {
    const p = this.toGlicko2(player.rating, player.rd, player.vol || 0.06);

    if (!matches || matches.length === 0) {
      // Inactivity step: increase RD according to volatility
      const phiPrime = Math.sqrt(p.phi * p.phi + p.sigma * p.sigma);
      return this.toStandard(p.mu, phiPrime, p.sigma);
    }

    let vInv = 0;
    let deltaSum = 0;

    for (const m of matches) {
      const opp = this.toGlicko2(m.rating, m.rd);
      const gPhi = this.g(opp.phi);
      const expScore = this.E(p.mu, opp.mu, opp.phi);

      vInv += gPhi * gPhi * expScore * (1 - expScore);
      deltaSum += gPhi * (m.score - expScore);
    }

    const v = 1 / vInv;
    const delta = v * deltaSum;

    // Step 5: Determine new volatility sigma' using Illinois/Newton-Raphson approximation
    const a = Math.log(p.sigma * p.sigma);
    const tauSq = this.tau * this.tau;

    const f = (x) => {
      const ex = Math.exp(x);
      const dSq = delta * delta;
      const phiSq = p.phi * p.phi;
      const term1 = (ex * (dSq - phiSq - v - ex)) / (2 * Math.pow(phiSq + v + ex, 2));
      const term2 = (x - a) / tauSq;
      return term1 - term2;
    };

    let A = a;
    let B;
    if (delta * delta > p.phi * p.phi + v) {
      B = Math.log(delta * delta - p.phi * p.phi - v);
    } else {
      let k = 1;
      while (f(a - k * this.tau) < 0) {
        k++;
      }
      B = a - k * this.tau;
    }

    let fA = f(A);
    let fB = f(B);

    while (Math.abs(B - A) > 0.000001) {
      const C = A + ((A - B) * fA) / (fB - fA);
      const fC = f(C);
      if (fC * fB < 0) {
        A = B;
        fA = fB;
      } else {
        fA = fA / 2;
      }
      B = C;
      fB = fC;
    }

    const sigmaPrime = Math.exp(A / 2);

    // Step 6: Update rating deviation to new pre-rating period value
    const phiStar = Math.sqrt(p.phi * p.phi + sigmaPrime * sigmaPrime);

    // Step 7: Update rating and RD to new values
    const phiPrime = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);
    const muPrime = p.mu + phiPrime * phiPrime * deltaSum;

    return this.toStandard(muPrime, phiPrime, sigmaPrime);
  }

  /**
   * Calculates Matchmaking Search Bracket Range based on queue wait time
   * @param {number} baseRating
   * @param {number} rd
   * @param {number} waitTimeSeconds
   */
  getSearchRange(baseRating, rd, waitTimeSeconds) {
    const baseBand = Math.max(50, rd * 0.75);
    const expansion = Math.min(400, waitTimeSeconds * 12);
    return {
      minRating: Math.max(0, Math.round(baseRating - baseBand - expansion)),
      maxRating: Math.round(baseRating + baseBand + expansion),
      currentBand: Math.round(baseBand + expansion)
    };
  }

  /**
   * Region-aware matchmaking eligibility with 3-tier time decay relaxation:
   * - 0 to 10s: Strict regional isolation (lowest latency)
   * - 10 to 25s: Adjacent regional pool relaxation (acceptable latency)
   * - 25s+: Global fallback (guarantees match within ~30s worst-case)
   * @param {string} region1
   * @param {string} region2
   * @param {number} waitTimeSeconds
   */
  getRegionMatchEligibility(region1 = 'us-east', region2 = 'us-east', waitTimeSeconds = 0) {
    if (region1 === region2) return true;

    // After 25 seconds of waiting, open to global pool
    if (waitTimeSeconds >= 25) return true;

    // Between 10 and 25 seconds, allow adjacent region pairing
    if (waitTimeSeconds >= 10) {
      const adjacentMap = {
        'us-east': ['us-west', 'sa-east', 'eu-west'],
        'us-west': ['us-east', 'ap-northeast'],
        'eu-central': ['eu-west', 'us-east'],
        'eu-west': ['eu-central', 'us-east'],
        'ap-southeast': ['ap-northeast', 'eu-central'],
        'ap-northeast': ['ap-southeast', 'us-west'],
        'sa-east': ['us-east']
      };

      const adjacent = adjacentMap[region1] || [];
      return adjacent.includes(region2);
    }

    // Under 10s: strict region isolation
    return false;
  }
}

module.exports = { Glicko2Engine };
