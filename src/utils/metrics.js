export function tokenize(text) {
  return new Set((text || '').toLowerCase().replace(/[^\p{L}\p{N}.%₩$-]+/gu, ' ').split(/\s+/).filter(Boolean));
}

export function jaccard(a, b) {
  const A = tokenize(a), B = tokenize(b);
  if (!A.size && !B.size) return 1;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  const union = new Set([...A, ...B]).size;
  return union ? inter / union : 0;
}

export function agreementScores(results) {
  const complete = results.filter(r => r.status === 'done' && r.text);
  return complete.map(r => {
    const peers = complete.filter(p => p.id !== r.id);
    const score = peers.length ? peers.reduce((s,p) => s + jaccard(r.text,p.text),0) / peers.length : 0;
    return { id: r.id, score };
  });
}

export function diffSummary(results) {
  const complete = results.filter(r => r.status === 'done' && r.text);
  if (complete.length < 2) return { common: [], unique: [] };
  const sets = complete.map(r => ({ id:r.id,label:r.label,set:tokenize(r.text) }));
  const common = [...sets[0].set].filter(t => sets.every(s => s.set.has(t))).slice(0, 50);
  const unique = sets.map(s => ({ label:s.label, tokens:[...s.set].filter(t => !sets.filter(x => x.id !== s.id).some(x => x.set.has(t))).slice(0,24) }));
  return { common, unique };
}

export function formatDuration(ms) {
  if (!Number.isFinite(ms)) return '—';
  return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms/1000).toFixed(2)}s`;
}
