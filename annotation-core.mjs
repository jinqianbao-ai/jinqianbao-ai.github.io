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
  const page = cleanField(pageKey).replace(/\.html$/i, '').slice(-90);
  const excerpt = cleanField(quote).slice(0, 90);
  const term = `文内批注｜${page}｜${excerpt}｜${cleanField(blockHash)}@${Number(start)}-${Number(end)}`;
  return term.slice(0, 240);
}

export function parseAnnotationTerm(term) {
  if (!String(term).startsWith('文内批注｜')) return null;
  const parts = String(term).split('｜');
  if (parts.length < 4) return null;
  const anchor = /^([^@]+)@(\d+)-(\d+)$/.exec(parts[3]);
  if (!anchor) return null;
  return {
    pageKey: `${parts[1]}.html`,
    blockHash: anchor[1],
    start: Number(anchor[2]),
    end: Number(anchor[3]),
    quote: parts[2],
  };
}
