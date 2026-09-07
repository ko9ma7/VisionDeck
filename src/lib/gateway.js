import { fileToDataUrl, getInputKind } from './files.js';

function extractContent(data) {
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map((item) => item?.text ?? '').join('\n').trim();
  return '';
}

export async function runGatewayModel(model, file, settings, prompt) {
  const started = performance.now();
  const kind = getInputKind(file);
  const endpoint = `${settings.endpoint.replace(/\/$/, '')}/chat/completions`;
  let content;

  if (settings.remoteUrl.trim()) {
    const remoteUrl = settings.remoteUrl.trim();
    const visual = kind === 'pdf'
      ? { type: 'document_url', document_url: { url: remoteUrl } }
      : kind === 'video'
        ? { type: 'video_url', video_url: { url: remoteUrl } }
        : { type: 'image_url', image_url: { url: remoteUrl } };
    content = [visual, { type: 'text', text: prompt }];
  } else if (kind === 'image') {
    const dataUrl = await fileToDataUrl(file);
    content = [{ type: 'image_url', image_url: { url: dataUrl } }, { type: 'text', text: prompt }];
  } else {
    throw new Error('브라우저 Live 모드에서 PDF·영상 로컬 파일은 public URL 또는 CORS 가능한 프록시가 필요합니다. 설정에서 Remote URL을 입력하세요.');
  }

  const body = {
    model: model.id,
    messages: [{ role: 'user', content }],
  };
  if (model.kind === 'OCR') body.method = 'ocr';
  if (model.kind === 'Document') body.method = 'markdown';
  if (kind === 'pdf') body.document_dpi = 150;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(settings.apiKey.trim() ? { Authorization: `Bearer ${settings.apiKey.trim()}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || `Gateway HTTP ${response.status}`);
  const output = extractContent(data);
  if (!output) throw new Error('Gateway 응답에 표시 가능한 content가 없습니다.');
  return { output, latencyMs: Math.round(performance.now() - started), costUsd: typeof data?.usage?.cost === 'number' ? data.usage.cost : null };
}
