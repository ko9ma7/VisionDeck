export const CDN = {
  tesseract: 'https://cdn.jsdelivr.net/npm/tesseract.js@7/dist/tesseract.esm.min.js',
  pdfjs: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.3.289/build/pdf.mjs',
  pdfWorker: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.3.289/build/pdf.worker.mjs',
  transformers: 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0'
};

export const DEFAULT_CLOUD_MODELS = [
  { id: 'glm-ocr', label: 'GLM-OCR', role: 'OCR' },
  { id: 'deepseek-ocr-2', label: 'DeepSeek OCR 2', role: 'OCR' },
  { id: 'dots.mocr', label: 'dots.mocr', role: 'Document' },
  { id: 'qwen3.5-0.8b', label: 'Qwen 3.5', role: 'VLM' }
];

export const LOCAL_PIPELINES = [
  { id: 'tess-original', label: 'Tesseract Original', short: 'T0', role: 'OCR', location: 'LOCAL', engine: 'tesseract', profile: 'original', tasks: ['ocr','table','document','compare'], enabledByDefault: true, description: 'WASM · 원본 이미지' },
  { id: 'tess-contrast', label: 'Tesseract Contrast', short: 'TC', role: 'OCR', location: 'LOCAL', engine: 'tesseract', profile: 'contrast', tasks: ['ocr','table','document','compare'], enabledByDefault: true, description: 'WASM · 대비 보정' },
  { id: 'tess-threshold', label: 'Tesseract Threshold', short: 'TB', role: 'OCR', location: 'LOCAL', engine: 'tesseract', profile: 'threshold', tasks: ['ocr','table','document','compare'], enabledByDefault: true, description: 'WASM · 이진화' },
  { id: 'local-caption', label: 'Local Caption AI', short: 'VC', role: 'VLM', location: 'LOCAL', engine: 'transformers', model: 'Xenova/vit-gpt2-image-captioning', tasks: ['vision','compare'], enabledByDefault: false, optionalDownload: true, description: 'Transformers.js · WebGPU/WASM' },
  { id: 'local-trocr', label: 'Local TrOCR', short: 'TR', role: 'OCR', location: 'LOCAL', engine: 'transformers', model: 'Xenova/trocr-small-printed', tasks: ['ocr','compare'], enabledByDefault: false, optionalDownload: true, description: '영문 인쇄물 · WebGPU/WASM' }
];
