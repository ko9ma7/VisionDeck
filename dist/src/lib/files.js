export function getInputKind(file) {
  if (!file) return 'unknown';
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) return 'pdf';
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  return 'unknown';
}

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function autoRoute(file) {
  if (!file) return { kind: 'OCR', label: 'Demo receipt', reason: '첫 실행용 샘플 영수증입니다. 숫자와 필드 추출을 비교하기 위해 OCR 모델 3개를 선택했습니다.', recommendedModelIds: ['zai-org/glm-ocr', 'deepseek-ai/deepseek-ocr-2', 'rednote-hilab/dots.mocr'] };
  const kind = getInputKind(file);
  const name = file?.name.toLowerCase() ?? '';
  if (/screen|screenshot|capture|캡처|스크린/.test(name)) return { kind: 'UI Vision', label: 'Screenshot / UI', reason: '파일명에서 스크린샷 패턴을 감지했습니다. 화면 이해형 VLM을 우선 추천합니다.', recommendedModelIds: ['qwen/qwen3.5-0.8b', 'zai-org/glm-ocr'] };
  if (/receipt|invoice|영수증|세금|계산서|bill/.test(name)) return { kind: 'OCR', label: 'Receipt / Invoice', reason: '영수증·인보이스 패턴을 감지했습니다. 숫자와 필드 추출에 강한 OCR 모델을 우선합니다.', recommendedModelIds: ['zai-org/glm-ocr', 'deepseek-ai/deepseek-ocr-2', 'rednote-hilab/dots.mocr'] };
  if (/table|sheet|표|statement|명세/.test(name) || kind === 'pdf') return { kind: 'Document', label: 'Document / Table', reason: 'PDF 또는 표 문서로 판단했습니다. 문서 구조와 마크다운 복원을 함께 비교합니다.', recommendedModelIds: ['rednote-hilab/dots.mocr', 'zai-org/glm-ocr', 'deepseek-ai/deepseek-ocr-2'] };
  if (kind === 'image' || kind === 'video') return { kind: 'VLM', label: kind === 'video' ? 'Video' : 'General Image', reason: '일반 시각 입력으로 판단했습니다. 설명·질의응답이 가능한 VLM을 우선합니다.', recommendedModelIds: ['qwen/qwen3.5-0.8b', 'zai-org/glm-ocr'] };
  return { kind: 'OCR', label: 'Unknown input', reason: '파일 형식을 확정하지 못해 범용 OCR 비교 구성을 적용했습니다.', recommendedModelIds: ['zai-org/glm-ocr', 'deepseek-ai/deepseek-ocr-2', 'rednote-hilab/dots.mocr'] };
}

export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('파일을 읽지 못했습니다.'));
    reader.readAsDataURL(file);
  });
}
