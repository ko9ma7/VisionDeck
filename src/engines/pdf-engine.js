import { CDN } from '../config.js';

let pdfjsPromise;
async function getPdfjs() {
  if (!pdfjsPromise) pdfjsPromise = import(CDN.pdfjs).then(mod => {
    mod.GlobalWorkerOptions.workerSrc = CDN.pdfWorker;
    return mod;
  });
  return pdfjsPromise;
}

export async function loadPdf(file) {
  const pdfjs = await getPdfjs();
  const data = new Uint8Array(await file.arrayBuffer());
  const task = pdfjs.getDocument({ data, useWasm: false });
  return task.promise;
}

export async function renderPdfPage(pdf, pageNumber, targetWidth = 1500) {
  const page = await pdf.getPage(pageNumber);
  const base = page.getViewport({ scale: 1 });
  const scale = Math.min(2.4, Math.max(1.2, targetWidth / base.width));
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext('2d', { alpha: false });
  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas;
}

export async function renderPdfPages(pdf, maxPages = 3, onProgress) {
  const count = Math.min(pdf.numPages, maxPages);
  const pages = [];
  for (let i=1;i<=count;i++) {
    onProgress?.({ status: `PDF ${i}/${count} 렌더링`, progress: (i-1)/count });
    pages.push(await renderPdfPage(pdf, i));
  }
  return pages;
}
