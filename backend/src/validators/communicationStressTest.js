/**
 * Communication Stress-Test — Zod Input Validators
 *
 * Establishes a validators/ directory pattern for the codebase.
 * Previously, all validation was inline in controllers.
 */

const { z } = require('zod');
const { INPUT_LIMITS } = require('../config/communicationReviewPolicy');

// ── Source Types ──────────────────────────────────────────────────────────

const SOURCE_TYPES = ['ANNOUNCEMENT', 'TEAM_MESSAGE'];

// ── Create Stress-Test Request ───────────────────────────────────────────

const createStressTestSchema = z.object({
  sourceType: z.enum(SOURCE_TYPES, {
    errorMap: () => ({ message: `sourceType must be one of: ${SOURCE_TYPES.join(', ')}` }),
  }),

  title: z
    .string()
    .trim()
    .min(1, 'Title is required.')
    .max(INPUT_LIMITS.titleMaxLength, `Title must be at most ${INPUT_LIMITS.titleMaxLength} characters.`),

  message: z
    .string()
    .trim()
    .min(INPUT_LIMITS.messageMinLength, `Message must be at least ${INPUT_LIMITS.messageMinLength} characters.`)
    .max(INPUT_LIMITS.messageMaxLength, `Message must be at most ${INPUT_LIMITS.messageMaxLength} characters.`),

  category: z
    .string()
    .trim()
    .max(50, 'Category must be at most 50 characters.')
    .optional()
    .nullable(),
});

// ── Record Event Request ─────────────────────────────────────────────────

const VALID_EVENT_TYPES = [
  'VIEWED',
  'REWRITE_VIEWED',
  'REWRITE_COPIED',
  'REWRITE_APPLIED',
  'DISMISSED',
  'PUBLISHED_ORIGINAL',
  'PUBLISHED_REWRITE',
  'PUBLISHED_EDITED_REWRITE',
];

const recordEventSchema = z.object({
  eventType: z.enum(VALID_EVENT_TYPES, {
    errorMap: () => ({ message: `eventType must be one of: ${VALID_EVENT_TYPES.join(', ')}` }),
  }),
  metadata: z.record(z.unknown()).optional().nullable(),
});

// ── Idempotency Key Header ───────────────────────────────────────────────

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const validateIdempotencyKey = (headerValue) => {
  if (!headerValue || typeof headerValue !== 'string') {
    return { valid: false, error: 'Idempotency-Key header is required.' };
  }
  if (!UUID_REGEX.test(headerValue.trim())) {
    return { valid: false, error: 'Idempotency-Key must be a valid UUID.' };
  }
  return { valid: true, key: headerValue.trim().toLowerCase() };
};

module.exports = {
  createStressTestSchema,
  recordEventSchema,
  validateIdempotencyKey,
  SOURCE_TYPES,
  VALID_EVENT_TYPES,
};
