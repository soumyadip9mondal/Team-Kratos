/**
 * Communication Stress-Testing — Policy Configuration
 *
 * Central registry for permission defaults, feature flags, rate limits,
 * and scoring constants used across the Communication Review feature.
 *
 * NOTE: This file is the single source of truth for all policy knobs.
 *       Do NOT scatter magic numbers across controllers/services.
 */

// ── Permission Defaults ─────────────────────────────────────────────────
// When a role's `permissions` JSON is null (never configured in the console),
// fall back to level-based defaults. Matches the pattern in
// frontend/src/lib/permissions.js.

const PERMISSION_DEFAULTS = {
  communication_stress_test:           { maxLevel: 2 },
  view_all_communication_stress_tests: { maxLevel: 1 },
  manage_communication_personas:       { maxLevel: 1 },
  view_communication_trends:           { maxLevel: 1 },
};

// ── Feature Flags ────────────────────────────────────────────────────────
// Both the global env flag AND the per-tenant DB flag must be truthy.

const isFeatureGloballyEnabled = () =>
  process.env.COMMUNICATION_STRESS_TEST_ENABLED === 'true';

// ── Rate Limits ──────────────────────────────────────────────────────────

const RATE_LIMITS = {
  perUserPerHour:       10,
  perTenantPerDay:      100,
  inFlightLockSeconds:  30,
};

// ── Input Constraints ────────────────────────────────────────────────────

const INPUT_LIMITS = {
  titleMaxLength:   160,
  messageMaxLength: 5000,
  messageMinLength: 20,
};

// ── Scoring Version ──────────────────────────────────────────────────────

const SCORING_VERSION = 'SCORING_V1';

// ── Retention ────────────────────────────────────────────────────────────

const RETENTION = {
  detailDays:    90,
  aggregateDays: 365,
};

module.exports = {
  PERMISSION_DEFAULTS,
  isFeatureGloballyEnabled,
  RATE_LIMITS,
  INPUT_LIMITS,
  SCORING_VERSION,
  RETENTION,
};
