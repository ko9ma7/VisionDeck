import { CDN } from '../config.js';
import { preprocessCanvas } from '../utils/image.js';

let workerPromise = null;
let activeProgress = () => {};

async function getWorker(onProgress) {
  activeProgress = onProgress || (()=>{});
  if (!workerPromise) {
    workerPromise = (async () => {
      const mod = await import(CDN.tesseract);
      const worker = await mod.createWorker('kor+eng', 1, {
        logger: m => {
          const p = typeof m.progress === 'number' ? m.progress : 0;
          activeProgress({ status: m.status || 'OCR 준비', progress: p });
        }
      });
      return { worker, PSM: mod.PSM };
    })();
  }
  return workerPromise;
}

export async function runTesseract(canvases, profile, onProgress) {
  const { worker, PSM } = await getWorker(onProgress);
  const start = performance.now();
  const texts = [];
  const allWords = [];
  const confidences = [];
  for (let i = 0; i < canvases.length; i++) {
    const processed = preprocessCanvas(canvases[i], profile);
    const psm = profile === 'threshold' ? (PSM?.SPARSE_TEXT || '11') : (profile === 'contrast' ? (PSM?.SINGLE_BLOCK || '6') : (PSM?.AUTO || '3'));
    await worker.setParameters({ tessedit_pageseg_mode: psm, preserve_interword_spaces: '1' });
    onProgress?.({ status: `페이지 ${i+1}/${canvases.length} OCR`, progress: i / canvases.length });
    const ret = await worker.recognize(processed, {}, { blocks: true });
    texts.push(ret.data.text || '');
    const words = flattenWords(ret.data.blocks || []);
    words.forEach(w => {
      allWords.push({ ...w, page: i + 1 });
      if (Number.isFinite(w.confidence)) confidences.push(w.confidence);
    });
  }
  const meanConfidence = confidences.length ? confidences.reduce((a,b)=>a+b,0)/confidences.length : null;
  return {
    text: texts.map((t,i) => canvases.length > 1 ? `[Page ${i+1}]\n${t.trim()}` : t.trim()).join('\n\n'),
    words: allWords,
    confidence: meanConfidence,
    latency: performance.now() - start
  };
}

function flattenWords(blocks) {
  const words = [];
  for (const block of blocks || []) for (const paragraph of block.paragraphs || []) for (const line of paragraph.lines || []) for (const word of line.words || []) {
    words.push({ text: word.text, confidence: word.confidence, bbox: word.bbox });
  }
  return words;
}

export async function terminateTesseract() {
  if (!workerPromise) return;
  try { const { worker } = await workerPromise; await worker.terminate(); } catch {}
  workerPromise = null;
}
