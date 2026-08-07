export function normalizeText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

export function stableHash(value) {
  const text = normalizeText(value);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function cleanField(value) {
  return normalizeText(value).replaceAll('｜', '／');
}

export function makeAnnotationTerm({ pageKey, blockHash, start, end, quote }) {
  const page = cleanField(pageKey).slice(-90);
  const excerpt = cleanField(quote).slice(0, 90);
  const term = `批注｜${page}｜${cleanField(blockHash)}｜${Number(start)}-${Number(end)}｜${excerpt}`;
  return term.slice(0, 240);
}

export function parseAnnotationTerm(term) {
  if (!String(term).startsWith('批注｜')) return null;
  const parts = String(term).split('｜');
  if (parts.length < 5) return null;
  const offsets = /^(\d+)-(\d+)$/.exec(parts[3]);
  if (!offsets) return null;
  return {
    pageKey: parts[1],
    blockHash: parts[2],
    start: Number(offsets[1]),
    end: Number(offsets[2]),
    quote: parts.slice(4).join('｜'),
  };
}
