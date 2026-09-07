export function extractDocument(text) {
  const lines = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const dates = [...text.matchAll(/\b(?:20\d{2})[.\-/년\s](?:0?[1-9]|1[0-2])[.\-/월\s](?:0?[1-9]|[12]\d|3[01])(?:일)?\b/g)].map(m=>m[0]);
  const money = [...text.matchAll(/(?:₩|￦|KRW\s*)?\d{1,3}(?:,\d{3})+(?:\.\d+)?\s*(?:원)?/g)].map(m=>m[0]);
  const phones = [...text.matchAll(/(?:0\d{1,2})[-\s)]?\d{3,4}[-\s]?\d{4}/g)].map(m=>m[0]);
  const emails = [...text.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)].map(m=>m[0]);
  const urls = [...text.matchAll(/https?:\/\/[^\s]+/gi)].map(m=>m[0]);
  const numbers = [...text.matchAll(/\b\d+(?:\.\d+)?(?:ms|s|x|%|MB|GB)?\b/gi)].map(m=>m[0]);
  return {
    summary: lines.slice(0, 5),
    dates: unique(dates),
    amounts: unique(money),
    phones: unique(phones),
    emails: unique(emails),
    urls: unique(urls),
    numeric_values: unique(numbers).slice(0, 40)
  };
}

export function extractTable(text) {
  const rows = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean).map(line => {
    let cells = line.split(/\s{2,}|\t+/).map(s=>s.trim()).filter(Boolean);
    if (cells.length < 2) {
      const m = line.match(/^(.*?)[\s]+([₩$￦]?\d[\d,.]*(?:\s*원)?)$/);
      if (m) cells = [m[1].trim(), m[2].trim()];
    }
    return cells;
  }).filter(cells => cells.length >= 2);
  return rows;
}

export function rowsToMarkdown(rows) {
  if (!rows.length) return '표 형태의 행/열을 안정적으로 찾지 못했습니다.\n\nOCR 원문을 확인하거나 Cloud Document AI를 추가해 보세요.';
  const width = Math.max(...rows.map(r=>r.length));
  const padded = rows.map(r => [...r, ...Array(width-r.length).fill('')]);
  const head = padded[0];
  const sep = Array(width).fill('---');
  return [head, sep, ...padded.slice(1)].map(r => `| ${r.join(' | ')} |`).join('\n');
}

export function formatDocumentJson(text) {
  return JSON.stringify(extractDocument(text), null, 2);
}

function unique(arr) { return [...new Set(arr)]; }
