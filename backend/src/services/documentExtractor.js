const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const geminiClient = require('./geminiClient');

async function extractText(buffer, mimeType) {
  if (!mimeType) {
    mimeType = 'application/octet-stream';
  }

  // 1. PDF Documents
  if (mimeType === 'application/pdf') {
    try {
      const data = await pdfParse(buffer);
      return data.text || '';
    } catch (err) {
      console.warn('[DocumentExtractor] PDF parsing warning:', err.message);
      return buffer.toString('utf-8').replace(/[^\x20-\x7E\n\r\t]/g, ' ');
    }
  }

  // 2. Image Documents (JPEG, JPG, PNG, WEBP, GIF, TIFF)
  if (mimeType.startsWith('image/')) {
    try {
      const ai = geminiClient.getAI();
      const base64Data = buffer.toString('base64');
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  data: base64Data,
                  mimeType: mimeType
                }
              },
              {
                text: 'Perform strict document OCR on this uploaded image. Extract all printed text, handwritten annotations, names, dates, document numbers, and key information verbatim. Return only the extracted document text.'
              }
            ]
          }
        ]
      });

      const extracted = response.text || '';
      if (extracted.trim().length > 0) {
        return extracted.trim();
      }
    } catch (err) {
      console.warn(`[DocumentExtractor] Vision OCR skipped for ${mimeType}:`, err.message);
    }
    return `[Uploaded Image Document: ${mimeType} - Visual Document OCR Registered]`;
  }

  // 3. Word Documents (.docx, .doc)
  if (mimeType.includes('wordprocessingml') || mimeType.includes('msword')) {
    try {
      const { value } = await mammoth.extractRawText({ buffer });
      return value || '';
    } catch (err) {
      console.warn('[DocumentExtractor] Mammoth extraction warning:', err.message);
      return buffer.toString('utf-8').replace(/[^\x20-\x7E\n\r\t]/g, ' ');
    }
  }

  // 4. Plain Text & Markdown
  if (mimeType.startsWith('text/')) {
    return buffer.toString('utf-8');
  }

  // 5. Generic Safe Fallback for any other file type
  try {
    const textStr = buffer.toString('utf-8');
    // If mostly printable ASCII, return text
    const printableCount = (textStr.match(/[\x20-\x7E\n\r\t]/g) || []).length;
    if (printableCount / textStr.length > 0.6) {
      return textStr;
    }
  } catch (e) {
    // Ignore error
  }

  return `[Binary Document: ${mimeType}]`;
}

// Semantic chunking — splits on double newlines (paragraphs), respects token budget
function chunkText(text, maxTokens = 400, overlapTokens = 50) {
  if (!text || typeof text !== 'string') return [];
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 10);
  if (paragraphs.length === 0 && text.trim().length > 0) {
    return [text.trim()];
  }

  const chunks = [];
  let current = '';
  for (const para of paragraphs) {
    const combined = current + '\n\n' + para;
    if (combined.length / 4 > maxTokens && current.length > 0) {
      chunks.push(current.trim());
      const words = current.split(' ');
      const overlapWords = words.slice(-Math.floor(overlapTokens * 0.75));
      current = overlapWords.join(' ') + '\n\n' + para;
    } else {
      current = combined;
    }
  }
  if (current.trim().length > 0) chunks.push(current.trim());
  return chunks;
}

module.exports = { extractText, chunkText };
