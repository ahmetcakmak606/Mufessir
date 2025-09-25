export function finalizeResponse(text: string, lengthScale?: number, lang?: string): string {
  const scale = typeof lengthScale === 'number' ? Math.max(1, Math.min(10, Math.floor(lengthScale))) : undefined;
  let cleaned = text.replace(/\s+$/g, '').replace(/^\s+/g, '');

  // For very short outputs, keep 2–3 complete sentences.
  if (scale && scale <= 3) {
    const sentences = splitSentences(cleaned);
    const target = scale === 1 ? 2 : scale === 2 ? 2 : 3;
    cleaned = sentences.slice(0, target).join(' ').trim();
  }

  // Ensure we end at a sentence boundary if possible
  cleaned = trimToSentenceBoundary(cleaned);
  return cleaned;
}

function splitSentences(text: string): string[] {
  // Basic sentence splitter for TR/EN style punctuation
  const re = /([^.?!…]+[.?!…]+)/g;
  const parts = text.match(re);
  if (parts && parts.length) return parts.map(s => s.trim());
  return [text.trim()];
}

function trimToSentenceBoundary(text: string): string {
  const end = text.search(/[.?!…]\s*$/);
  if (end !== -1) return text.slice(0, end + 1);
  // Try to find last sentence delimiter
  const idx = Math.max(text.lastIndexOf('.'), text.lastIndexOf('!'), text.lastIndexOf('?'), text.lastIndexOf('…'));
  if (idx !== -1) return text.slice(0, idx + 1);
  return text.trim();
}

