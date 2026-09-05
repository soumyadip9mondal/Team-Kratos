/**
 * Scoring Unit Tests — SCORING_V1
 *
 * Verifies deterministic score calculations, uplifts, and the required sprint update scenario.
 */

const { calculateFrictionScore } = require('../../src/utils/communicationFrictionScoring');

describe('SCORING_V1 Friction Engine', () => {
  test('returns 0 score and LOW band for empty concern list', () => {
    const result = calculateFrictionScore([
      { key: 'senior_developer', concerns: [] },
      { key: 'hr_people_partner', concerns: [] },
      { key: 'product_lead', concerns: [] },
    ]);

    expect(result.overallFrictionScore).toBe(0);
    expect(result.frictionBand).toBe('LOW');
  });

  test('applies breadth uplift (+5) when same HIGH concern appears in >= 2 personas', () => {
    const reactions = [
      {
        key: 'senior_developer',
        concerns: [{ type: 'TESTING_RISK', severity: 'HIGH' }],
      },
      {
        key: 'product_lead',
        concerns: [{ type: 'TESTING_RISK', severity: 'HIGH' }],
      },
      {
        key: 'hr_people_partner',
        concerns: [],
      },
    ];

    const result = calculateFrictionScore(reactions);
    // Base persona scores:
    // senior_developer: delivery = 65 -> 0.20 * 65 = 13
    // product_lead: delivery = 65 -> 0.20 * 65 = 13
    // hr_people_partner: 0
    // mean base = (13 + 13 + 0) / 3 = 8.666
    // breadth uplift = +5
    // expected overall = round(8.666 + 5) = 14
    expect(result.overallFrictionScore).toBe(14);
  });

  test('applies critical uplift (+10) for AFTER_HOURS_EXPECTATION CRITICAL concern', () => {
    const reactions = [
      {
        key: 'hr_people_partner',
        concerns: [{ type: 'AFTER_HOURS_EXPECTATION', severity: 'CRITICAL' }],
      },
      { key: 'senior_developer', concerns: [] },
      { key: 'product_lead', concerns: [] },
    ];

    const result = calculateFrictionScore(reactions);
    // hr_people_partner workload = 85 -> 0.25 * 85 = 21.25
    // mean base = 21.25 / 3 = 7.083
    // critical uplift = +10
    // total = round(17.083) = 17
    expect(result.overallFrictionScore).toBe(17);
  });

  test('REQUIRED SCENARIO: Sprint deadline update draft produces score >= 60 (HIGH or CRITICAL band)', () => {
    // Draft: "The sprint deadline is moving from Friday to tomorrow morning. Everyone needs to stay online tonight."
    const reactions = [
      {
        key: 'senior_developer',
        concerns: [
          { type: 'TESTING_RISK', severity: 'HIGH' },
          { type: 'RELEASE_RISK', severity: 'HIGH' },
          { type: 'COMPRESSED_TIMELINE', severity: 'HIGH' },
          { type: 'CAPACITY_RISK', severity: 'HIGH' },
          { type: 'AMBIGUOUS_ACTION', severity: 'HIGH' },
        ],
      },
      {
        key: 'hr_people_partner',
        concerns: [
          { type: 'AFTER_HOURS_EXPECTATION', severity: 'CRITICAL' },
          { type: 'POLICY_REVIEW_REQUIRED', severity: 'HIGH' },
          { type: 'COERCIVE_LANGUAGE', severity: 'CRITICAL' },
          { type: 'CAPACITY_RISK', severity: 'HIGH' },
          { type: 'ALARMIST_TONE', severity: 'HIGH' },
        ],
      },
      {
        key: 'product_lead',
        concerns: [
          { type: 'RELEASE_RISK', severity: 'HIGH' },
          { type: 'COMPRESSED_TIMELINE', severity: 'HIGH' },
          { type: 'AMBIGUOUS_TIMELINE', severity: 'HIGH' },
          { type: 'TESTING_RISK', severity: 'HIGH' },
        ],
      },
    ];

    const result = calculateFrictionScore(reactions);

    // Expected: score >= 60, frictionBand is HIGH or CRITICAL
    expect(result.overallFrictionScore).toBeGreaterThanOrEqual(60);
    expect(['HIGH', 'CRITICAL']).toContain(result.frictionBand);
  });
});
