import { canvasToDataUrl } from '../utils/image.js';

export async function testCloudConnection(endpoint, apiKey) {
  const url = `${endpoint.replace(/\/$/,'')}/models`;
  const res = await fetch(url, { headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {} });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return Array.isArray(data.data) ? data.data.length : null;
}

export async function runCloudModel({ endpoint, apiKey, model, task, canvases, onProgress }) {
  const start = performance.now();
  const prompt = taskPrompt(task);
  const content = [{ type:'text', text: prompt }];
  for (const canvas of canvases.slice(0,3)) content.push({ type:'image_url', image_url:{ url: canvasToDataUrl(canvas) } });
  onProgress?.({ status: `${model} 요청 전송`, progress: .25 });
  const res = await fetch(`${endpoint.replace(/\/$/,'')}/chat/completions`, {
    method:'POST',
    headers: { 'Content-Type':'application/json', ...(apiKey ? { Authorization:`Bearer ${apiKey}` } : {}) },
    body: JSON.stringify({ model, temperature: 0, messages:[{ role:'user', content }] })
  });
  if (!res.ok) {
    const detail = await res.text().catch(()=> '');
    throw new Error(`HTTP ${res.status}${detail ? ` · ${detail.slice(0,180)}` : ''}`);
  }
  const data = await res.json();
  onProgress?.({ status: `${model} 응답 수신`, progress: .92 });
  const text = normalizeContent(data.choices?.[0]?.message?.content ?? data.output_text ?? data);
  return { text, confidence:null, words:[], latency:performance.now()-start, usage:data.usage || null };
}

function normalizeContent(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map(x => x?.text || x?.content || '').filter(Boolean).join('\n');
  return JSON.stringify(content, null, 2);
}

function taskPrompt(task) {
  if (task === 'ocr' || task === 'compare') return 'Read all visible text exactly. Preserve line breaks, numbers, punctuation, Korean and English. Do not invent content.';
  if (task === 'table') return 'Extract visible tables faithfully. Return Markdown table(s). Preserve numbers and headers. If no table exists, say so.';
  if (task === 'document') return 'Extract the document into structured JSON. Include only fields actually visible. Prefer keys such as title, date, vendor, totals, items, contacts, and identifiers when present.';
  return 'Describe the image accurately and concisely. Also list important visible text and numbers. Do not guess details that are not visible.';
}
