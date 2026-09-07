export async function fileToCanvas(file) {
  if (file.type.startsWith('image/')) return imageFileToCanvas(file);
  if (file.type.startsWith('video/')) return videoFileToCanvas(file);
  throw new Error('이미지 또는 영상 파일이 아닙니다.');
}

export async function imageFileToCanvas(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    return imageElementToCanvas(img);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function imageElementToCanvas(img) {
  const maxEdge = 2400;
  const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round((img.naturalWidth || img.width) * scale));
  canvas.height = Math.max(1, Math.round((img.naturalHeight || img.height) * scale));
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export async function videoFileToCanvas(file) {
  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.src = url;
    await new Promise((resolve, reject) => {
      video.onloadedmetadata = resolve;
      video.onerror = () => reject(new Error('영상을 읽을 수 없습니다.'));
    });
    video.currentTime = Math.min(Math.max(video.duration * 0.12, 0.1), 2);
    await new Promise((resolve) => { video.onseeked = resolve; });
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 1920 / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function preprocessCanvas(source, profile) {
  if (profile === 'original') return cloneCanvas(source);
  const canvas = cloneCanvas(source);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = image.data;
  let avg = 0;
  for (let i = 0; i < d.length; i += 4) avg += (d[i] * .299 + d[i+1] * .587 + d[i+2] * .114);
  avg /= (d.length / 4);
  for (let i = 0; i < d.length; i += 4) {
    const g = d[i] * .299 + d[i+1] * .587 + d[i+2] * .114;
    let v;
    if (profile === 'contrast') v = Math.max(0, Math.min(255, (g - 128) * 1.55 + 128));
    else v = g > avg * .92 ? 255 : 0;
    d[i] = d[i+1] = d[i+2] = v;
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

export function cloneCanvas(source) {
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  canvas.getContext('2d').drawImage(source, 0, 0);
  return canvas;
}

export function canvasToDataUrl(canvas, type = 'image/jpeg', quality = .9) {
  return canvas.toDataURL(type, quality);
}

export function canvasToBlobUrl(canvas) {
  return new Promise((resolve, reject) => canvas.toBlob(blob => {
    if (!blob) reject(new Error('이미지 변환 실패'));
    else resolve(URL.createObjectURL(blob));
  }, 'image/jpeg', .92));
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('이미지를 읽을 수 없습니다.'));
    img.src = url;
  });
}
