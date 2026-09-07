export const MODELS = [
  {
    id: 'zai-org/glm-ocr', name: 'GLM-OCR', shortName: 'GLM-OCR', vendor: 'Z.ai', kind: 'OCR', speedClass: 'Fast',
    description: '문서 OCR과 레이아웃 보존에 초점을 둔 경량 모델', recommendedFor: ['영수증', '인보이스', '한국어 문서', '스캔 PDF'],
  },
  {
    id: 'deepseek-ai/deepseek-ocr-2', name: 'DeepSeek OCR 2', shortName: 'DeepSeek OCR 2', vendor: 'DeepSeek', kind: 'OCR', speedClass: 'Balanced',
    description: '복잡한 문서 구조와 텍스트 복원 비교용 OCR 모델', recommendedFor: ['표', '숫자', '다단 문서', '스캔 PDF'],
  },
  {
    id: 'rednote-hilab/dots.mocr', name: 'dots.mocr', shortName: 'dots.mocr', vendor: 'RedNote HiLab', kind: 'Document', speedClass: 'Quality',
    description: '마크다운 기반 문서 구조 복원과 표 추출에 적합', recommendedFor: ['표', '문서 구조', '레이아웃', '인보이스'],
  },
  {
    id: 'qwen/qwen3.5-0.8b', name: 'Qwen 3.5 0.8B', shortName: 'Qwen 3.5', vendor: 'Qwen', kind: 'VLM', speedClass: 'Fast',
    description: '이미지·영상 설명과 일반 Vision 질의에 적합', recommendedFor: ['일반 사진', '스크린샷', '영상', '이미지 설명'],
  },
];

export const DEFAULT_MODEL_IDS = ['zai-org/glm-ocr', 'deepseek-ai/deepseek-ocr-2', 'rednote-hilab/dots.mocr'];
