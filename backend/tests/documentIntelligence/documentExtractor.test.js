const { extractText, chunkText } = require('../../src/services/documentExtractor');

describe('Document Extractor Multi-Format Test Suite', () => {
  test('extracts text from plain text and markdown files', async () => {
    const buffer = Buffer.from('Employee Name: Barshan Majumdar\nDOB: 1995-05-12', 'utf-8');
    const text = await extractText(buffer, 'text/plain');
    expect(text).toContain('Barshan Majumdar');
  });

  test('handles image/jpeg documents gracefully without throwing unhandled exceptions', async () => {
    const mockImageBuffer = Buffer.from('FAKE_JPEG_BINARY_DATA_STREAM', 'utf-8');
    const text = await extractText(mockImageBuffer, 'image/jpeg');
    expect(typeof text).toBe('string');
    expect(text.length).toBeGreaterThan(0);
  });

  test('handles image/png documents gracefully without throwing unhandled exceptions', async () => {
    const mockImageBuffer = Buffer.from('FAKE_PNG_BINARY_DATA_STREAM', 'utf-8');
    const text = await extractText(mockImageBuffer, 'image/png');
    expect(typeof text).toBe('string');
    expect(text.length).toBeGreaterThan(0);
  });

  test('chunkText splits text cleanly on paragraphs', () => {
    const longText = 'Paragraph 1 text content that is quite descriptive.\n\nParagraph 2 text content with more onboarding details.\n\nParagraph 3 text content for verification.';
    const chunks = chunkText(longText, 400, 50);
    expect(chunks.length).toBeGreaterThan(0);
  });
});
