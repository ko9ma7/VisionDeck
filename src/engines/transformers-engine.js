import { CDN } from '../config.js';
import { canvasToBlobUrl } from '../utils/image.js';

const pipelines = new Map();

async function getTransformers() {
  return import(CDN.transformers);
}

async function getPipeline(modelId, onProgress) {
  if (pipelines.has(modelId)) return pipelines.get(modelId);
  const promise = (async () => {
    const { pipeline, env } = await getTransformers();
    env.allowLocalModels = false;
    const device = navigator.gpu ? 'webgpu' : 'wasm';
    onProgress?.({ status: `모델 다운로드/초기화 · ${device}`, progress: .02 });
    return pipeline('image-to-text', modelId, {
      device,
      dtype: 'q8',
      progress_callback: item => {
        const p = typeof item.progress === 'number' ? item.progress / 100 : undefined;
        onProgress?.({ status: item.status || '모델 준비 중', progress: p });
      }
    });
  })();
  pipelines.set(modelId, promise);
  try { return await promise; } catch (e) { pipelines.delete(modelId); throw e; }
}

export async function prepareTransformersModel(modelId, onProgress) {
  await getPipeline(modelId, onProgress);
}

export async function runImageToText(canvas, modelId, onProgress) {
  const start = performance.now();
  const pipe = await getPipeline(modelId, onProgress);
  const url = await canvasToBlobUrl(canvas);
  try {
    onProgress?.({ status: '로컬 AI 추론 중', progress: .86 });
    const out = await pipe(url, { max_new_tokens: 96 });
    const text = Array.isArray(out) ? (out[0]?.generated_text || JSON.stringify(out)) : String(out?.generated_text || out);
    return { text: text.trim(), confidence: null, words: [], latency: performance.now() - start };
  } finally {
    URL.revokeObjectURL(url);
  }
}
