/**
 * Communication Review Input Guard (DLP & Safety Filter)
 *
 * Prevents sensitive data (credentials, PII, statutory IDs) and
 * prompt injection attacks from reaching the Gemini model.
 */

// ── Pattern Definitions ─────────────────────────────────────────────────

// Credentials & Secrets
const SECRET_PATTERNS = [
  /(?:api[_-]?key|secret|token|password|auth|bearer)\s*[:=]\s*['"]?[^\s'"]{8,}['"]?/i,
  /eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/, // JWT token
  /postgres(?:ql)?:\/\/[^:\s]+:[^@\s]+@[^:\s]+:\d+\/[^\s]+/i,       // Database URL
  /mongodb(?:\+srv)?:\/\/[^:\s]+:[^@\s]+@[^\s]+/i,
];

// Severe PII & Government Identification (Indian + General)
const PII_PATTERNS = [
  /\b[A-Z]{5}[0-9]{4}[A-Z]{1}\b/, // Indian PAN Card number
  /\b[2-9]{1}[0-9]{3}\s?[0-9]{4}\s?[0-9]{4}\b/, // Indian Aadhaar number (12 digits)
  /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13})\b/, // Visa/Mastercard/Amex credit card
  /\b\d{3}-\d{2}-\d{4}\b/, // US SSN
];

// Prompt Injection & Jailbreak Patterns
const INJECTION_PATTERNS = [
  /ignore\s+(?:all\s+)?(?:previous|above|system)\s+(?:instructions|prompts|rules)/i,
  /disregard\s+(?:all\s+)?(?:previous|above|system)\s+(?:instructions|prompts|rules)/i,
  /you\s+are\s+now\s+a\b/i,
  /system\s*:\s*you\s+are/i,
  /override\s+system\s+prompt/i,
  /jailbreak/i,
  /\[system\s*prompt\]/i,
];

/**
 * Validate input message and title for DLP violations and prompt injection.
 *
 * @param {string} title
 * @param {string} message
 * @returns {{ safe: boolean, reason?: string }}
 */
function inspectInput(title, message) {
  const fullText = `${title || ''}\n${message || ''}`;

  // 1. Check Secret / Credential Leakage
  for (const pattern of SECRET_PATTERNS) {
    if (pattern.test(fullText)) {
      return {
        safe: false,
        reason: 'Input contains forbidden credentials, API keys, or secret tokens.',
      };
    }
  }

  // 2. Check Severe PII Leakage
  for (const pattern of PII_PATTERNS) {
    if (pattern.test(fullText)) {
      return {
        safe: false,
        reason: 'Input contains sensitive PII or government identification numbers.',
      };
    }
  }

  // 3. Check Prompt Injection
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(fullText)) {
      return {
        safe: false,
        reason: 'Input contains forbidden prompt modification or injection patterns.',
      };
    }
  }

  return { safe: true };
}

module.exports = {
  inspectInput,
  SECRET_PATTERNS,
  PII_PATTERNS,
  INJECTION_PATTERNS,
};
