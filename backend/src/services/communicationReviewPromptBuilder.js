/**
 * Communication Review Prompt Builder
 *
 * Constructs versioned system instructions and prompts for Gemini.
 * Enforces structured JSON output matching the persona reactions & rewrite contract.
 */

const { CONCERN_TAXONOMY } = require('../utils/communicationFrictionScoring');

const PROMPT_VERSION = 'PROMPT_V1';

// Format concern types for prompt instructions
const TAXONOMY_GUIDE = Object.entries(CONCERN_TAXONOMY)
  .map(([dim, info]) => `- ${dim}: [${info.types.join(', ')}]`)
  .join('\n');

/**
 * Build the system instruction and user prompt for Gemini.
 *
 * @param {object} params
 * @param {string} params.title
 * @param {string} params.message
 * @param {string} [params.category]
 * @param {Array<object>} params.personas - Array of persona objects from DB
 * @returns {{ systemInstruction: string, prompt: string, promptVersion: string }}
 */
function buildPrompt({ title, message, category, personas }) {
  const personaDescriptions = personas
    .map(
      (p) =>
        `Persona Key: "${p.key}" | Name: "${p.name}" | Role Family: "${p.roleFamily}" | Focus Areas: [${(p.focusAreas || []).join(', ')}]`
    )
    .join('\n');

  const systemInstruction = `You are an expert workplace communication analyzer for Crew HRMS.
Your task is to analyze an unsent workplace message draft from the perspective of 3 distinct role-based workplace lenses and provide a constructive rewrite.

STRICT CONSTRAINTS:
1. NEVER invent employee records, payroll, biometric, or chat history facts.
2. EVIDENCE MUST BE A LITERAL SUBSTRING: Every concern's "evidence" field MUST be an EXACT, word-for-word substring copied directly from the draft message. Do not paraphrase or summarize inside the "evidence" field.
3. CONCERN TAXONOMY: You must ONLY use concern types from the following taxonomy:
${TAXONOMY_GUIDE}
Allowed severities: "LOW", "MEDIUM", "HIGH", "CRITICAL".
4. REWRITE RULES:
   - Preserve the author's core intent.
   - Address the identified high/critical friction points.
   - DO NOT invent new compensation promises, specific policy changes, or false overtime claims not in the original draft.
5. NO NUMERICAL SCORES: Do not output numerical scores.

OUTPUT FORMAT: You must return a single valid JSON object with the exact schema requested.`;

  const prompt = `WORKPLACE DRAFT TO ANALYZE:
Title: "${title}"
Category: "${category || 'General'}"
Message Content:
"""
${message}
"""

TARGET PERSONAS TO SIMULATE:
${personaDescriptions}

Analyze the message draft from each persona's perspective and generate a constructive rewrite.
Return JSON matching this schema:
{
  "personas": [
    {
      "key": "persona_key",
      "summary": "1-2 sentence reaction summary from this persona's lens",
      "concerns": [
        {
          "type": "CONCERN_TYPE_FROM_TAXONOMY",
          "severity": "LOW|MEDIUM|HIGH|CRITICAL",
          "evidence": "EXACT literal substring from original draft message",
          "impact": "Explanation of potential friction or risk for this persona",
          "mitigation": "Actionable suggestion to resolve this concern"
        }
      ]
    }
  ],
  "rewrite": {
    "message": "Improved version of the draft message",
    "preservedIntent": "Summary of the core intent preserved from the draft",
    "changesMade": ["List of key changes made to reduce friction"],
    "unresolvedRisks": ["Any risks that require offline confirmation by the sender"]
  }
}`;

  return {
    systemInstruction,
    prompt,
    promptVersion: PROMPT_VERSION,
  };
}

module.exports = {
  buildPrompt,
  PROMPT_VERSION,
};
