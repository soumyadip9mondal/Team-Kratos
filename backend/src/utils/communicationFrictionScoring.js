/**
 * Communication Friction Scoring Engine — SCORING_V1
 *
 * Fully deterministic server-side scoring algorithm.
 * The model NEVER outputs numbers — it only outputs concern types and severities.
 * All mathematical calculations, uplifts, and band assignments happen here.
 */

// ── Concern Taxonomy & Weights ──────────────────────────────────────────

const CONCERN_TAXONOMY = {
  Clarity: {
    weight: 0.25,
    types: [
      'AMBIGUOUS_ACTION',
      'AMBIGUOUS_OWNER',
      'AMBIGUOUS_TIMELINE',
      'MISSING_RATIONALE',
      'MISSING_ESCALATION_PATH',
    ],
  },
  Workload: {
    weight: 0.25,
    types: [
      'COMPRESSED_TIMELINE',
      'AFTER_HOURS_EXPECTATION',
      'UNPLANNED_SCOPE',
      'CAPACITY_RISK',
    ],
  },
  Fairness: {
    weight: 0.20,
    types: [
      'UNEQUAL_TREATMENT',
      'POTENTIALLY_EXCLUSIONARY_LANGUAGE',
      'COERCIVE_LANGUAGE',
      'POLICY_REVIEW_REQUIRED',
    ],
  },
  Delivery: {
    weight: 0.20,
    types: [
      'TESTING_RISK',
      'RELEASE_RISK',
      'SECURITY_RISK',
      'SAFETY_RISK',
      'CUSTOMER_IMPACT_RISK',
      'DEPENDENCY_RISK',
    ],
  },
  Tone: {
    weight: 0.10,
    types: [
      'BLAMING_LANGUAGE',
      'DISMISSIVE_LANGUAGE',
      'ALARMIST_TONE',
    ],
  },
};

// Map each concern type to its parent dimension
const TYPE_TO_DIMENSION = {};
for (const [dim, info] of Object.entries(CONCERN_TAXONOMY)) {
  for (const type of info.types) {
    TYPE_TO_DIMENSION[type] = dim;
  }
}

// ── Severity Base Scores ────────────────────────────────────────────────

const SEVERITY_BASE = {
  LOW: 20,
  MEDIUM: 40,
  HIGH: 65,
  CRITICAL: 85,
};

// ── Critical Uplift Types ───────────────────────────────────────────────

const CRITICAL_UPLIFT_TYPES = new Set([
  'AFTER_HOURS_EXPECTATION',
  'COERCIVE_LANGUAGE',
  'POTENTIALLY_EXCLUSIONARY_LANGUAGE',
  'SAFETY_RISK',
]);

// ── Core Scoring Function ───────────────────────────────────────────────

/**
 * Calculate deterministic SCORING_V1 result for a set of persona reactions.
 *
 * @param {Array<{ key: string, concerns: Array<{ type: string, severity: string }> }>} personaReactions
 * @returns {object} { overallFrictionScore, frictionBand, dimensionScores, perPersonaScores }
 */
function calculateFrictionScore(personaReactions) {
  if (!Array.isArray(personaReactions) || personaReactions.length === 0) {
    return {
      overallFrictionScore: 0,
      frictionBand: 'LOW',
      dimensionScores: { clarity: 0, workload: 0, fairness: 0, delivery: 0, tone: 0 },
      perPersonaScores: {},
    };
  }

  // 1. Calculate per-persona dimension scores & total persona score
  const personaScoresList = [];
  const perPersonaScores = {};

  for (const persona of personaReactions) {
    const concerns = persona.concerns || [];
    
    // Group concerns by dimension
    const dimConcerns = { Clarity: [], Workload: [], Fairness: [], Delivery: [], Tone: [] };
    for (const c of concerns) {
      const dim = TYPE_TO_DIMENSION[c.type];
      if (dim) {
        dimConcerns[dim].push(c);
      }
    }

    // Calculate score for each dimension in this persona
    let pScore = 0;
    const personaDimScores = {};

    for (const [dimName, info] of Object.entries(CONCERN_TAXONOMY)) {
      const list = dimConcerns[dimName];
      let dScore = 0;
      if (list.length > 0) {
        let maxBase = 0;
        for (const item of list) {
          const base = SEVERITY_BASE[item.severity?.toUpperCase()] || SEVERITY_BASE.LOW;
          if (base > maxBase) maxBase = base;
        }
        dScore = Math.min(100, maxBase + 5 * (list.length - 1));
      }
      personaDimScores[dimName.toLowerCase()] = Math.round(dScore);
      pScore += info.weight * dScore;
    }

    perPersonaScores[persona.key] = Math.round(pScore);
    personaScoresList.push(pScore);
  }

  // 2. Base score: average across all personas
  const baseScore = personaScoresList.reduce((a, b) => a + b, 0) / personaScoresList.length;

  // 3. Breadth Uplift (+5 if same HIGH or CRITICAL concern appears in >= 2 personas)
  const highPlusConcernCounts = {};
  for (const persona of personaReactions) {
    const seenInPersona = new Set();
    for (const c of persona.concerns || []) {
      const sev = c.severity?.toUpperCase();
      if ((sev === 'HIGH' || sev === 'CRITICAL') && c.type) {
        seenInPersona.add(c.type);
      }
    }
    for (const type of seenInPersona) {
      highPlusConcernCounts[type] = (highPlusConcernCounts[type] || 0) + 1;
    }
  }

  const hasBreadthOverlap = Object.values(highPlusConcernCounts).some((count) => count >= 2);
  const breadthUplift = hasBreadthOverlap ? 5 : 0;

  // 4. Critical Uplift (+10 if any CRITICAL concern is in CRITICAL_UPLIFT_TYPES)
  let hasCriticalKeyConcern = false;
  for (const persona of personaReactions) {
    for (const c of persona.concerns || []) {
      if (c.severity?.toUpperCase() === 'CRITICAL' && CRITICAL_UPLIFT_TYPES.has(c.type)) {
        hasCriticalKeyConcern = true;
        break;
      }
    }
    if (hasCriticalKeyConcern) break;
  }
  const criticalUplift = hasCriticalKeyConcern ? 10 : 0;

  // 5. Final Overall Friction Score
  const rawFinal = baseScore + breadthUplift + criticalUplift;
  const overallFrictionScore = Math.max(0, Math.min(100, Math.round(rawFinal)));

  // 6. Friction Band Assignment
  let frictionBand = 'LOW';
  if (overallFrictionScore >= 80) frictionBand = 'CRITICAL';
  else if (overallFrictionScore >= 60) frictionBand = 'HIGH';
  else if (overallFrictionScore >= 30) frictionBand = 'MODERATE';

  // 7. Aggregate Dimension Scores across personas (average)
  const aggregateDimScores = { clarity: 0, workload: 0, fairness: 0, delivery: 0, tone: 0 };
  for (const dimName of Object.keys(CONCERN_TAXONOMY)) {
    const key = dimName.toLowerCase();
    let sum = 0;
    for (const persona of personaReactions) {
      const list = (persona.concerns || []).filter((c) => TYPE_TO_DIMENSION[c.type] === dimName);
      if (list.length > 0) {
        let maxBase = 0;
        for (const item of list) {
          const base = SEVERITY_BASE[item.severity?.toUpperCase()] || SEVERITY_BASE.LOW;
          if (base > maxBase) maxBase = base;
        }
        sum += Math.min(100, maxBase + 5 * (list.length - 1));
      }
    }
    aggregateDimScores[key] = Math.round(sum / personaReactions.length);
  }

  return {
    overallFrictionScore,
    frictionBand,
    dimensionScores: aggregateDimScores,
    perPersonaScores,
    scoringVersion: 'SCORING_V1',
  };
}

module.exports = {
  calculateFrictionScore,
  CONCERN_TAXONOMY,
  SEVERITY_BASE,
  TYPE_TO_DIMENSION,
  CRITICAL_UPLIFT_TYPES,
};
