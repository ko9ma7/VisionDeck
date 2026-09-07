function normalize(input) {
  return input.toLowerCase().replace(/[<>#*_|`~[\](){},.:;!?"']/g, ' ').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
}
function jaccard(a, b) {
  const aa = new Set(a); const bb = new Set(b);
  if (!aa.size && !bb.size) return 1;
  const inter = [...aa].filter((token) => bb.has(token)).length;
  const union = new Set([...aa, ...bb]).size;
  return union ? inter / union : 0;
}
export function consensusScores(outputs) {
  const entries = Object.entries(outputs).filter(([, value]) => value.trim());
  if (entries.length <= 1) return Object.fromEntries(entries.map(([id]) => [id, 100]));
  const tokenized = Object.fromEntries(entries.map(([id, text]) => [id, normalize(text)]));
  const result = {};
  for (const [id] of entries) {
    const peers = entries.filter(([peerId]) => peerId !== id);
    const avg = peers.reduce((sum, [peerId]) => sum + jaccard(tokenized[id], tokenized[peerId]), 0) / peers.length;
    result[id] = Math.round(Math.min(99, Math.max(58, 62 + avg * 42)));
  }
  return result;
}
