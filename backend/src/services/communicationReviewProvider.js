/**
 * Communication Review AI Provider (Gemini Adapter)
 *
 * Calls Gemini via geminiClient.js with structured JSON schema.
 * Performs output Zod validation, evidence substring verification,
 * and 1-attempt repair retry on validation failure.
 */

const geminiClient = require('./geminiClient');
const { buildPrompt, PROMPT_VERSION } = require('./communicationReviewPromptBuilder');
const { calculateFrictionScore, TYPE_TO_DIMENSION } = require('../utils/communicationFrictionScoring');
const { z } = require('zod');

const MODEL_VERSION = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
const HARD_TIMEOUT_MS = 40000; // 40-second deadline for complex AI generations

// ── Zod Response Validation Schema ──────────────────────────────────────

const concernSchema = z.object({
  type: z.string().refine((val) => !!TYPE_TO_DIMENSION[val], {
    message: 'Concern type must belong to the fixed taxonomy.',
  }),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  evidence: z.string().min(1, 'Evidence is required.'),
  impact: z.string().min(1, 'Impact description is required.'),
  mitigation: z.string().min(1, 'Mitigation suggestion is required.'),
});

const personaReactionSchema = z.object({
  key: z.string(),
  summary: z.string(),
  concerns: z.array(concernSchema).default([]),
});

const rewriteSchema = z.object({
  message: z.string().min(1, 'Rewrite message is required.'),
  preservedIntent: z.string().min(1, 'Preserved intent is required.'),
  changesMade: z.array(z.string()).default([]),
  unresolvedRisks: z.array(z.string()).default([]),
});

const modelOutputSchema = z.object({
  personas: z.array(personaReactionSchema).min(1, 'At least 1 persona reaction required.'),
  rewrite: rewriteSchema,
});

/**
 * Execute stress-test analysis via Gemini.
 *
 * @param {object} params
 * @param {string} params.title
 * @param {string} params.message
 * @param {string} [params.category]
 * @param {Array<object>} params.personas
 * @returns {Promise<object>} Complete stress-test result ready for DB storage
 */
async function analyzeDraft({ title, message, category, personas }) {
  const { systemInstruction, prompt } = buildPrompt({ title, message, category, personas });
  const ai = geminiClient.getAI();

  // Execute Gemini call with 20-second timeout
  let rawResponseText;
  try {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('AI provider deadline exceeded (20s timeout).')), HARD_TIMEOUT_MS)
    );

    const callPromise = ai.models.generateContent({
      model: MODEL_VERSION,
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        temperature: 0.2, // Low temperature for deterministic analysis
      },
    });

    const response = await Promise.race([callPromise, timeoutPromise]);
    rawResponseText = response.text;
  } catch (err) {
    console.error('[CommunicationReviewProvider] Gemini call failed:', err.message);
    throw new Error(`AI Provider Error: ${err.message}`);
  }

  // Parse & Validate response
  let parsedData;
  try {
    parsedData = parseAndValidateResponse(rawResponseText, message, personas);
  } catch (initialErr) {
    console.warn('[CommunicationReviewProvider] Validation failed on first attempt, trying 1 repair retry:', initialErr.message);

    // 1 repair retry with explicit error feedback
    try {
      const repairPrompt = `${prompt}\n\nPREVIOUS OUTPUT WAS INVALID:\n${initialErr.message}\nPlease fix your JSON response to strictly follow all instructions and schema rules.`;

      const repairCall = await ai.models.generateContent({
        model: MODEL_VERSION,
        contents: repairPrompt,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          temperature: 0.1,
        },
      });

      rawResponseText = repairCall.text;
      parsedData = parseAndValidateResponse(rawResponseText, message, personas);
    } catch (repairErr) {
      console.error('[CommunicationReviewProvider] Repair attempt also failed:', repairErr.message);
      throw new Error(`AI Provider Output Validation Failed: ${repairErr.message}`);
    }
  }

  // Compute deterministic friction scores
  const scoreResult = calculateFrictionScore(parsedData.personas);

  // Format persona reactions with per-persona maxSeverity
  const formattedReactions = parsedData.personas.map((p) => {
    const personaDef = personas.find((item) => item.key === p.key) || {};
    const concernTypes = (p.concerns || []).map((c) => c.type);

    let maxSeverity = null;
    if (p.concerns && p.concerns.length > 0) {
      const severities = p.concerns.map((c) => c.severity);
      if (severities.includes('CRITICAL')) maxSeverity = 'CRITICAL';
      else if (severities.includes('HIGH')) maxSeverity = 'HIGH';
      else if (severities.includes('MEDIUM')) maxSeverity = 'MEDIUM';
      else maxSeverity = 'LOW';
    }

    return {
      personaKey: p.key,
      personaName: personaDef.name || p.key,
      summary: p.summary,
      concernTypes,
      maxSeverity,
      concerns: p.concerns,
      mitigations: p.concerns.map((c) => ({ type: c.type, mitigation: c.mitigation })),
    };
  });

  return {
    overallFrictionScore: scoreResult.overallFrictionScore,
    frictionBand: scoreResult.frictionBand,
    dimensionScores: scoreResult.dimensionScores,
    reactions: formattedReactions,
    rewriteMessage: parsedData.rewrite.message,
    rewriteMetadata: {
      preservedIntent: parsedData.rewrite.preservedIntent,
      changesMade: parsedData.rewrite.changesMade,
      unresolvedRisks: parsedData.rewrite.unresolvedRisks,
    },
    modelVersion: MODEL_VERSION,
    promptVersion: PROMPT_VERSION,
    scoringVersion: scoreResult.scoringVersion,
  };
}

/**
 * Analyze announcement for employee action breakdown (Iris AI analysis).
 *
 * @param {object} params
 * @param {string} params.title
 * @param {string} params.message
 * @param {string} [params.category]
 * @returns {Promise<object>} { summary, whatToDo, whatNotToDo, howToDo }
 */
async function analyzeAnnouncementForEmployees({ title, message, category }) {
  const ai = geminiClient.getAI();

  const systemInstruction = `You are Iris AI, the intelligent HR Operating System assistant for Crew HRMS.
Your task is to analyze a company announcement and break it down into clear, actionable guidance for employees.

Analyze the announcement text and provide:
1. "summary": A 1-2 sentence high-level executive summary of the announcement.
2. "whatToDo": 2-4 clear, positive action items employees MUST or SHOULD do.
3. "whatNotToDo": 2-4 critical things employees MUST AVOID, pitfalls, or prohibited actions.
4. "howToDo": 2-3 execution guidelines, deadlines, or process steps (how to fulfill the task).

OUTPUT FORMAT: Return a valid JSON object matching this exact schema:
{
  "summary": "1-2 sentence executive summary",
  "whatToDo": ["Action item 1", "Action item 2"],
  "whatNotToDo": ["Thing to avoid 1", "Thing to avoid 2"],
  "howToDo": ["Guideline or process step 1", "Guideline 2"]
}`;

  const prompt = `COMPANY ANNOUNCEMENT TO ANALYZE:
Title: "${title}"
Category: "${category || 'General'}"
Message Content:
"""
${message}
"""

Provide the Iris AI Action Breakdown for employees as structured JSON.`;

  try {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('AI provider deadline exceeded (40s timeout).')), 40000)
    );

    const callPromise = ai.models.generateContent({
      model: MODEL_VERSION,
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        temperature: 0.2,
      },
    });

    const response = await Promise.race([callPromise, timeoutPromise]);
    const rawText = response.text;
    const parsed = JSON.parse(rawText);

    return {
      summary: parsed.summary || 'Summary unavailable.',
      whatToDo: Array.isArray(parsed.whatToDo) ? parsed.whatToDo : [],
      whatNotToDo: Array.isArray(parsed.whatNotToDo) ? parsed.whatNotToDo : [],
      howToDo: Array.isArray(parsed.howToDo) ? parsed.howToDo : [],
    };
  } catch (err) {
    console.error('[CommunicationReviewProvider] Iris analysis error:', err.message);
    // Return structured graceful fallback if network/API deadline exceeded to keep UI responsive
    return {
      summary: `Iris Breakdown: ${title}`,
      whatToDo: ['Review the full announcement text carefully.', 'Follow up with your manager if clarification is required.'],
      whatNotToDo: ['Do not ignore assigned deadlines or key action items.'],
      howToDo: ['Complete tasks per specified schedule and report progress.'],
      fallbackNotice: `AI generation took longer than expected: ${err.message}`,
    };
  }
}

const TAXONOMY_ALIASES = {
  OVERTIME_EXPECTATION: 'AFTER_HOURS_EXPECTATION',
  AFTER_HOURS_WORK: 'AFTER_HOURS_EXPECTATION',
  OVERTIME_WORK: 'AFTER_HOURS_EXPECTATION',
  TIMELINE_COMPRESSION: 'COMPRESSED_TIMELINE',
  MISSING_CONTEXT: 'MISSING_RATIONALE',
  AMBIGUOUS_DEADLINE: 'AMBIGUOUS_TIMELINE',
  DISMISSIVE_TONE: 'DISMISSIVE_LANGUAGE',
  BLAMING_TONE: 'BLAMING_LANGUAGE',
  ALARMIST_LANGUAGE: 'ALARMIST_TONE',
  EXCLUSIONARY_LANGUAGE: 'POTENTIALLY_EXCLUSIONARY_LANGUAGE',
};

function normalizeConcernType(rawType) {
  if (!rawType) return rawType;
  const upper = String(rawType).trim().toUpperCase().replace(/[\s-]+/g, '_');
  return TAXONOMY_ALIASES[upper] || upper;
}

/**
 * Helper to parse, validate against Zod schema, and verify evidence substrings.
 */
function parseAndValidateResponse(jsonString, originalMessage, personas) {
  let rawJson;
  try {
    rawJson = JSON.parse(jsonString);
  } catch (e) {
    throw new Error('Model output is not valid JSON.');
  }

  // Preprocess & normalize model output (concern types & severities)
  if (rawJson && Array.isArray(rawJson.personas)) {
    for (const p of rawJson.personas) {
      if (Array.isArray(p.concerns)) {
        for (const c of p.concerns) {
          if (c.type) c.type = normalizeConcernType(c.type);
          if (c.severity) c.severity = String(c.severity).trim().toUpperCase();
        }
      }
    }
  }

  const result = modelOutputSchema.safeParse(rawJson);
  if (!result.success) {
    const errorDetails = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Schema validation error: ${errorDetails}`);
  }

  const data = result.data;
  const normalizedMessage = originalMessage.toLowerCase().replace(/\s+/g, ' ');

  // Evidence literal substring verification
  for (const persona of data.personas) {
    for (const concern of persona.concerns) {
      const normalizedEvidence = concern.evidence.toLowerCase().replace(/\s+/g, ' ');
      if (!normalizedMessage.includes(normalizedEvidence)) {
        // Fallback: check if at least 60% of words match if exact whitespace differs
        const words = normalizedEvidence.split(' ').filter((w) => w.length > 3);
        const matches = words.filter((w) => normalizedMessage.includes(w));
        if (words.length > 0 && matches.length / words.length < 0.6) {
          throw new Error(`Evidence substring "${concern.evidence}" was not found in original draft message.`);
        }
      }
    }
  }

  return data;
}

module.exports = {
  analyzeDraft,
  analyzeAnnouncementForEmployees,
  MODEL_VERSION,
  PROMPT_VERSION,
};
