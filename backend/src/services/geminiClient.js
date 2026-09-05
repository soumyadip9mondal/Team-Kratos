const { GoogleGenAI } = require('@google/genai');

class GeminiClient {
  constructor() {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      console.warn('[GeminiClient] GEMINI_API_KEY missing — Gemini AI features will use fallback handlers.');
      this.ai = null;
    } else {
      this.ai = new GoogleGenAI({ apiKey: key });
    }
  }
  getAI() { return this.ai; }
}

module.exports = new GeminiClient();
