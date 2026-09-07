import { builtinTemplates, hydrateMotion, motionPresets, templateCategories } from './templates.js?v=9.0.0';
import { soundPresets, createProceduralBuffer, addSceneAccents, applyFade } from './audio.js?v=9.0.0';
import { buildBeatSpecs, createDirectorPlan, moveFlowStep, planSummary, rebuildFlowFromSelection, removeFlowStep, suggestInternalLinks, toggleElementSelection, updateFlowStep } from './director.js?v=9.0.0';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const lerp = (a, b, t) => a + (b - a) * t;
const easeInOut = (t) => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeOutCubic = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
const smoothStep = (t) => { const p = clamp(t, 0, 1); return p * p * (3 - 2 * p); };
function windowProgress(progress, start, end, easing = 'cinematic') {
  const p = clamp((progress - start) / Math.max(.001, end - start), 0, 1);
  if (easing === 'settle') return easeOutCubic(p);
  if (easing === 'linear') return p;
  return easeInOut(p);
}
const STORAGE_KEY = 'motionframe:v9:project';
const LEGACY_STORAGE_KEYS = ['motionframe:v7:project','motionframe:v6:project','motionframe:v5:project'];
const TEMPLATE_KEY = 'motionframe:v9:templates';
const LEGACY_TEMPLATE_KEYS = ['motionframe:v7:templates','motionframe:v6:templates','motionframe:v5:templates'];
const DB_NAME = 'motionframe-studio-v5';
const DB_STORE = 'assets';
const API_ENDPOINT = 'https://api.microlink.io/';
const DOM_FUNCTION = `({page:p})=>p.evaluate(()=>{let d=document.documentElement,q='h1,h2,h3,nav a,button,a[href],img,video,canvas,textarea,[class*=preview],[class*=browser]',a=[...document.querySelectorAll(q)];return{w:d.scrollWidth,h:d.scrollHeight,iw:innerWidth,ih:innerHeight,sx:scrollX,sy:scrollY,e:a.slice(0,120).map((e,i)=>{let r=e.getBoundingClientRect(),g=e.tagName.toLowerCase(),m=/^(img|video|canvas|textarea)$/.test(g)||/preview|browser/.test(e.className||''),k=e.hash&&document.getElementById(e.hash.slice(1)),z=k&&k.getBoundingClientRect(),t=(m?(e.getAttribute('aria-label')||e.getAttribute('alt')||e.previousElementSibling?.innerText||'Product area'):(e.innerText||e.textContent||e.getAttribute('aria-label')||'')).trim().replace(/\s+/g,' ').slice(0,80);return !t||r.width<8||r.height<8?null:{i:'e'+i,g,r:m?'surface':'',t,u:e.href||'',x:r.left+r.width/2+scrollX,y:r.top+r.height/2+scrollY,o:r.top+scrollY,w:r.width,h:r.height,X:z?z.left+z.width/2+scrollX:0,Y:z?z.top+z.height/2+scrollY:0,n:!!e.closest('nav')}}).filter(Boolean)}})`;

let dbPromise;
let state;
let selectedSceneId = null;
let currentTime = 0;
let playing = false;
let playStartStamp = 0;
let renderRaf = 0;
let templateFilter = 'all';
let templateSearchQuery = '';
let lastCaptureProvider = '';
let exportInProgress = false;
let previewAudio = null;
let soundPreviewTimer = 0;
let customAudioBufferCache = null;
const assetUrlCache = new Map();
const imageCache = new Map();
const videoCache = new Map();
let screenRecording = null;
let pathEditMode = 'straight';
let pathEditing = false;
let pathDrawing = false;
let pathDraft = [];
let directorPlan = null;
let directorBases = [];
let directorTemplateId = 'impact-flow';
let lastFrameProjection = null;

const canvas = $('#previewCanvas');
const ctx = canvas.getContext('2d', { alpha: false });

const createId = (prefix = 'id') => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) return resolve(null);
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function putAsset(key, blob) {
  const db = await openDb();
  if (!db) throw new Error('이 브라우저에서는 IndexedDB를 사용할 수 없습니다.');
  await new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).put(blob, key);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  if (assetUrlCache.has(key)) URL.revokeObjectURL(assetUrlCache.get(key));
  assetUrlCache.delete(key);
  imageCache.delete(key);
  videoCache.delete(key);
}

async function getAsset(key) {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readonly');
    const req = tx.objectStore(DB_STORE).get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function deleteAsset(key) {
  const db = await openDb();
  if (!db) return;
  await new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).delete(key);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  if (assetUrlCache.has(key)) URL.revokeObjectURL(assetUrlCache.get(key));
  assetUrlCache.delete(key);
  imageCache.delete(key);
  const video = videoCache.get(key); if (video) { try { video.pause(); } catch {} }
  videoCache.delete(key);
}

async function getAssetUrl(key) {
  if (assetUrlCache.has(key)) return assetUrlCache.get(key);
  const blob = await getAsset(key);
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  assetUrlCache.set(key, url);
  return url;
}

function demoSvg(title, accent, variant = 0) {
  const rows = variant === 0
    ? '<rect x="250" y="310" width="610" height="28" rx="10" fill="#e7ebf2"/><rect x="250" y="358" width="610" height="28" rx="10" fill="#e7ebf2"/><rect x="250" y="406" width="610" height="28" rx="10" fill="#e7ebf2"/>'
    : variant === 1
      ? '<rect x="250" y="286" width="180" height="154" rx="18" fill="#e8edf5"/><rect x="450" y="286" width="180" height="154" rx="18" fill="#e8edf5"/><rect x="650" y="286" width="210" height="154" rx="18" fill="#e8edf5"/>'
      : '<path d="M270 405 C340 330,390 380,450 302 S590 352,650 270 S760 310,850 230" fill="none" stroke="#7f8ba2" stroke-width="10" stroke-linecap="round"/><circle cx="650" cy="270" r="14" fill="'+accent+'"/>';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="750" viewBox="0 0 1200 750"><rect width="1200" height="750" fill="#f7f9fc"/><rect width="1200" height="70" fill="#fff"/><circle cx="34" cy="35" r="7" fill="#d8dee8"/><circle cx="56" cy="35" r="7" fill="#d8dee8"/><circle cx="78" cy="35" r="7" fill="#d8dee8"/><rect x="102" y="22" width="310" height="26" rx="9" fill="#eff2f6"/><rect x="30" y="96" width="165" height="620" rx="18" fill="#101827"/><text x="58" y="140" font-family="Arial" font-size="18" font-weight="700" fill="#f7f9fc">MotionFrame</text><rect x="55" y="178" width="100" height="10" rx="5" fill="#31405a"/><rect x="55" y="218" width="82" height="10" rx="5" fill="#31405a"/><rect x="55" y="258" width="110" height="10" rx="5" fill="#31405a"/><text x="250" y="145" font-family="Arial" font-size="36" font-weight="700" fill="#151c28">${title}</text><rect x="250" y="176" width="390" height="14" rx="7" fill="#d9dfe9"/><rect x="250" y="210" width="210" height="14" rx="7" fill="#d9dfe9"/><rect x="720" y="118" width="140" height="48" rx="14" fill="${accent}"/>${rows}<rect x="250" y="492" width="610" height="170" rx="18" fill="#eef2f7"/><rect x="280" y="528" width="190" height="18" rx="9" fill="#cfd7e3"/><rect x="280" y="566" width="450" height="12" rx="6" fill="#dbe1ea"/><rect x="280" y="594" width="390" height="12" rx="6" fill="#dbe1ea"/></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function baseScene(overrides = {}) {
  return hydrateMotion({
    id: createId('scene'),
    name: '새 장면',
    sourceType: 'demo',
    assetKey: null,
    imageUrl: '',
    sourceUrl: '',
    sourceAnalysis: null,
    motionPath: [],
    pathType: 'straight',
    cursorFollowPath: false,
    duration: 2.4,
    transition: 'crossfade',
    motionPreset: 'overview',
    shotIntent: 'focus',
    cameraMoveStart: 0.08,
    cameraMoveEnd: 0.68,
    cursorMoveStart: 0.18,
    cursorMoveEnd: 0.66,
    clickStart: 0.72,
    clickEnd: 0.86,
    startAnchorX: 0.5,
    startAnchorY: 0.5,
    focusAnchorX: 0.5,
    focusAnchorY: 0.5,
    startZoom: 100,
    endZoom: 116,
    startX: 50,
    startY: 50,
    endX: 50,
    endY: 46,
    cursorEnabled: false,
    cursorStartX: 50,
    cursorStartY: 50,
    cursorX: 66,
    cursorY: 52
  }, overrides.motionPreset || 'overview', overrides);
}

function demoProject() {
  return {
    version: 9,
    aspect: '16:9',
    resolution: '1280x720',
    frameStyle: 'browser',
    directorPlan: null,
    directorTemplateId: 'impact-flow',
    audio: { preset: 'softCorporate', volume: 42, fade: true, assetKey: null, name: '' },
    scenes: [
      baseScene({ name: '전체 화면', imageUrl: demoSvg('Automation overview', '#8da5ff', 0), duration: 2.2, sourceType: 'demo', motionPreset: 'overview' }),
      baseScene({ name: '기능 포커스', imageUrl: demoSvg('Workflow builder', '#91d2b3', 1), duration: 2.4, sourceType: 'demo', motionPreset: 'focus', endX: 67, endY: 46, cursorX: 69, cursorY: 48 }),
      baseScene({ name: '결과 확인', imageUrl: demoSvg('Report analytics', '#efc87a', 2), duration: 2.2, sourceType: 'demo', motionPreset: 'pullout', transition: 'zoom-out' })
    ]
  };
}

function sanitizeProject(project) {
  const fallback = demoProject();
  if (!project || !Array.isArray(project.scenes)) return fallback;
  return {
    version: 9,
    aspect: ['16:9','9:16','1:1'].includes(project.aspect) ? project.aspect : '16:9',
    resolution: ['1280x720','1920x1080'].includes(project.resolution) ? project.resolution : '1280x720',
    frameStyle: ['browser','floating','none'].includes(project.frameStyle) ? project.frameStyle : 'browser',
    directorPlan: project.directorPlan?.pages ? project.directorPlan : null,
    directorTemplateId: project.directorTemplateId === 'web-story' ? 'impact-flow' : (typeof project.directorTemplateId === 'string' ? project.directorTemplateId : 'impact-flow'),
    audio: {
      preset: normalizeAudioPreset(project.audio?.preset),
      volume: clamp(Number(project.audio?.volume ?? 42), 0, 100),
      fade: project.audio?.fade !== false,
      assetKey: project.audio?.assetKey || null,
      name: project.audio?.name || ''
    },
    scenes: project.scenes.map((scene) => baseScene({ ...scene, id: scene.id || createId('scene') }))
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || LEGACY_STORAGE_KEYS.map((key)=>localStorage.getItem(key)).find(Boolean);
    const project = sanitizeProject(raw ? JSON.parse(raw) : null);
    if (!project.scenes.length) return demoProject();
    return project;
  } catch {
    return demoProject();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  $('#saveState').textContent = '저장됨';
  clearTimeout(saveState.timer);
  saveState.timer = setTimeout(() => { $('#saveState').textContent = '로컬 저장'; }, 1300);
}

function loadCustomTemplates() {
  try {
    const raw = localStorage.getItem(TEMPLATE_KEY) || LEGACY_TEMPLATE_KEYS.map((key)=>localStorage.getItem(key)).find(Boolean) || '[]';
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}

function storeCustomTemplates(templates) {
  localStorage.setItem(TEMPLATE_KEY, JSON.stringify(templates));
}

function currentTemplates() { return [...builtinTemplates, ...loadCustomTemplates()]; }

function totalDuration() { return state.scenes.reduce((sum, scene) => sum + Number(scene.duration || 0), 0); }

function formatTime(value) {
  const seconds = Math.max(0, value || 0);
  const min = Math.floor(seconds / 60).toString().padStart(2, '0');
  const sec = Math.floor(seconds % 60).toString().padStart(2, '0');
  const tenth = Math.floor((seconds % 1) * 10);
  return `${min}:${sec}.${tenth}`;
}

function toast(message, type = 'info') {
  const el = document.createElement('div');
  el.className = `toast ${type === 'error' ? 'error' : ''}`;
  el.textContent = message;
  $('#toastRoot').append(el);
  setTimeout(() => el.remove(), 3600);
}

function setCaptureStatus(title, text, mode = '') {
  const el = $('#captureStatus');
  el.className = `capture-status ${mode}`.trim();
  el.querySelector('strong').textContent = title;
  el.querySelector('p').textContent = text;
}

function cleanTextArray(value, limit = 8) {
  const list = Array.isArray(value) ? value : value ? [value] : [];
  return [...new Set(list.map((item) => String(item || '').replace(/\s+/g, ' ').trim()).filter((item) => item.length >= 2 && item.length <= 100))].slice(0, limit);
}

function normalizeAudioPreset(id) {
  const legacy = { softPulse: 'softCorporate', airPad: 'ambientFlow', focusGrid: 'focusDrive', launchBeat: 'launchDrive' };
  const next = legacy[id] || id || 'softCorporate';
  return soundPresets.some((item) => item.id === next) ? next : 'softCorporate';
}

function normalizePageAnalysis(payload, url, captureMode = 'full') {
  const data = payload?.data || {};
  const title = String(data.title || '').replace(/\s+/g, ' ').trim();
  const fn = data.function?.isFulfilled ? data.function.value : null;
  const elements = Array.isArray(fn?.e) ? fn.e.map((item, index) => ({
    id: item.id || `e${index}`,
    tag: String(item.tag || item.g || '').toLowerCase(),
    role: String(item.role || item.r || ''),
    text: String(item.text || item.t || '').replace(/\s+/g, ' ').trim(),
    href: String(item.href || item.u || ''),
    x: Number(item.x || 0),
    y: Number(item.y || 0),
    top: Number(item.top || item.o || item.y || 0),
    w: Number(item.w || 0),
    h: Number(item.h || 0),
    targetX: Number(item.targetX || item.X || 0),
    targetY: Number(item.targetY || item.Y || 0),
    inNav: Boolean(item.inNav || item.n),
    brand: Boolean(item.brand || item.b)
  })).filter((item) => item.text) : [];
  const headingsFromElements = elements.filter((item) => ['h1','h2','h3'].includes(item.tag)).map((item) => item.text);
  const buttonsFromElements = elements.filter((item) => item.tag === 'button' || item.role === 'button' || (item.tag === 'a' && /button|btn|cta/i.test(item.role))).map((item) => item.text);
  const navFromElements = elements.filter((item) => item.inNav && item.tag === 'a').map((item) => item.text);
  return {
    url,
    title: title || (() => { try { return new URL(url).hostname; } catch { return url; } })(),
    headings: cleanTextArray(headingsFromElements.length ? headingsFromElements : data.headings, 12),
    buttons: cleanTextArray(buttonsFromElements.length ? buttonsFromElements : data.buttons, 10),
    nav: cleanTextArray(navFromElements.length ? navFromElements : data.nav, 10),
    elements,
    documentWidth: Number(fn?.w || 0),
    documentHeight: Number(fn?.h || 0),
    viewportWidth: Number(fn?.iw || 0),
    viewportHeight: Number(fn?.ih || 0),
    scrollX: Number(fn?.sx || 0),
    scrollY: Number(fn?.sy || 0),
    captureMode,
    geometrySource: elements.length ? 'browser-dom' : 'semantic-fallback'
  };
}

function renderDomAnalysis(scenes = []) {
  const root = $('#domAnalysis');
  const chips = $('#domAnalysisChips');
  if (!root || !chips) return;
  const analyses = scenes.map((scene) => scene.sourceAnalysis).filter(Boolean).filter((item,index,list)=>list.findIndex((other)=>other.url===item.url)===index);
  if (!analyses.length) { root.hidden = true; chips.innerHTML = ''; return; }
  const titleCount = analyses.filter((item) => item.title).length;
  const headings = analyses.reduce((sum, item) => sum + item.headings.length, 0);
  const buttons = analyses.reduce((sum, item) => sum + item.buttons.length, 0);
  const positioned = analyses.reduce((sum, item) => sum + (item.elements?.length || 0), 0);
  const links = analyses.reduce((sum, item) => sum + (item.elements || []).filter((element) => element.href).length, 0);
  const media = analyses.reduce((sum, item) => sum + (item.elements || []).filter((element) => element.role === 'media').length, 0);
  chips.innerHTML = `<span><b>${titleCount}</b>페이지</span><span><b>${positioned}</b>좌표 요소</span><span><b>${media}</b>제품 화면</span><span><b>${links}</b>링크</span><span><b>${headings}</b>헤딩</span><span><b>${buttons}</b>버튼</span>`;
  const examples = analyses.flatMap((item) => [...item.headings.slice(0, 2), ...item.buttons.slice(0, 1)]).slice(0, 4);
  examples.forEach((text) => { const chip = document.createElement('span'); chip.textContent = text; chips.append(chip); });
  root.hidden = false;
}

function semanticCues(analysis) {
  if (!analysis) return [];
  const cues = [];
  const add = (type, label, x, y) => {
    const clean = String(label || '').replace(/\s+/g, ' ').trim();
    if (!clean || cues.some((item) => item.label === clean)) return;
    cues.push({ type, label: clean.slice(0, 72), x, y });
  };
  add('title', analysis.title, 50, 16);
  const headingXs = [42, 62, 38, 66, 48, 58];
  analysis.headings.slice(0, 5).forEach((label, index) => add('heading', label, headingXs[index % headingXs.length], 30 + index * 11));
  const buttonXs = [64, 40, 72];
  analysis.buttons.slice(0, 2).forEach((label, index) => add('button', label, buttonXs[index], Math.min(88, 72 + index * 12)));
  return cues.slice(0, 7);
}

function buildSemanticStory(bases, template) {
  const sequence = template.sequence?.length ? template.sequence : [{ motion: 'overview', duration: 2.4, transition: 'crossfade' }];
  const output = [];
  bases.forEach((base) => {
    const cues = semanticCues(base.sourceAnalysis);
    if (!cues.length) {
      sequence.forEach((spec, index) => {
        const scene = structuredClone(base); scene.id = createId('scene');
        output.push(hydrateMotion(scene, spec.motion || 'overview', { ...spec, id: scene.id, name: `${base.name} · ${index + 1}` }));
      });
      return;
    }
    let previous = { x: 50, y: 10 };
    cues.forEach((cue, index) => {
      const spec = sequence[index % sequence.length];
      const scene = structuredClone(base); scene.id = createId('scene');
      const button = cue.type === 'button';
      const title = cue.type === 'title';
      const endZoom = button ? 148 : title ? 116 : 132;
      const pathType = index > 1 ? 'curve' : 'straight';
      const mid = { x: (previous.x + cue.x) / 2 + (index % 2 ? 5 : -4), y: (previous.y + cue.y) / 2 };
      const motionPath = pathType === 'curve' ? [previous, mid, { x: cue.x, y: cue.y }] : [previous, { x: cue.x, y: cue.y }];
      output.push(hydrateMotion(scene, spec.motion || 'focus', {
        ...spec,
        id: scene.id,
        name: cue.label,
        startX: previous.x,
        startY: previous.y,
        endX: cue.x,
        endY: cue.y,
        startZoom: index === 0 ? 100 : Math.min(122, endZoom - 12),
        endZoom,
        motionPath,
        pathType,
        cursorEnabled: button || Boolean(spec.cursorEnabled),
        cursorFollowPath: button,
        cursorX: cue.x,
        cursorY: cue.y
      }));
      previous = { x: cue.x, y: cue.y };
    });
    const outro = structuredClone(base); outro.id = createId('scene');
    output.push(hydrateMotion(outro, 'pullout', { id: outro.id, name: `${base.name} · 전체`, duration: 1.7, transition: 'crossfade', startX: previous.x, startY: previous.y, endX: 50, endY: 50, startZoom: 124, endZoom: 100, motionPath: [previous, { x: 50, y: 50 }], pathType: 'curve' }));
  });
  return output.slice(0, 18);
}

function normalizeUrl(value) {
  let text = String(value || '').trim();
  if (!text) throw new Error('사이트 URL을 입력해 주세요.');
  if (!/^https?:\/\//i.test(text)) text = `https://${text}`;
  const url = new URL(text);
  if (!['http:','https:'].includes(url.protocol)) throw new Error('http 또는 https URL만 사용할 수 있습니다.');
  return url.toString();
}

function parseUrlList(value) {
  const lines = String(value || '').split(/\n+/).map((item) => item.trim()).filter(Boolean);
  if (!lines.length) throw new Error('사이트 URL을 입력해 주세요.');
  return lines.slice(0, 8).map(normalizeUrl);
}

function sceneAssetRef(scene) { return scene.assetKey || scene.imageUrl; }

async function sourceUrlForScene(scene) {
  if (scene.assetKey) return getAssetUrl(scene.assetKey);
  return scene.imageUrl || null;
}

async function imageForScene(scene) {
  const key = sceneAssetRef(scene);
  if (!key) return null;
  if (imageCache.has(key)) return imageCache.get(key);
  const url = await sourceUrlForScene(scene);
  if (!url) return null;
  const promise = new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('이미지를 불러오지 못했습니다.'));
    img.src = url;
  });
  imageCache.set(key, promise);
  return promise;
}

async function videoForScene(scene) {
  const key = sceneAssetRef(scene);
  if (!key) return null;
  if (videoCache.has(key)) return videoCache.get(key);
  const url = await sourceUrlForScene(scene);
  if (!url) return null;
  const promise = new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'auto'; video.muted = true; video.playsInline = true; video.src = url;
    video.addEventListener('loadedmetadata', () => resolve(video), { once:true });
    video.addEventListener('error', () => reject(new Error('영상 클립을 불러오지 못했습니다.')), { once:true });
    video.load();
  });
  videoCache.set(key, promise);
  return promise;
}

async function syncVideoFrame(video, targetTime, duration) {
  const maxTime = Math.max(0, Math.min(video.duration || duration || 0, targetTime));
  if (playing || exportInProgress) {
    if (Math.abs(video.currentTime - maxTime) > .35) video.currentTime = maxTime;
    video.playbackRate = clamp((video.duration || duration || 1) / Math.max(duration || 1, .1), .25, 4);
    if (video.paused) video.play().catch(() => {});
    return;
  }
  video.pause();
  if (Math.abs(video.currentTime - maxTime) <= .03) return;
  await new Promise(resolve => {
    let done = false;
    const finish = () => { if (done) return; done = true; video.removeEventListener('seeked', finish); resolve(); };
    video.addEventListener('seeked', finish, { once:true });
    video.currentTime = maxTime;
    setTimeout(finish, 160);
  });
}

function getOutputSize() {
  const high = state.resolution === '1920x1080';
  if (state.aspect === '9:16') return high ? [1080,1920] : [720,1280];
  if (state.aspect === '1:1') return high ? [1080,1080] : [720,720];
  return high ? [1920,1080] : [1280,720];
}

function syncCanvasSize() {
  const [w,h] = getOutputSize();
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  const shell = $('#canvasShell');
  shell.classList.toggle('portrait', state.aspect === '9:16');
  shell.classList.toggle('square', state.aspect === '1:1');
  $('#previewBadge').textContent = `${state.resolution === '1920x1080' ? '1080p' : '720p'} · 30fps`;
}

function roundedRect(context, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + w, y, x + w, y + h, radius);
  context.arcTo(x + w, y + h, x, y + h, radius);
  context.arcTo(x, y + h, x, y, radius);
  context.arcTo(x, y, x + w, y, radius);
  context.closePath();
}

function mediaCrop(img, w, h, zoom, focusX, focusY, anchorX = .5, anchorY = .5) {
  const sourceWidth = img.naturalWidth || img.videoWidth;
  const sourceHeight = img.naturalHeight || img.videoHeight;
  const targetRatio = w / h;
  const imageRatio = sourceWidth / sourceHeight;
  let baseW, baseH;
  if (imageRatio > targetRatio) { baseH = sourceHeight; baseW = baseH * targetRatio; }
  else { baseW = sourceWidth; baseH = baseW / targetRatio; }
  const z = Math.max(1, zoom / 100);
  const sw = Math.min(sourceWidth, baseW / z);
  const sh = Math.min(sourceHeight, baseH / z);
  const targetX = sourceWidth * clamp(focusX / 100, 0, 1);
  const targetY = sourceHeight * clamp(focusY / 100, 0, 1);
  const sx = clamp(targetX - sw * clamp(anchorX, .12, .88), 0, Math.max(0, sourceWidth - sw));
  const sy = clamp(targetY - sh * clamp(anchorY, .12, .88), 0, Math.max(0, sourceHeight - sh));
  return { sourceWidth, sourceHeight, sx, sy, sw, sh };
}

function drawFocusedMedia(context, img, x, y, w, h, zoom, focusX, focusY, anchorX = .5, anchorY = .5) {
  const crop = mediaCrop(img, w, h, zoom, focusX, focusY, anchorX, anchorY);
  context.drawImage(img, crop.sx, crop.sy, crop.sw, crop.sh, x, y, w, h);
  return crop;
}

function projectSourcePointToFrame(point, crop, x, y, w, h) {
  const px = crop.sourceWidth * clamp(Number(point.x || 0) / 100, 0, 1);
  const py = crop.sourceHeight * clamp(Number(point.y || 0) / 100, 0, 1);
  return {
    x: x + ((px - crop.sx) / Math.max(1, crop.sw)) * w,
    y: y + ((py - crop.sy) / Math.max(1, crop.sh)) * h
  };
}

function drawCursor(context, x, y, size, clickProgress) {
  context.save();
  if (clickProgress > 0 && clickProgress < 1) {
    context.strokeStyle = `rgba(142,168,255,${(1 - clickProgress) * .9})`;
    context.lineWidth = Math.max(2, size * .08);
    context.beginPath();
    context.arc(x, y, size * (.35 + clickProgress * .7), 0, Math.PI * 2);
    context.stroke();
  }
  context.translate(x, y);
  context.scale(size / 34, size / 34);
  context.beginPath();
  context.moveTo(0, 0); context.lineTo(0, 31); context.lineTo(8, 23); context.lineTo(14, 34); context.lineTo(20, 31); context.lineTo(14, 20); context.lineTo(26, 20); context.closePath();
  context.fillStyle = '#ffffff';
  context.strokeStyle = '#0b1019';
  context.lineWidth = 2.4;
  context.fill(); context.stroke();
  context.restore();
}

function frameGeometry(width, height) {
  if (state.frameStyle === 'none') return { x:0, y:0, w:width, h:height, chrome:0, radius:0 };
  const portrait = height > width;
  const mx = state.frameStyle === 'floating' ? width * (portrait ? .10 : .07) : width * (portrait ? .075 : .055);
  const my = state.frameStyle === 'floating' ? height * .08 : height * .065;
  const chrome = state.frameStyle === 'browser' ? Math.max(24, height * .045) : 0;
  return { x:mx, y:my, w:width - mx*2, h:height - my*2, chrome, radius: Math.max(12, width * .012) };
}

function effectiveMotionPath(scene) {
  const points = Array.isArray(scene.motionPath) ? scene.motionPath.filter((point) => Number.isFinite(Number(point?.x)) && Number.isFinite(Number(point?.y))).map((point) => ({ x: clamp(Number(point.x), 0, 100), y: clamp(Number(point.y), 0, 100) })) : [];
  if (points.length >= 2) return points;
  return [{ x: Number(scene.startX ?? 50), y: Number(scene.startY ?? 50) }, { x: Number(scene.endX ?? 50), y: Number(scene.endY ?? 50) }];
}

function samplePolyline(points, progress) {
  if (points.length === 1) return points[0];
  const lengths = []; let total = 0;
  for (let i = 1; i < points.length; i += 1) { const d = Math.hypot(points[i].x - points[i-1].x, points[i].y - points[i-1].y); lengths.push(d); total += d; }
  if (!total) return points[points.length - 1];
  let target = clamp(progress, 0, 1) * total;
  for (let i = 0; i < lengths.length; i += 1) {
    if (target <= lengths[i] || i === lengths.length - 1) { const local = lengths[i] ? target / lengths[i] : 0; return { x: lerp(points[i].x, points[i+1].x, local), y: lerp(points[i].y, points[i+1].y, local) }; }
    target -= lengths[i];
  }
  return points[points.length - 1];
}

function catmullPoint(p0, p1, p2, p3, t) {
  const t2 = t*t, t3 = t2*t;
  return {
    x: .5 * ((2*p1.x) + (-p0.x+p2.x)*t + (2*p0.x-5*p1.x+4*p2.x-p3.x)*t2 + (-p0.x+3*p1.x-3*p2.x+p3.x)*t3),
    y: .5 * ((2*p1.y) + (-p0.y+p2.y)*t + (2*p0.y-5*p1.y+4*p2.y-p3.y)*t2 + (-p0.y+3*p1.y-3*p2.y+p3.y)*t3)
  };
}

function sampleMotionPath(scene, progress) {
  const points = effectiveMotionPath(scene);
  if ((scene.pathType || 'straight') !== 'curve' || points.length < 3) return samplePolyline(points, progress);
  const segments = points.length - 1;
  const scaled = clamp(progress,0,1) * segments;
  const index = Math.min(segments - 1, Math.floor(scaled));
  const local = scaled - index;
  const p0 = points[Math.max(0,index-1)], p1 = points[index], p2 = points[index+1], p3 = points[Math.min(points.length-1,index+2)];
  return catmullPoint(p0,p1,p2,p3,local);
}

function keyframeEase(value, mode = 'cinematic') {
  const t = clamp(value, 0, 1);
  if (mode === 'linear') return t;
  if (mode === 'out') return easeOutCubic(t);
  if (mode === 'inout') return easeInOut(t);
  if (mode === 'snap') return 1 - Math.pow(1 - t, 4);
  return smoothStep(t);
}

function sampleCameraKeyframes(scene, progress) {
  const frames = Array.isArray(scene.cameraKeyframes) ? scene.cameraKeyframes
    .filter((frame) => Number.isFinite(Number(frame?.t)))
    .map((frame) => ({ ...frame, t: clamp(Number(frame.t), 0, 1) }))
    .sort((a,b)=>a.t-b.t) : [];
  if (frames.length < 2) return null;
  const p = clamp(progress,0,1);
  if (p <= frames[0].t) return { ...frames[0] };
  if (p >= frames.at(-1).t) return { ...frames.at(-1) };
  let i=0;
  while (i < frames.length - 2 && p > frames[i+1].t) i += 1;
  const a=frames[i], b=frames[i+1];
  const local=(p-a.t)/Math.max(.0001,b.t-a.t);
  const t=keyframeEase(local,b.ease || 'cinematic');
  return {
    x:lerp(Number(a.x ?? scene.startX ?? 50),Number(b.x ?? a.x ?? scene.endX ?? 50),t),
    y:lerp(Number(a.y ?? scene.startY ?? 50),Number(b.y ?? a.y ?? scene.endY ?? 50),t),
    zoom:lerp(Number(a.zoom ?? scene.startZoom ?? 100),Number(b.zoom ?? a.zoom ?? scene.endZoom ?? 100),t),
    anchorX:lerp(Number(a.anchorX ?? scene.startAnchorX ?? .5),Number(b.anchorX ?? a.anchorX ?? scene.focusAnchorX ?? .5),t),
    anchorY:lerp(Number(a.anchorY ?? scene.startAnchorY ?? .5),Number(b.anchorY ?? a.anchorY ?? scene.focusAnchorY ?? .5),t)
  };
}

async function drawScene(scene, progress, opacity = 1, transform = {}) {
  let img;
  if (scene.sourceType === 'video') {
    img = await videoForScene(scene).catch(() => null);
    if (!img) return;
    const mediaDuration = Number(scene.mediaDuration || img.duration || scene.duration || 1);
    await syncVideoFrame(img, clamp(progress,0,1) * mediaDuration, Number(scene.duration || mediaDuration));
  } else {
    img = await imageForScene(scene).catch(() => null);
    if (!img) return;
  }

  const w = canvas.width, h = canvas.height;
  const moveStart = Number.isFinite(Number(scene.cameraMoveStart)) ? Number(scene.cameraMoveStart) : .08;
  const moveEnd = Number.isFinite(Number(scene.cameraMoveEnd)) ? Number(scene.cameraMoveEnd) : .68;
  const cameraP = windowProgress(progress, moveStart, moveEnd, scene.shotIntent === 'establish' ? 'cinematic' : 'settle');
  const keyedCamera = sampleCameraKeyframes(scene, progress);
  const zoom = keyedCamera?.zoom ?? lerp(Number(scene.startZoom), Number(scene.endZoom), cameraP);
  const focusPoint = keyedCamera ? { x:keyedCamera.x, y:keyedCamera.y } : sampleMotionPath(scene, cameraP);
  const startAnchorX = Number(scene.startAnchorX ?? scene.focusAnchorX ?? .5);
  const startAnchorY = Number(scene.startAnchorY ?? scene.focusAnchorY ?? .5);
  const endAnchorX = Number(scene.focusAnchorX ?? .5);
  const endAnchorY = Number(scene.focusAnchorY ?? .5);
  const anchorX = keyedCamera?.anchorX ?? lerp(startAnchorX, endAnchorX, cameraP);
  const anchorY = keyedCamera?.anchorY ?? lerp(startAnchorY, endAnchorY, cameraP);

  const geom = frameGeometry(w,h);
  const contentY = geom.y + geom.chrome;
  const contentH = geom.h - geom.chrome;
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.filter = transform.filter || 'none';
  const impactOuterScale = scene.directorImpact && !['reveal','resolve'].includes(scene.directorImpact)
    ? 1 + clamp((zoom - 100) / 60, 0, 1) * .035
    : 1;
  const scale = (transform.scale ?? 1) * impactOuterScale;
  const tx = transform.x ?? 0;
  const ty = transform.y ?? 0;
  ctx.translate(w/2 + tx, h/2 + ty); ctx.scale(scale, scale); ctx.translate(-w/2, -h/2);

  if (state.frameStyle !== 'none') {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.38)'; ctx.shadowBlur = Math.max(18, w*.024); ctx.shadowOffsetY = Math.max(8,h*.012);
    roundedRect(ctx, geom.x, geom.y, geom.w, geom.h, geom.radius); ctx.fillStyle = '#0d131e'; ctx.fill();
    ctx.restore();
  }
  if (state.frameStyle === 'browser') {
    roundedRect(ctx, geom.x, geom.y, geom.w, geom.h, geom.radius); ctx.clip();
    ctx.fillStyle = '#171f2d'; ctx.fillRect(geom.x, geom.y, geom.w, geom.chrome);
    const dot = geom.chrome * .13; const cy = geom.y + geom.chrome / 2;
    ['#647087','#647087','#647087'].forEach((color,i) => { ctx.beginPath(); ctx.arc(geom.x + geom.chrome*.36 + i*dot*2.2, cy, dot, 0, Math.PI*2); ctx.fillStyle=color; ctx.fill(); });
    const host = (() => { try { return scene.sourceUrl ? new URL(scene.sourceUrl).hostname : 'product.local'; } catch { return 'product.local'; }})();
    ctx.fillStyle = '#273144'; roundedRect(ctx, geom.x + geom.w*.28, geom.y + geom.chrome*.24, geom.w*.44, geom.chrome*.52, geom.chrome*.18); ctx.fill();
    ctx.fillStyle = '#8e9aaf'; ctx.font = `${Math.max(9,geom.chrome*.24)}px system-ui`; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(host, geom.x + geom.w*.5, cy);
  } else if (state.frameStyle === 'floating') {
    roundedRect(ctx, geom.x, geom.y, geom.w, geom.h, geom.radius); ctx.clip();
  }

  const crop = drawFocusedMedia(ctx, img, geom.x, contentY, geom.w, contentH, zoom, focusPoint.x, focusPoint.y, anchorX, anchorY);
  if (scene.id === selectedSceneId && opacity > .9 && Math.abs((transform.scale ?? 1) - 1) < .001 && Math.abs(transform.x ?? 0) < .001 && Math.abs(transform.y ?? 0) < .001) {
    lastFrameProjection = { sceneId:scene.id, crop, frame:{ x:geom.x, y:contentY, w:geom.w, h:contentH }, canvasW:w, canvasH:h };
  }
  ctx.restore();

  if (scene.cursorEnabled) {
    const cursorStart = Number.isFinite(Number(scene.cursorMoveStart)) ? Number(scene.cursorMoveStart) : .18;
    const cursorEnd = Number.isFinite(Number(scene.cursorMoveEnd)) ? Number(scene.cursorMoveEnd) : .66;
    const cursorP = windowProgress(progress, cursorStart, cursorEnd, 'settle');
    const cursorPoint = scene.cursorFollowPath && effectiveMotionPath(scene).length >= 2
      ? sampleMotionPath(scene, cursorP)
      : {
          x: lerp(Number(scene.cursorStartX ?? scene.startX ?? 50), Number(scene.cursorX), cursorP),
          y: lerp(Number(scene.cursorStartY ?? scene.startY ?? 50), Number(scene.cursorY), cursorP)
        };
    const projected = projectSourcePointToFrame(cursorPoint, crop, geom.x, contentY, geom.w, contentH);
    const transformed = {
      x: w/2 + tx + (projected.x - w/2) * scale,
      y: h/2 + ty + (projected.y - h/2) * scale
    };
    const clickStart = Number.isFinite(Number(scene.clickStart)) ? Number(scene.clickStart) : .72;
    const clickEnd = Number.isFinite(Number(scene.clickEnd)) ? Number(scene.clickEnd) : .86;
    const click = progress >= clickStart && progress <= clickEnd ? smoothStep((progress - clickStart) / Math.max(.001, clickEnd - clickStart)) : 0;
    ctx.save();
    ctx.globalAlpha = opacity;
    drawCursor(ctx, transformed.x, transformed.y, Math.max(26,w*.025), click);
    ctx.restore();
  }
}

function locateTime(time) {
  let acc = 0;
  for (let i=0;i<state.scenes.length;i+=1) {
    const d = Number(state.scenes[i].duration || 0);
    if (time <= acc + d || i === state.scenes.length - 1) return { index:i, local: clamp(time-acc,0,d), duration:d, start:acc };
    acc += d;
  }
  return { index:0, local:0, duration:1, start:0 };
}

function sceneMediaIdentity(scene) {
  return scene?.assetKey || scene?.imageUrl || scene?.sourceUrl || scene?.id || '';
}

async function renderAt(time) {
  syncCanvasSize();
  const w = canvas.width, h = canvas.height;
  const bg = ctx.createLinearGradient(0,0,w,h); bg.addColorStop(0,'#0c111b'); bg.addColorStop(1,'#161f2e'); ctx.fillStyle = bg; ctx.fillRect(0,0,w,h);
  if (!state.scenes.length) { $('#canvasMessage').hidden = false; return; }
  $('#canvasMessage').hidden = true;
  const loc = locateTime(clamp(time,0,totalDuration()));
  const scene = state.scenes[loc.index];
  if (state.frameStyle !== 'none' && scene?.directorRole) {
    const hue = 214 + ((Number(scene.sourcePageIndex || 0) * 47) % 92);
    const glow = ctx.createRadialGradient(w*.18,h*.08,0,w*.18,h*.08,Math.max(w,h)*.78);
    glow.addColorStop(0,`hsla(${hue},78%,58%,.18)`); glow.addColorStop(.55,`hsla(${hue+54},72%,52%,.07)`); glow.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=glow;ctx.fillRect(0,0,w,h);
  }
  const p = loc.duration ? loc.local / loc.duration : 0;
  const next = state.scenes[loc.index+1];
  const sameMedia = next && sceneMediaIdentity(scene) === sceneMediaIdentity(next);
  const baseTransitionLength = scene.transition === 'page-flow' ? .62 : .38;
  const transitionLength = Math.min(baseTransitionLength, loc.duration * .22);
  const transitionStart = 1 - transitionLength / Math.max(.001, loc.duration);
  const transP = !sameMedia && p > transitionStart && loc.index < state.scenes.length-1
    ? clamp((p-transitionStart)/(1-transitionStart),0,1)
    : 0;

  if (!transP || scene.transition === 'cut' || !next) {
    await drawScene(scene,p,1);
  } else if (scene.transition === 'crossfade') {
    await drawScene(scene,p,1-transP);
    await drawScene(next,0,transP);
  } else if (scene.transition === 'zoom-out') {
    const eased = easeOutCubic(transP);
    await drawScene(scene,p,1-transP*.42,{ scale:1-eased*.055 });
    await drawScene(next,0,transP,{ scale:.965+eased*.035 });
  } else if (scene.transition === 'page-flow') {
    const eased = easeInOut(transP);
    const outgoingOpacity = 1 - transP * .94;
    await drawScene(scene,p,outgoingOpacity,{ scale:1-eased*.16, x:-w*.065*eased, y:h*.018*eased, filter:`blur(${(eased*2.4).toFixed(2)}px)` });
    ctx.save(); ctx.globalAlpha=Math.sin(Math.PI*transP)*.11; ctx.fillStyle='#b8c9ff'; ctx.fillRect(0,0,w,h); ctx.restore();
    await drawScene(next,0,Math.min(1,transP*1.25),{ scale:1.22-eased*.22, x:w*.09*(1-eased), y:-h*.035*(1-eased), filter:`blur(${((1-eased)*3.0).toFixed(2)}px)` });
  } else if (scene.transition === 'slide') {
    await drawScene(scene,p,1,{ x:-w*transP });
    await drawScene(next,0,1,{ x:w*(1-transP) });
  }
}

async function updatePreview() { await renderAt(currentTime); }

function selectScene(id) {
  selectedSceneId = id;
  const index = state.scenes.findIndex(s => s.id === id);
  if (index >= 0) {
    currentTime = state.scenes.slice(0,index).reduce((sum,s)=>sum+Number(s.duration),0) + .001;
  }
  renderAll();
}

function selectedScene() { return state.scenes.find(s => s.id === selectedSceneId) || null; }

async function renderSceneCards() {
  const list = $('#sceneList'); const timeline = $('#timeline');
  list.innerHTML = ''; timeline.innerHTML = '';
  $('#sceneCountBadge').textContent = state.scenes.length;
  $('#sceneEmpty').hidden = state.scenes.length > 0;
  for (let i=0;i<state.scenes.length;i+=1) {
    const scene = state.scenes[i];
    const card = document.createElement('button');
    card.type='button'; card.className=`scene-card ${scene.id===selectedSceneId?'active':''}`; card.draggable=true; card.dataset.id=scene.id;
    card.innerHTML=`<span class="scene-thumb"></span><span class="scene-copy"><strong>${escapeHtml(scene.name)}</strong><span>${Number(scene.duration).toFixed(1)}s · ${escapeHtml(motionPresets[scene.motionPreset]?.label || '직접 설정')}</span></span>`;
    card.addEventListener('click',()=>selectScene(scene.id));
    card.addEventListener('dragstart',(e)=>e.dataTransfer.setData('text/plain',scene.id));
    card.addEventListener('dragover',(e)=>e.preventDefault());
    card.addEventListener('drop',(e)=>{e.preventDefault(); reorderScene(e.dataTransfer.getData('text/plain'),scene.id);});
    list.append(card);

    const item=document.createElement('button'); item.type='button'; item.className=`timeline-item ${scene.id===selectedSceneId?'active':''}`; item.dataset.id=scene.id; item.style.flexBasis=`${clamp(Number(scene.duration)*52,82,190)}px`;
    item.innerHTML=`<span class="timeline-image"></span><span>${Number(scene.duration).toFixed(1)}s</span><strong>${escapeHtml(scene.name)}</strong>`;
    item.addEventListener('click',()=>selectScene(scene.id)); timeline.append(item);
    sourceUrlForScene(scene).then(url=>{ if(!url)return; card.querySelector('.scene-thumb').style.backgroundImage=`url("${url.replaceAll('"','%22')}")`; item.querySelector('.timeline-image').style.backgroundImage=`url("${url.replaceAll('"','%22')}")`; });
  }
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
}

function reorderScene(fromId,toId) {
  if (!fromId || fromId===toId) return;
  const from=state.scenes.findIndex(s=>s.id===fromId), to=state.scenes.findIndex(s=>s.id===toId);
  if (from<0||to<0)return;
  const [moved]=state.scenes.splice(from,1); state.scenes.splice(to,0,moved); saveState(); renderAll(); toast('장면 순서를 변경했습니다.');
}

function renderInspector() {
  const scene = selectedScene(); const has=Boolean(scene);
  $('#inspectorContent').hidden=!has; $('#inspectorEmpty').hidden=has;
  if (!scene) return;
  $('#sceneNameInput').value=scene.name; $('#durationInput').value=scene.duration; $('#transitionSelect').value=scene.transition;
  $('#motionPresetSelect').value=scene.motionPreset || 'custom';
  const pairs=[['startZoom',scene.startZoom,'%'],['endZoom',scene.endZoom,'%'],['startX',scene.startX,'%'],['startY',scene.startY,'%'],['endX',scene.endX,'%'],['endY',scene.endY,'%'],['cursorX',scene.cursorX,'%'],['cursorY',scene.cursorY,'%']];
  pairs.forEach(([key,val,suffix])=>{ const input=$(`#${key}Input`), output=$(`#${key}Output`); if(input)input.value=val; if(output)output.textContent=`${val}${suffix}`; });
  $('#cursorEnabledInput').checked=Boolean(scene.cursorEnabled); $('#cursorControls').style.opacity=scene.cursorEnabled?'1':'.45';
  const path = effectiveMotionPath(scene); const summary = $('#pathSummary');
  if (summary) { summary.querySelector('strong').textContent = Array.isArray(scene.motionPath) && scene.motionPath.length >= 2 ? `${scene.pathType === 'free' ? '자유선' : scene.pathType === 'curve' ? '곡선' : '직선'} · ${scene.motionPath.length}점` : '기본 시작 → 끝'; }
  renderMotionPathOverlay();
}

function renderSound() {
  state.audio.preset=normalizeAudioPreset(state.audio.preset); $('#soundPresetSelect').value=state.audio.preset;
  $('#volumeInput').value=state.audio.volume; $('#volumeOutput').textContent=`${state.audio.volume}%`; $('#fadeAudioInput').checked=state.audio.fade;
  const preset=soundPresets.find(s=>s.id===state.audio.preset);
  $('#audioHelper').textContent=state.audio.preset==='custom' ? (state.audio.name ? `사용 중: ${state.audio.name} · WebM 내보내기에 실제 오디오 트랙으로 포함됩니다.` : '오디오 파일을 업로드해 주세요.') : `${preset?.description || ''}${state.audio.preset !== 'none' ? ' · WebM에 실제 오디오 트랙으로 포함됩니다.' : ''}`;
  const grid = $('#soundPresetGrid');
  if (grid) {
    grid.innerHTML = '';
    soundPresets.filter((item) => !['custom'].includes(item.id)).forEach((item) => {
      const button = document.createElement('button'); button.type='button'; button.className=`sound-chip ${state.audio.preset===item.id?'active':''}`;
      button.innerHTML=`<span class="sound-play">${item.id==='none'?'×':'▶'}</span><span><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(item.short || item.description)}</small></span>`;
      button.addEventListener('click', async () => { stopPreviewAudio(); clearTimeout(soundPreviewTimer); state.audio.preset=item.id; saveState(); renderSound(); if(item.id!=='none') await previewSoundOnly(); });
      grid.append(button);
    });
  }
}

function renderMeta() {
  const duration=totalDuration(); $('#sceneSummary').textContent=`${state.scenes.length} scenes`; $('#durationSummary').textContent=`${duration.toFixed(1)} sec`; $('#sceneCountBadge').textContent=state.scenes.length;
  $('#timeTotal').textContent=formatTime(duration); $('#timeCurrent').textContent=formatTime(currentTime);
  $('#seekInput').max=Math.max(duration,.001); $('#seekInput').value=clamp(currentTime,0,duration);
  $('#aspectSelect').value=state.aspect; $('#frameStyleSelect').value=state.frameStyle; $('#resolutionSelect').value=state.resolution;
}

async function renderAll() {
  if (state.scenes.length && !state.scenes.some(s=>s.id===selectedSceneId)) selectedSceneId=state.scenes[0].id;
  renderMeta(); renderInspector(); renderSound(); await renderSceneCards(); await updatePreview(); renderMotionPathOverlay();
}


function pathPointFromEvent(event) {
  const overlay = $('#motionPathOverlay');
  const rect = overlay.getBoundingClientRect();
  const screenX = clamp((event.clientX - rect.left) / Math.max(1, rect.width), 0, 1);
  const screenY = clamp((event.clientY - rect.top) / Math.max(1, rect.height), 0, 1);
  const scene = selectedScene();
  const projection = lastFrameProjection?.sceneId === scene?.id ? lastFrameProjection : null;
  if (!projection) return { x:screenX * 100, y:screenY * 100 };
  const canvasX = screenX * projection.canvasW;
  const canvasY = screenY * projection.canvasH;
  const localX = clamp((canvasX - projection.frame.x) / Math.max(1, projection.frame.w), 0, 1);
  const localY = clamp((canvasY - projection.frame.y) / Math.max(1, projection.frame.h), 0, 1);
  return {
    x: clamp(((projection.crop.sx + projection.crop.sw * localX) / projection.crop.sourceWidth) * 100, 0, 100),
    y: clamp(((projection.crop.sy + projection.crop.sh * localY) / projection.crop.sourceHeight) * 100, 0, 100)
  };
}

function pathPointToOverlay(point, scene) {
  const projection = lastFrameProjection?.sceneId === scene?.id ? lastFrameProjection : null;
  if (!projection) return { x:clamp(Number(point.x),0,100), y:clamp(Number(point.y),0,100) };
  const sourceX = projection.crop.sourceWidth * clamp(Number(point.x) / 100, 0, 1);
  const sourceY = projection.crop.sourceHeight * clamp(Number(point.y) / 100, 0, 1);
  const localX = (sourceX - projection.crop.sx) / Math.max(1, projection.crop.sw);
  const localY = (sourceY - projection.crop.sy) / Math.max(1, projection.crop.sh);
  const canvasX = projection.frame.x + localX * projection.frame.w;
  const canvasY = projection.frame.y + localY * projection.frame.h;
  return {
    x: (canvasX / projection.canvasW) * 100,
    y: (canvasY / projection.canvasH) * 100
  };
}

function svgPathFor(points, type) {
  if (!points.length) return '';
  if (type !== 'curve' || points.length < 3) return `M ${points.map((point) => `${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' L ')}`;
  let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[Math.max(0,i-1)], p1=points[i], p2=points[i+1], p3=points[Math.min(points.length-1,i+2)];
    const c1={x:p1.x+(p2.x-p0.x)/6,y:p1.y+(p2.y-p0.y)/6}; const c2={x:p2.x-(p3.x-p1.x)/6,y:p2.y-(p3.y-p1.y)/6};
    d += ` C ${c1.x.toFixed(2)} ${c1.y.toFixed(2)} ${c2.x.toFixed(2)} ${c2.y.toFixed(2)} ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return d;
}

function renderMotionPathOverlay() {
  const overlay = $('#motionPathOverlay'); if (!overlay) return;
  const scene = selectedScene(); const sourcePoints = pathEditing ? pathDraft : (scene?.motionPath || []);
  overlay.classList.toggle('editing', pathEditing);
  overlay.innerHTML='';
  if (!scene || !Array.isArray(sourcePoints) || sourcePoints.length < 1) return;
  const points = sourcePoints.map((point) => pathPointToOverlay(point, scene));
  const ns='http://www.w3.org/2000/svg';
  if (points.length >= 2) { const path=document.createElementNS(ns,'path'); path.setAttribute('class','path-line'); path.setAttribute('d',svgPathFor(points,pathEditing?pathEditMode:(scene.pathType||'straight'))); overlay.append(path); }
  points.forEach((point,index)=>{ const circle=document.createElementNS(ns,'circle'); circle.setAttribute('cx',point.x); circle.setAttribute('cy',point.y); circle.setAttribute('r','1.25'); circle.setAttribute('class',`path-node ${index===0?'start':index===points.length-1?'end':''}`); overlay.append(circle); if(index===0||index===points.length-1){const text=document.createElementNS(ns,'text');text.setAttribute('x',point.x+1.8);text.setAttribute('y',point.y-1.8);text.setAttribute('class','path-label');text.textContent=index===0?'START':'END';overlay.append(text);} });
}

function commitPath(points = pathDraft, type = pathEditMode) {
  const scene = selectedScene(); if (!scene || !Array.isArray(points) || points.length < 2) return;
  const cleaned = points.slice(0, 80).map((point)=>({x:Math.round(clamp(point.x,0,100)*10)/10,y:Math.round(clamp(point.y,0,100)*10)/10}));
  scene.motionPath=cleaned; scene.cameraKeyframes=[]; scene.pathType=type; scene.startX=cleaned[0].x; scene.startY=cleaned[0].y; scene.endX=cleaned[cleaned.length-1].x; scene.endY=cleaned[cleaned.length-1].y; scene.motionPreset='custom'; if(scene.cursorEnabled)scene.cursorFollowPath=true;
  saveState(); renderInspector(); updatePreview(); renderSceneCards();
}

function setPathEditing(next) {
  const scene=selectedScene(); if(!scene){toast('먼저 장면을 선택해 주세요.','error');return;}
  pathEditing=next; pathDrawing=false; pathDraft=next && Array.isArray(scene.motionPath) && scene.motionPath.length>=2 ? structuredClone(scene.motionPath) : [];
  $('#pathEditButton').textContent=next?'경로 완료':'경로 그리기'; $('#pathHint').textContent=next ? (pathEditMode==='free'?'미리보기 위를 누른 채 드래그하세요.':pathEditMode==='curve'?'원하는 지점을 차례로 클릭하세요. 완료 버튼으로 저장합니다.':'시작점과 끝점을 차례로 클릭하세요.') : '직선은 두 점, 곡선은 여러 점, 자유선은 드래그로 그립니다.';
  renderMotionPathOverlay();
}

function bindPathEditor() {
  $$('.path-mode').forEach((button)=>button.addEventListener('click',()=>{pathEditMode=button.dataset.pathMode;$$('.path-mode').forEach((item)=>item.classList.toggle('active',item===button));if(pathEditing){pathDraft=[];renderMotionPathOverlay();setPathEditing(true);}}));
  $('#pathEditButton').addEventListener('click',()=>{if(pathEditing){if(pathDraft.length>=2)commitPath(pathDraft,pathEditMode);setPathEditing(false);}else setPathEditing(true);});
  $('#pathClearButton').addEventListener('click',()=>{const scene=selectedScene();if(!scene)return;scene.motionPath=[];scene.pathType='straight';scene.cursorFollowPath=false;pathDraft=[];saveState();renderInspector();updatePreview();renderSceneCards();toast('직접 그린 이동 경로를 초기화했습니다.');});
  const overlay=$('#motionPathOverlay');
  overlay.addEventListener('pointerdown',(event)=>{if(!pathEditing)return;event.preventDefault();const point=pathPointFromEvent(event);if(pathEditMode==='free'){pathDrawing=true;pathDraft=[point];overlay.setPointerCapture?.(event.pointerId);}else{if(pathEditMode==='straight'&&pathDraft.length>=2)pathDraft=[];pathDraft.push(point);renderMotionPathOverlay();if(pathEditMode==='straight'&&pathDraft.length===2){commitPath(pathDraft,'straight');setPathEditing(false);}}});
  overlay.addEventListener('pointermove',(event)=>{if(!pathEditing||pathEditMode!=='free'||!pathDrawing)return;const point=pathPointFromEvent(event);const last=pathDraft[pathDraft.length-1];if(!last||Math.hypot(point.x-last.x,point.y-last.y)>.9){pathDraft.push(point);renderMotionPathOverlay();}});
  const finishFree=(event)=>{if(!pathDrawing)return;pathDrawing=false;try{overlay.releasePointerCapture?.(event.pointerId);}catch{}if(pathDraft.length>=2){commitPath(pathDraft,'free');setPathEditing(false);}};
  overlay.addEventListener('pointerup',finishFree);overlay.addEventListener('pointercancel',finishFree);
}

function setupSelectOptions() {
  $('#motionPresetSelect').innerHTML=Object.entries(motionPresets).map(([id,p])=>`<option value="${id}">${escapeHtml(p.label)}</option>`).join('');
  $('#soundPresetSelect').innerHTML=soundPresets.map(p=>`<option value="${p.id}">${escapeHtml(p.label)}</option>`).join('');
  const templates=currentTemplates(); $('#captureTemplateSelect').innerHTML=templates.filter(t=>t.category!=='custom').map(t=>`<option value="${t.id}" ${t.id==='impact-flow'?'selected':''}>${escapeHtml(t.title)}</option>`).join('');
}

function renderTemplateFilters() {
  const root = $('#templateFilters');
  root.innerHTML = '';
  const all = currentTemplates();
  templateCategories.forEach(([id,label]) => {
    const count = id === 'all' ? all.length : all.filter((item) => item.category === id).length;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `template-filter ${templateFilter === id ? 'active' : ''}`;
    button.innerHTML = `<span>${escapeHtml(label)}</span><b>${count}</b>`;
    button.addEventListener('click', () => {
      templateFilter = id;
      renderTemplates();
      renderTemplateFilters();
    });
    root.append(button);
  });
}

function renderTemplates() {
  const grid = $('#templateGrid');
  grid.innerHTML = '';
  const query = templateSearchQuery.trim().toLowerCase();
  const templates = currentTemplates().filter((template) => {
    const categoryMatch = templateFilter === 'all' || template.category === templateFilter;
    const searchMatch = !query || `${template.title} ${template.description || ''} ${template.category}`.toLowerCase().includes(query);
    return categoryMatch && searchMatch;
  });
  const countEl = $('#templateResultCount');
  if (countEl) countEl.textContent = `${templates.length}개 연출`;
  if (!templates.length) {
    grid.innerHTML = '<div class="template-empty"><strong>조건에 맞는 템플릿이 없습니다.</strong><span>검색어 또는 분류를 바꿔 보세요.</span></div>';
    return;
  }
  templates.forEach((template, index) => {
    const card = document.createElement('article');
    card.className = 'template-card';
    card.dataset.motion = template.motion || 'zoom';
    const isCustom = String(template.id).startsWith('custom-');
    const steps = (template.sequence || []).slice(0, 5);
    const previewSteps = steps.map((step, stepIndex) => `<i style="--step:${stepIndex};--zoom:${Number(step.endZoom || 120)}"></i>`).join('');
    card.innerHTML = `
      <div class="template-visual" aria-hidden="true"><div class="template-mini-browser"><span></span><b></b><em></em></div><div class="template-motion-path">${previewSteps}</div></div>
      <div class="template-meta"><span>${escapeHtml(template.badge || (isCustom ? 'Saved' : template.category))}</span><span>${escapeHtml(template.durationLabel || `${template.sequence?.reduce((a,item)=>a+Number(item.duration||0),0).toFixed(1)} sec`)}</span></div>
      <h3>${String(index + 1).padStart(2,'0')}. ${escapeHtml(template.title)}</h3>
      <p>${escapeHtml(template.description || '저장한 프로젝트 연출 설정입니다.')}</p>
      <div class="template-sequence" aria-label="연출 단계">${steps.map((step) => `<span>${escapeHtml(motionPresets[step.motion]?.label || step.motion)}</span>`).join('')}</div>
      <div class="template-actions"></div>`;
    const actions = card.querySelector('.template-actions');
    const apply = document.createElement('button');
    apply.type = 'button';
    apply.className = 'template-apply';
    apply.textContent = '이 연출 적용';
    apply.addEventListener('click', () => applyTemplate(template));
    actions.append(apply);
    if (isCustom) {
      const update=document.createElement('button'); update.type='button'; update.textContent='현재 설정으로 갱신'; update.addEventListener('click',()=>updateCustomTemplate(template.id)); actions.append(update);
      const download=document.createElement('button'); download.type='button'; download.textContent='JSON'; download.addEventListener('click',()=>downloadJson(template,`${safeFileName(template.title)}.motionframe-template.json`)); actions.append(download);
      const del=document.createElement('button'); del.type='button'; del.textContent='삭제'; del.addEventListener('click',()=>deleteCustomTemplate(template.id)); actions.append(del);
    } else {
      const clone=document.createElement('button'); clone.type='button'; clone.textContent='복제해서 수정'; clone.addEventListener('click',()=>cloneBuiltinTemplate(template)); actions.append(clone);
    }
    grid.append(card);
  });
}

function templateSequenceFromState() {
  return state.scenes.map(scene=>({ motion: scene.motionPreset || 'custom', duration:Number(scene.duration), transition:scene.transition, shotIntent:scene.shotIntent, cameraMoveStart:scene.cameraMoveStart,cameraMoveEnd:scene.cameraMoveEnd,startAnchorX:scene.startAnchorX,startAnchorY:scene.startAnchorY,focusAnchorX:scene.focusAnchorX,focusAnchorY:scene.focusAnchorY,startZoom:scene.startZoom,endZoom:scene.endZoom,startX:scene.startX,startY:scene.startY,endX:scene.endX,endY:scene.endY,cursorEnabled:scene.cursorEnabled,cursorStartX:scene.cursorStartX,cursorStartY:scene.cursorStartY,cursorX:scene.cursorX,cursorY:scene.cursorY,cursorMoveStart:scene.cursorMoveStart,cursorMoveEnd:scene.cursorMoveEnd,clickStart:scene.clickStart,clickEnd:scene.clickEnd,motionPath:scene.motionPath,pathType:scene.pathType,cursorFollowPath:scene.cursorFollowPath }));
}

function cloneBuiltinTemplate(template) {
  const customs=loadCustomTemplates(); customs.unshift({ ...structuredClone(template), id:createId('custom'), category:'custom', title:`${template.title} Copy`, description:'기본 템플릿을 복제해 수정할 수 있는 사용자 템플릿입니다.' }); storeCustomTemplates(customs); templateFilter='custom'; setupSelectOptions(); renderTemplateFilters(); renderTemplates(); toast('내 템플릿으로 복제했습니다.');
}

function updateCustomTemplate(id) {
  const customs=loadCustomTemplates(); const index=customs.findIndex(t=>t.id===id); if(index<0)return;
  customs[index]={ ...customs[index], sequence:templateSequenceFromState(), aspect:state.aspect, frameStyle:state.frameStyle, audioPreset:state.audio.preset, durationLabel:`${totalDuration().toFixed(1)} sec` };
  storeCustomTemplates(customs); renderTemplates(); toast('현재 편집 상태로 템플릿을 갱신했습니다.');
}

function deleteCustomTemplate(id) {
  const customs=loadCustomTemplates().filter(t=>t.id!==id); storeCustomTemplates(customs); setupSelectOptions(); renderTemplates(); toast('사용자 템플릿을 삭제했습니다.');
}

function applyTemplate(template) {
  if (directorPlan?.pages?.length && directorBases.length) {
    directorTemplateId = template.id;
    state.directorTemplateId = directorTemplateId;
    const replacement = buildDirectorScenes();
    const keep = state.scenes.filter((scene) => !scene.directorRole);
    state.scenes = [...keep, ...replacement];
    selectedSceneId = replacement[0]?.id || state.scenes[0]?.id || null;
    currentTime = keep.reduce((sum, scene) => sum + Number(scene.duration || 0), 0);
    state.aspect = template.aspect || state.aspect;
    state.frameStyle = template.frameStyle || state.frameStyle;
    if (template.audioPreset) state.audio.preset = normalizeAudioPreset(template.audioPreset);
    saveState();
    renderAll();
    toast(`“${template.title}” 모션 스타일을 현재 Auto Director 흐름에 적용했습니다.`);
    location.hash = 'studio';
    return;
  }
  if (!state.scenes.length) {
    state = demoProject();
    selectedSceneId = state.scenes[0]?.id || null;
    toast('샘플 장면을 불러와 템플릿을 적용합니다. URL 분석 후에는 콘텐츠 흐름을 유지한 채 모션 스타일만 바뀝니다.');
  }
  const sequence=template.sequence?.length?template.sequence:[{motion:'overview',duration:2.4,transition:'crossfade'}];
  const originals=[...state.scenes]; const targetCount=Math.max(originals.length,sequence.length); const next=[];
  for(let i=0;i<targetCount;i+=1){
    const source=structuredClone(originals[Math.min(i,originals.length-1)]); source.id=createId('scene');
    const spec=sequence[i%sequence.length];
    next.push(hydrateMotion(source,spec.motion || 'overview',{ ...spec, id:source.id, name: originals.length===1 ? `${originals[0].name} · ${i+1}` : source.name }));
  }
  state.scenes=next; state.aspect=template.aspect||state.aspect; state.frameStyle=template.frameStyle||state.frameStyle; if(template.audioPreset)state.audio.preset=normalizeAudioPreset(template.audioPreset);
  selectedSceneId=state.scenes[0]?.id||null; currentTime=0; saveState(); renderAll(); toast(`“${template.title}” 템플릿을 적용했습니다.`); location.hash='studio';
}


function saveCurrentTemplate(name,category='custom') {
  const customs=loadCustomTemplates();
  customs.unshift({ id:createId('custom'), title:name, category, motion:'zoom', description:'현재 프로젝트에서 저장한 사용자 연출 템플릿.', durationLabel:`${totalDuration().toFixed(1)} sec`, aspect:state.aspect, frameStyle:state.frameStyle, audioPreset:state.audio.preset, sequence:templateSequenceFromState() });
  storeCustomTemplates(customs); setupSelectOptions(); templateFilter='custom'; renderTemplateFilters(); renderTemplates(); toast('현재 연출을 내 템플릿으로 저장했습니다.');
}


function directorRoleLabel(value) {
  return { brand:'브랜드', hero:'H1 제목', media:'제품 화면', section:'섹션 제목', nav:'메뉴', cta:'CTA', link:'링크', control:'버튼', overview:'전체 화면', outro:'마무리' }[value] || value;
}

function flowActionLabel(value) {
  return { establish:'페이지 전체 공개', focus:'요소 집중', track:'확대 유지 · 따라가기', click:'커서 이동 · 클릭', anchor:'클릭 → 같은 페이지 이동', navigate:'클릭 → 다음 페이지', resolve:'마무리 줌아웃' }[value] || value;
}

function flowImpactLabel(value) {
  return { reveal:'Reveal', punch:'Punch Zoom', chapter:'Chapter Slam', spotlight:'Spotlight Push', sweep:'Sweep', orbit:'Arc Orbit', track:'Scroll Track', whip:'Whip Scroll', click:'Cursor Impact', navigate:'Page Impact', resolve:'Resolve' }[value] || value;
}

function currentAnalysisScope() {
  const roles = $$('[data-analysis-role]:checked').map((input) => input.dataset.analysisRole).filter(Boolean);
  return {
    pageLimit: Number($('#analysisPageLimitSelect')?.value || 5),
    elementLimit: Number($('#analysisElementLimitSelect')?.value || 6),
    grouping: $('#analysisBandSelect')?.value || 'screen',
    roles: roles.length ? roles : ['headings','media','navigation','actions']
  };
}

function positionPercentLabel(element) {
  return `${element.position || '위치'} · X ${Math.round(element.x || 0)}% · Y ${Math.round(element.y || 0)}%`;
}

function renderAnalysisBoard() {
  const root = $('#analysisPageList');
  if (!root) return;
  root.innerHTML = '';
  if (!directorPlan?.pages?.length) {
    root.innerHTML = `<div class="analysis-empty"><strong>URL을 분석하면 AI가 먼저 챕터별 핵심 요소를 2~4개로 압축합니다.</strong><span>원본 DOM 좌표는 고급 목록에 남기고, 기본 화면에는 실제 영상에 쓸 제목·제품 화면·버튼만 보여줍니다.</span></div>`;
    return;
  }
  directorPlan.pages.forEach((page, pageIndex) => {
    const card = document.createElement('article');
    card.className = 'analysis-page-card chapter-card';
    const selected = page.elements.filter((element) => element.selected);
    const markers = page.elements.map((element) => `<i class="analysis-map-dot role-${escapeHtml(element.role)} ${element.selected ? 'selected' : ''}" style="left:${clamp(element.x,3,97)}%;top:${clamp(element.y,2,98)}%" title="${escapeHtml(element.text)}"></i>`).join('');
    card.innerHTML = `
      <header class="analysis-page-head chapter-head">
        <div><span class="chapter-number">CHAPTER ${String(pageIndex + 1).padStart(2,'0')}</span><strong>${escapeHtml(page.chapterLabel || page.title)}</strong><span>${escapeHtml(page.url)}</span></div>
        <b>${selected.length} 핵심 비트</b>
      </header>
      <div class="chapter-summary">
        <div class="analysis-map chapter-map" aria-label="현재 캡처 뷰포인트의 요소 위치"><span>VIEW</span>${markers}<em>${escapeHtml(page.viewIntent || 'section')}</em></div>
        <div class="chapter-beats"></div>
      </div>
      <details class="raw-analysis"><summary>고급 · 분석 후보 ${page.elements.length}개 보기</summary><div class="analysis-element-list"></div></details>`;
    const beats = card.querySelector('.chapter-beats');
    selected.forEach((element, idx) => {
      const href = element.href ? (() => { try { const u = new URL(element.href); return `${u.pathname || '/'}${u.hash || ''}`; } catch { return element.href; } })() : '';
      const row=document.createElement('label');row.className=`chapter-beat role-${element.role}`;
      row.innerHTML=`<input type="checkbox" checked><span class="chapter-beat-index">${String(idx+1).padStart(2,'0')}</span><span class="analysis-role">${escapeHtml(directorRoleLabel(element.role))}</span><span class="analysis-copy"><strong>${escapeHtml(element.text)}</strong><small>${escapeHtml(positionPercentLabel(element))}${href?` · → ${escapeHtml(href)}`:''}</small></span>`;
      row.querySelector('input').addEventListener('change',(event)=>{toggleElementSelection(directorPlan,pageIndex,element.id,event.target.checked);state.directorPlan=directorPlan;saveState();renderDirectorPlan();});
      beats.append(row);
    });
    const list=card.querySelector('.analysis-element-list');
    page.elements.filter(element=>!element.selected).forEach((element)=>{
      const row=document.createElement('label');row.className=`analysis-element-row role-${element.role}`;
      row.innerHTML=`<input type="checkbox"><span class="analysis-role">${escapeHtml(directorRoleLabel(element.role))}</span><span class="analysis-copy"><strong>${escapeHtml(element.text)}</strong><small>${escapeHtml(positionPercentLabel(element))}</small></span>`;
      row.querySelector('input').addEventListener('change',(event)=>{toggleElementSelection(directorPlan,pageIndex,element.id,event.target.checked);state.directorPlan=directorPlan;saveState();renderDirectorPlan();});list.append(row);
    });
    root.append(card);
  });
}

function renderDirectorPlan() {
  const section = $('#director');
  const root = $('#directorFlow');
  if (!section || !root) return;
  section.hidden = false;
  renderAnalysisBoard();

  if (!directorPlan?.pages?.length) {
    $('#directorSummary').textContent = '분석 전 · 범위를 먼저 정하세요';
    root.innerHTML = `<div class="flow-placeholder">
      <div class="flow-step-row"><span class="flow-index">01</span><div><small>SCOPE</small><strong>페이지 수 · 요소 종류 · 개수 선택</strong></div><b>CHECK</b></div>
      <div class="flow-step-row"><span class="flow-index">02</span><div><small>ANALYZE</small><strong>실제 위치 순서로 요소 정리</strong></div><b>POSITION</b></div>
      <div class="flow-step-row"><span class="flow-index">03</span><div><small>FLOW</small><strong>Hero → 제품 → 버튼 → 목적지 연결</strong></div><b>DIRECT</b></div>
      <div class="flow-step-row"><span class="flow-index">04</span><div><small>MOTION</small><strong>먼 구간은 Whip, 가까운 구간은 Sweep</strong></div><b>MOTION</b></div>
    </div>`;
    return;
  }

  const summary = planSummary(directorPlan);
  $('#directorSummary').textContent = `${summary.pages} chapters · ${summary.selected} key targets · ${summary.beats} cinematic beats`;
  root.innerHTML = '';
  const flow = directorPlan.flow || [];
  flow.forEach((step, index) => {
    const page = directorPlan.pages[step.pageIndex];
    const element = step.elementId ? page?.elements?.find((item) => item.id === step.elementId) : null;
    const row = document.createElement('article');
    row.className = `flow-step-row action-${step.action} ${step.enabled === false ? 'disabled' : ''}`;
    const pageOptions = directorPlan.pages.map((target, targetIndex) => `<option value="${targetIndex}" ${Number(step.targetPageIndex)===targetIndex?'selected':''}>${targetIndex + 1}. ${escapeHtml(target.title)}</option>`).join('');
    const canNavigate = Boolean(element?.href) || ['nav','cta','link','control'].includes(element?.role);
    const canAnchor = Number.isFinite(Number(element?.targetY)) && Number(element?.targetY) > 0;
    row.innerHTML = `
      <span class="flow-index">${String(index + 1).padStart(2,'0')}</span>
      <div class="flow-subject">
        <small>${escapeHtml(page?.title || 'Page')} · ${escapeHtml(directorRoleLabel(step.role))}</small>
        <strong>${escapeHtml(step.label || element?.text || flowActionLabel(step.action))}</strong>
        <span>${element ? escapeHtml(positionPercentLabel(element)) : escapeHtml(flowActionLabel(step.action))}</span>
      </div>
      <label class="flow-control"><span>동작</span><select class="flow-action">
        ${step.elementId ? `<option value="focus" ${step.action==='focus'?'selected':''}>요소 집중</option><option value="track" ${step.action==='track'?'selected':''}>확대 유지 · 따라가기</option>${canNavigate?`<option value="click" ${step.action==='click'?'selected':''}>커서 이동 · 클릭</option>${canAnchor?`<option value="anchor" ${step.action==='anchor'?'selected':''}>클릭 → 같은 페이지 이동</option>`:''}<option value="navigate" ${step.action==='navigate'?'selected':''}>클릭 → 다음 페이지</option>`:''}` : `<option value="establish" ${step.action==='establish'?'selected':''}>페이지 전체 공개</option><option value="track" ${step.action==='track'?'selected':''}>목적지로 이동</option><option value="resolve" ${step.action==='resolve'?'selected':''}>마무리 줌아웃</option>`}
      </select></label>
      <label class="flow-control"><span>연출</span><select class="flow-impact">
        <option value="reveal" ${step.impact==='reveal'?'selected':''}>Reveal</option>
        <option value="punch" ${step.impact==='punch'?'selected':''}>Punch Zoom</option>
        <option value="chapter" ${step.impact==='chapter'?'selected':''}>Chapter Slam</option>
        <option value="spotlight" ${step.impact==='spotlight'?'selected':''}>Spotlight Push</option>
        <option value="sweep" ${step.impact==='sweep'?'selected':''}>Sweep</option>
        <option value="orbit" ${step.impact==='orbit'?'selected':''}>Arc Orbit</option>
        <option value="track" ${step.impact==='track'?'selected':''}>Scroll Track</option>
        <option value="whip" ${step.impact==='whip'?'selected':''}>Whip Scroll</option>
        <option value="click" ${step.impact==='click'?'selected':''}>Cursor Impact</option>
        <option value="navigate" ${step.impact==='navigate'?'selected':''}>Page Impact</option>
        <option value="resolve" ${step.impact==='resolve'?'selected':''}>Resolve</option>
      </select></label>
      <label class="flow-control flow-target" ${step.action==='navigate'?'':'hidden'}><span>이동</span><select>${pageOptions}</select></label>
      <div class="flow-row-actions"><button type="button" class="flow-up" title="위로">↑</button><button type="button" class="flow-down" title="아래로">↓</button><button type="button" class="flow-remove" title="플로우에서 제외">×</button></div>`;

    const action = row.querySelector('.flow-action');
    const impact = row.querySelector('.flow-impact');
    const target = row.querySelector('.flow-target select');
    action?.addEventListener('change', () => {
      const nextAction = action.value;
      let targetPageIndex = step.targetPageIndex;
      if (nextAction === 'navigate' && !Number.isInteger(Number(targetPageIndex))) targetPageIndex = Math.min(step.pageIndex + 1, directorPlan.pages.length - 1);
      const defaultImpact = nextAction === 'navigate' ? 'navigate' : (nextAction === 'click' || nextAction === 'anchor') ? 'click' : nextAction === 'track' ? 'track' : step.impact;
      updateFlowStep(directorPlan, step.id, { action: nextAction, targetPageIndex: nextAction === 'navigate' ? targetPageIndex : null, impact: defaultImpact });
      state.directorPlan = directorPlan; saveState(); renderDirectorPlan();
    });
    impact?.addEventListener('change', () => { updateFlowStep(directorPlan, step.id, { impact: impact.value }); state.directorPlan = directorPlan; saveState(); });
    target?.addEventListener('change', () => { updateFlowStep(directorPlan, step.id, { action:'navigate', targetPageIndex:Number(target.value), impact:'navigate' }); state.directorPlan = directorPlan; saveState(); renderDirectorPlan(); });
    row.querySelector('.flow-up')?.addEventListener('click', () => { moveFlowStep(directorPlan, step.id, -1); state.directorPlan=directorPlan; saveState(); renderDirectorPlan(); });
    row.querySelector('.flow-down')?.addEventListener('click', () => { moveFlowStep(directorPlan, step.id, 1); state.directorPlan=directorPlan; saveState(); renderDirectorPlan(); });
    row.querySelector('.flow-remove')?.addEventListener('click', () => { removeFlowStep(directorPlan, step.id); state.directorPlan=directorPlan; saveState(); renderDirectorPlan(); });
    root.append(row);
  });
}

function rebuildDirectorPlan() {
  if (!directorBases.length) {
    toast('먼저 URL을 분석해 주세요.', 'error');
    return;
  }
  directorTemplateId = $('#captureTemplateSelect').value || directorTemplateId;
  directorPlan = createDirectorPlan(directorBases, { scope: currentAnalysisScope() });
  state.directorPlan = directorPlan; state.directorTemplateId = directorTemplateId; saveState();
  renderDirectorPlan();
  $('#director').hidden = false;
  location.hash = 'director';
}

function rebuildDirectorFromSelection() {
  if (!directorPlan?.pages?.length) return rebuildDirectorPlan();
  rebuildFlowFromSelection(directorPlan);
  state.directorPlan = directorPlan;
  saveState();
  renderDirectorPlan();
  toast('체크한 요소의 실제 위치 순서로 Flow를 다시 만들었습니다.');
}

function shotTiming(intent, impact = '') {
  const key = impact || intent;
  if (intent === 'establish') return { duration:1.55, moveStart:.02, moveEnd:.72, cursorStart:.18, cursorEnd:.58, clickStart:.72, clickEnd:.84 };
  if (key === 'chapter') return { duration:1.2, moveStart:.01, moveEnd:.50, cursorStart:.16, cursorEnd:.50, clickStart:.64, clickEnd:.78 };
  if (key === 'spotlight') return { duration:1.35, moveStart:.01, moveEnd:.56, cursorStart:.16, cursorEnd:.52, clickStart:.66, clickEnd:.80 };
  if (key === 'whip') return { duration:1.2, moveStart:.01, moveEnd:.48, cursorStart:.16, cursorEnd:.50, clickStart:.62, clickEnd:.76 };
  if (key === 'orbit') return { duration:1.9, moveStart:.02, moveEnd:.72, cursorStart:.18, cursorEnd:.62, clickStart:.72, clickEnd:.84 };
  if (intent === 'track' || key === 'track') return { duration:2.05, moveStart:.02, moveEnd:.76, cursorStart:.2, cursorEnd:.66, clickStart:.76, clickEnd:.86 };
  if (intent === 'navigate') return { duration:.95, moveStart:.01, moveEnd:.34, cursorStart:.12, cursorEnd:.48, clickStart:.54, clickEnd:.70 };
  if (intent === 'click') return { duration:1.0, moveStart:.01, moveEnd:.30, cursorStart:.10, cursorEnd:.46, clickStart:.52, clickEnd:.68 };
  if (intent === 'resolve') return { duration:1.45, moveStart:.04, moveEnd:.82, cursorStart:.2, cursorEnd:.62, clickStart:.72, clickEnd:.84 };
  return { duration:key === 'punch' ? 1.45 : 1.35, moveStart:.01, moveEnd:.54, cursorStart:.14, cursorEnd:.50, clickStart:.64, clickEnd:.78 };
}

function cameraFramesForImpact(impact, start, target) {
  const base = (p, extra={}) => ({ x:p.x, y:p.y, zoom:p.zoom, anchorX:p.anchorX, anchorY:p.anchorY, ...extra });
  if (impact === 'reveal') {
    return [base({ ...target, zoom:Math.max(110,start.zoom) },{t:0}), base({ ...target, zoom:103 },{t:.54,ease:'out'}), base(target,{t:.78,ease:'out'}), base(target,{t:1})];
  }
  if (impact === 'punch') {
    const overshoot={...target,zoom:Math.min(194,target.zoom+24)};
    return [base(start,{t:0}),base({x:lerp(start.x,target.x,.72),y:lerp(start.y,target.y,.72),zoom:overshoot.zoom,anchorX:target.anchorX,anchorY:target.anchorY},{t:.46,ease:'snap'}),base(target,{t:.66,ease:'out'}),base(target,{t:1})];
  }
  if (impact === 'chapter') {
    const slam={...target,zoom:Math.min(196,target.zoom+28)};
    const recoil={...target,zoom:Math.max(126,target.zoom-8)};
    return [base({...start,zoom:Math.max(104,start.zoom)},{t:0}),base(slam,{t:.34,ease:'snap'}),base(recoil,{t:.52,ease:'out'}),base(target,{t:.68,ease:'snap'}),base(target,{t:1})];
  }
  if (impact === 'spotlight') {
    const side={x:clamp(lerp(start.x,target.x,.55)+(target.x>=start.x?5:-5),1,99),y:clamp(lerp(start.y,target.y,.48)-3,1,99),zoom:Math.min(196,target.zoom+22),anchorX:target.anchorX,anchorY:target.anchorY};
    return [base(start,{t:0}),base(side,{t:.38,ease:'snap'}),base({...target,zoom:Math.min(176,target.zoom+10)},{t:.56,ease:'out'}),base(target,{t:.72,ease:'out'}),base(target,{t:1})];
  }
  if (impact === 'sweep') {
    const dir=target.x>=start.x?1:-1;
    const mid={x:clamp(lerp(start.x,target.x,.58)+dir*3.5,1,99),y:clamp(lerp(start.y,target.y,.58)-2,1,99),zoom:Math.min(155,Math.max(start.zoom,target.zoom)+5),anchorX:lerp(start.anchorX,target.anchorX,.7),anchorY:lerp(start.anchorY,target.anchorY,.7)};
    return [base(start,{t:0}),base(mid,{t:.52,ease:'inout'}),base(target,{t:.82,ease:'out'}),base(target,{t:1})];
  }
  if (impact === 'orbit') {
    const dir=target.x>=start.x?1:-1;
    const mid1={x:clamp(lerp(start.x,target.x,.34)-dir*4.8,1,99),y:clamp(lerp(start.y,target.y,.30)-3.2,1,99),zoom:Math.min(158,Math.max(start.zoom,target.zoom)+8),anchorX:lerp(start.anchorX,target.anchorX,.35),anchorY:lerp(start.anchorY,target.anchorY,.35)};
    const mid2={x:clamp(lerp(start.x,target.x,.72)+dir*2.6,1,99),y:clamp(lerp(start.y,target.y,.74)+1.8,1,99),zoom:Math.min(156,target.zoom+5),anchorX:lerp(start.anchorX,target.anchorX,.78),anchorY:lerp(start.anchorY,target.anchorY,.78)};
    return [base(start,{t:0}),base(mid1,{t:.30,ease:'inout'}),base(mid2,{t:.58,ease:'inout'}),base(target,{t:.76,ease:'out'}),base(target,{t:1})];
  }
  if (impact === 'whip') {
    const bridge={x:lerp(start.x,target.x,.46),y:lerp(start.y,target.y,.46),zoom:Math.max(100,Math.min(start.zoom,target.zoom)-24),anchorX:.5,anchorY:.5};
    const punch={...target,zoom:Math.min(162,target.zoom+10)};
    return [base(start,{t:0}),base({...start,zoom:Math.max(104,start.zoom-18),anchorX:.5,anchorY:.5},{t:.18,ease:'out'}),base(bridge,{t:.38,ease:'linear'}),base(punch,{t:.58,ease:'snap'}),base(target,{t:.72,ease:'out'}),base(target,{t:1})];
  }
  if (impact === 'track') {
    const trackZoom=Math.min(154,Math.max(132,start.zoom,target.zoom));
    const mid={x:clamp(lerp(start.x,target.x,.46)+(target.x>=start.x?2.2:-2.2),1,99),y:lerp(start.y,target.y,.46),zoom:trackZoom,anchorX:lerp(start.anchorX,target.anchorX,.5),anchorY:lerp(start.anchorY,target.anchorY,.5)};
    return [base({...start,zoom:Math.max(start.zoom,trackZoom-4)},{t:0}),base(mid,{t:.46,ease:'inout'}),base({...target,zoom:trackZoom},{t:.82,ease:'inout'}),base({...target,zoom:Math.max(126,target.zoom)},{t:1,ease:'out'})];
  }
  if (impact === 'click' || impact === 'navigate') {
    const settle={...target,zoom:Math.min(176,target.zoom+12)};
    const pulse={...target,zoom:Math.min(182,target.zoom+20)};
    return [base(start,{t:0}),base(settle,{t:.34,ease:'snap'}),base(target,{t:.54,ease:'out'}),base(pulse,{t:.70,ease:'out'}),base(target,{t:.84,ease:'out'}),base(target,{t:1})];
  }
  if (impact === 'resolve') {
    return [base(start,{t:0}),base({...target,zoom:106},{t:.52,ease:'inout'}),base(target,{t:.84,ease:'out'}),base(target,{t:1})];
  }
  return [base(start,{t:0}),base(target,{t:.72,ease:'out'}),base(target,{t:1})];
}

function buildDirectorScenes() {
  if (!directorPlan?.pages?.length || !directorBases.length) return [];
  const template = currentTemplates().find((item) => item.id === directorTemplateId) || builtinTemplates[0];
  const beats = buildBeatSpecs(directorPlan);
  const scenes = [];
  const speed = template.category === 'fast' ? .78 : template.category === 'calm' ? 1.18 : 1;
  let previous = { pageIndex:-1, x:50, y:50, zoom:100, anchorX:.5, anchorY:.5 };

  beats.forEach((beat, index) => {
    const baseSceneSource = directorBases[beat.pageIndex];
    if (!baseSceneSource) return;
    const impact = beat.impact || ({ establish:'reveal', track:'track', navigate:'navigate', click:'click', resolve:'resolve' }[beat.intent] || (beat.role === 'media' ? 'sweep' : 'punch'));
    const timing = shotTiming(beat.intent || 'focus', impact);
    const samePage = previous.pageIndex === beat.pageIndex;
    const target = {
      x:clamp(Number(beat.x ?? 50),1,99), y:clamp(Number(beat.y ?? 50),1,99), zoom:clamp(Number(beat.zoom || 152),100,194),
      anchorX:clamp(Number(beat.anchorX ?? .5),.18,.82), anchorY:clamp(Number(beat.anchorY ?? .5),.16,.84)
    };
    let start = samePage
      ? { x:previous.x,y:previous.y,zoom:previous.zoom,anchorX:previous.anchorX,anchorY:previous.anchorY }
      : { x:target.x,y:target.y,zoom:beat.intent === 'establish' ? 112 : 106,anchorX:target.anchorX,anchorY:target.anchorY };

    if (beat.intent === 'establish') {
      start={...target,zoom:112,anchorX:.5,anchorY:.5}; target.zoom=100; target.anchorX=.5; target.anchorY=.5;
    }
    if (beat.intent === 'resolve') {
      start=samePage?start:{...target,zoom:118}; target.zoom=100;target.anchorX=.5;target.anchorY=.5;
    }

    const clickable = beat.behavior === 'click' || beat.behavior === 'navigate';
    const cursorStart={x:clamp(target.x+(target.x<50?14:-14),2,98),y:clamp(target.y+(target.y<55?8:-8),2,98)};
    const cameraKeyframes=cameraFramesForImpact(impact,start,target);
    const distance=Math.hypot(target.x-start.x,target.y-start.y);
    const motionPath=distance>10?[{x:start.x,y:start.y},{x:clamp(lerp(start.x,target.x,.5)+(index%2?2.5:-2.5),1,99),y:lerp(start.y,target.y,.5)},{x:target.x,y:target.y}]:[{x:start.x,y:start.y},{x:target.x,y:target.y}];
    const scene=structuredClone(baseSceneSource); scene.id=createId('scene');
    const requestedDuration=Number(beat.duration || 0);
    const duration=clamp((requestedDuration || timing.duration)*speed,1.05,3.5);
    const roleMotion=beat.intent==='establish'||beat.intent==='resolve'?'overview':clickable?'cursorChase':impact==='track'?'scrollDown':impact==='sweep'?'diagonal':'snapDetail';
    const label=beat.behavior==='navigate'?`클릭 · ${beat.label}`:beat.label;

    scenes.push(hydrateMotion(scene,roleMotion,{
      id:scene.id,name:label,duration,
      transition:beat.behavior==='navigate'?'page-flow':'cut',
      shotIntent:beat.intent||'focus',impactStyle:impact,cameraKeyframes,
      cameraMoveStart:timing.moveStart,cameraMoveEnd:timing.moveEnd,cursorMoveStart:timing.cursorStart,cursorMoveEnd:timing.cursorEnd,clickStart:timing.clickStart,clickEnd:timing.clickEnd,
      startX:start.x,startY:start.y,endX:target.x,endY:target.y,startZoom:start.zoom,endZoom:target.zoom,startAnchorX:start.anchorX,startAnchorY:start.anchorY,focusAnchorX:target.anchorX,focusAnchorY:target.anchorY,
      motionPath,pathType:motionPath.length>2?'curve':'straight',cursorEnabled:clickable,cursorFollowPath:false,cursorStartX:cursorStart.x,cursorStartY:cursorStart.y,cursorX:target.x,cursorY:target.y,
      directorRole:beat.role,directorBehavior:beat.behavior,directorIntent:beat.intent||'',directorImpact:impact,directorHref:beat.href||'',directorTargetPageIndex:beat.targetPageIndex??null,directorFlowStepId:beat.flowStepId||'',sourcePageIndex:beat.pageIndex
    }));
    previous={pageIndex:beat.pageIndex,x:target.x,y:target.y,zoom:target.zoom,anchorX:target.anchorX,anchorY:target.anchorY};
  });

  state.aspect=template.aspect||state.aspect;
  state.frameStyle=template.frameStyle||state.frameStyle;
  if(template.audioPreset)state.audio.preset=normalizeAudioPreset(template.audioPreset);
  return scenes.slice(0,20);
}

async function applyDirectorPlan() {
  const scenes = buildDirectorScenes();
  if (!scenes.length) {
    toast('적용할 자동 연출안이 없습니다.', 'error');
    return;
  }
  const keep = state.scenes.filter((scene) => scene.sourceType !== 'demo' && !scene.directorRole && !directorBases.some((base) => base.id === scene.id));
  state.scenes = [...keep, ...scenes];
  selectedSceneId = scenes[0]?.id || state.scenes[0]?.id || null;
  currentTime = keep.reduce((sum, scene) => sum + Number(scene.duration || 0), 0);
  saveState();
  await renderAll();
  const summary = planSummary(directorPlan);
  setCaptureStatus('Auto Director 적용 완료', `${summary.pages}개 챕터 · ${summary.beats}개 시네마틱 비트 · 연결 클릭 ${summary.navigations}개`, 'success');
  toast('페이지 구조와 링크 흐름을 편집기에 적용했습니다.');
  location.hash = 'studio';
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 30000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchMicrolinkCapture(url, mode, viewport) {
  const [width,height] = viewport.split('x').map(Number);
  const params = new URLSearchParams({
    url,
    screenshot: 'true',
    meta: 'true',
    prerender: 'true',
    'data.headings.selectorAll': 'h1,h2,h3',
    'data.headings.attr': 'text',
    'data.buttons.selectorAll': 'button,[role="button"],a.button,a.btn,a[class*="button"],a[class*="btn"],a.cta',
    'data.buttons.attr': 'text',
    'data.nav.selectorAll': 'nav a',
    'data.nav.attr': 'text',
    function: DOM_FUNCTION,
    'screenshot.type': 'png',
    'viewport.width': String(width),
    'viewport.height': String(height)
  });
  if (mode === 'full') params.set('screenshot.fullPage', 'true');
  if (width <= 430) {
    params.set('viewport.isMobile', 'true');
    params.set('viewport.hasTouch', 'true');
  }
  const response = await fetchWithTimeout(`${API_ENDPOINT}?${params.toString()}`, { mode: 'cors', cache: 'no-store' }, 35000);
  if (!response.ok) throw new Error(`Microlink 응답 ${response.status}`);
  const contentType = response.headers.get('content-type') || '';
  if (contentType.startsWith('image/')) {
    lastCaptureProvider = 'Microlink';
    return { blob: await response.blob(), analysis: null };
  }
  const payload = await response.json();
  if (payload.status === 'fail' || payload.status === 'error') throw new Error(payload.message || payload.data?.message || 'Microlink 캡처 실패');
  const screenshotUrl = payload.data?.screenshot?.url || payload.screenshot?.url || payload.data?.screenshot;
  if (!screenshotUrl || typeof screenshotUrl !== 'string') throw new Error('Microlink 응답에 screenshot URL이 없습니다.');
  const imageResponse = await fetchWithTimeout(screenshotUrl, { mode: 'cors', cache: 'no-store' }, 25000);
  if (!imageResponse.ok) throw new Error(`캡처 이미지 응답 ${imageResponse.status}`);
  const blob = await imageResponse.blob();
  if (!blob.type.startsWith('image/')) throw new Error('캡처 결과가 이미지가 아닙니다.');
  lastCaptureProvider = 'Microlink';
  return { blob, analysis: normalizePageAnalysis(payload, url, mode) };
}

async function fetchMshotsCapture(url, viewport) {
  const [width,height] = viewport.split('x').map(Number);
  const target = `https://s.wordpress.com/mshots/v1/${encodeURIComponent(url)}?w=${Math.min(width,1280)}&h=${Math.min(height,960)}`;
  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      if (attempt) await new Promise((resolve) => setTimeout(resolve, 2600));
      const response = await fetchWithTimeout(target, { mode: 'cors', cache: 'no-store' }, 22000);
      if (!response.ok) throw new Error(`mShots 응답 ${response.status}`);
      const blob = await response.blob();
      if (!blob.type.startsWith('image/')) throw new Error('mShots 결과가 이미지가 아닙니다.');
      lastCaptureProvider = 'WordPress mShots';
      return { blob, analysis: null };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error('mShots 캡처 실패');
}

async function fetchUrlCapture(url, mode, viewport) {
  const errors = [];
  try {
    return await fetchMicrolinkCapture(url, mode, viewport);
  } catch (error) {
    errors.push(`Microlink: ${error.message}`);
  }
  try {
    return await fetchMshotsCapture(url, viewport);
  } catch (error) {
    errors.push(`mShots: ${error.message}`);
  }
  throw new Error(`외부 캡처 서비스가 응답하지 않았습니다. ${errors.join(' / ')} 로그인 페이지는 ‘화면 녹화 클립’을 사용하세요.`);
}

async function makeImageSceneFromBlob(blob,{name='캡처 장면',sourceType='upload',sourceUrl='',analysis=null}={}) {
  const key=createId('asset'); await putAsset(key,blob);
  const scene=baseScene({ name, sourceType, sourceUrl, sourceAnalysis:analysis, assetKey:key, imageUrl:'', motionPreset:'overview' });
  await imageForScene(scene);
  return scene;
}

async function makeVideoSceneFromBlob(blob,{name='영상 클립'}={}) {
  const key=createId('asset'); await putAsset(key,blob);
  const scene=baseScene({ name, sourceType:'video', assetKey:key, imageUrl:'', sourceUrl:'', motionPreset:'calmFloat', duration:4 });
  const video=await videoForScene(scene);
  scene.mediaDuration = Number.isFinite(video.duration) ? video.duration : 4;
  scene.duration = clamp(scene.mediaDuration, .8, 30);
  video.currentTime = Math.min(.15, scene.mediaDuration || 0);
  await new Promise(resolve => { const done=()=>resolve(); video.addEventListener('seeked',done,{once:true}); setTimeout(done,180); });
  const poster=document.createElement('canvas'); const ratio=(video.videoWidth||16)/(video.videoHeight||9); poster.width=320; poster.height=Math.max(120,Math.round(320/ratio));
  poster.getContext('2d').drawImage(video,0,0,poster.width,poster.height); scene.posterUrl=poster.toDataURL('image/jpeg',.72);
  video.currentTime=0; return scene;
}

async function captureUrl(asStory) {
  let urls;
  try {
    urls = parseUrlList($('#urlInput').value);
  } catch (error) {
    toast(error.message, 'error');
    setCaptureStatus('URL을 확인해 주세요', error.message, 'error');
    $('#urlInput').focus();
    return;
  }
  const analysisScope = currentAnalysisScope();
  urls = asStory ? (urls.length > 1 ? urls.slice(0, 8) : urls.slice(0, analysisScope.pageLimit)) : urls.slice(0, 1);
  const requestedMode = $('#captureModeSelect').value;
  const mode = requestedMode === 'story' ? 'viewport' : requestedMode;
  const viewport = $('#viewportSelect').value;
  const autoFollow = asStory && urls.length === 1 && Boolean($('#autoFollowInput')?.checked) && analysisScope.pageLimit > 1;
  const storyButton = $('#urlStoryButton');
  const singleButton = $('#urlSingleButton');
  const originalStoryLabel = storyButton.textContent;
  storyButton.disabled = true;
  singleButton.disabled = true;
  storyButton.textContent = '분석 중…';
  setCaptureStatus('사이트 구조 분석 시작', `${urls.length}개 URL · DOM 좌표 + 링크 + ${mode === 'full' ? '전체 페이지 캡처' : '첫 화면 캡처'}`, 'loading');
  const bases = [];
  const failures = [];
  const queue = [...urls];
  const queued = new Set(queue);
  const originalOrigin = new URL(queue[0]).origin;
  try {
    for (let index = 0; index < queue.length; index += 1) {
      const url = queue[index];
      const host = new URL(url).hostname;
      setCaptureStatus(`페이지 분석 ${index + 1}/${queue.length}`, `${host} · 화면과 DOM 좌표를 함께 읽는 중`, 'loading');
      try {
        const result = await fetchUrlCapture(url, mode, viewport);
        const sceneName = result.analysis?.title || host;
        const scene = await makeImageSceneFromBlob(result.blob, { name: sceneName, sourceType: 'url', sourceUrl: url, analysis: result.analysis });
        bases.push(scene);
        if (autoFollow && result.analysis && queue.length < analysisScope.pageLimit) {
          const suggestion = suggestInternalLinks(result.analysis, 6)
            .filter((item) => {
              try { return new URL(item.href).origin === originalOrigin; } catch { return false; }
            })
            .find((item) => !queued.has(item.href));
          if (suggestion) {
            queue.push(suggestion.href);
            queued.add(suggestion.href);
            setCaptureStatus('다음 핵심 링크 발견', `${suggestion.text} → ${new URL(suggestion.href).pathname || '/'} 페이지를 이어서 분석합니다.`, 'loading');
          }
        }
        setCaptureStatus(`페이지 분석 완료 ${index + 1}/${queue.length}`, `${sceneName} · ${result.analysis?.elements?.length || 0}개 DOM 요소 · ${lastCaptureProvider}`, 'loading');
      } catch (error) {
        console.error(error);
        failures.push(`${host}: ${error.message}`);
      }
    }
    if (!bases.length) throw new Error(failures[0] || '캡처할 수 있는 URL이 없습니다.');
    const isDemo = state.scenes.length && state.scenes.every((scene) => scene.sourceType === 'demo');
    if (asStory) {
      directorBases = bases;
      directorTemplateId = $('#captureTemplateSelect').value || 'impact-flow';
      directorPlan = createDirectorPlan(bases, { scope: { ...analysisScope, pageLimit: Math.max(analysisScope.pageLimit, bases.length) } });
      state.directorPlan = directorPlan; state.directorTemplateId = directorTemplateId;
      renderDirectorPlan();
      const autoScenes = buildDirectorScenes();
      const old = isDemo ? [] : state.scenes.filter((scene) => !scene.directorRole);
      state.scenes = [...old, ...autoScenes];
      selectedSceneId = autoScenes[0]?.id || state.scenes[0]?.id || null;
      currentTime = old.reduce((sum, scene) => sum + Number(scene.duration || 0), 0);
      saveState();
      await renderAll();
      renderDomAnalysis(bases);
      const summary = planSummary(directorPlan);
      const geometryCount = bases.filter((scene) => scene.sourceAnalysis?.geometrySource === 'browser-dom').length;
      const note = failures.length ? ` · ${failures.length}개 실패` : '';
      setCaptureStatus('기본 연출안 생성 완료', `${summary.pages}개 챕터 · ${summary.beats} cinematic beats · DOM 좌표 ${geometryCount}/${bases.length} · 연결 클릭 ${summary.navigations}개${note}`, failures.length ? 'warning' : 'success');
      toast('AI가 URL 순서를 챕터로 압축했습니다. 핵심 장면과 연결 클릭만 확인하면 바로 렌더링할 수 있습니다.');
      location.hash = 'director';
    } else {
      if (isDemo) state.scenes = [];
      state.scenes.push(...bases);
      selectedSceneId = bases[0].id;
      currentTime = Math.max(0, totalDuration() - bases[0].duration);
      saveState();
      await renderAll();
      renderDomAnalysis(bases);
      setCaptureStatus('URL 캡처 완료', `${lastCaptureProvider}로 화면과 페이지 구조를 가져왔습니다.`, 'success');
      location.hash = 'studio';
    }
    if (failures.length) toast(`${bases.length}개 성공, ${failures.length}개 실패했습니다. 성공한 페이지로 계속 구성했습니다.`);
  } catch (error) {
    console.error(error);
    setCaptureStatus('URL 분석에 실패했습니다', error.message, 'error');
    toast(error.message, 'error');
  } finally {
    storyButton.disabled = false;
    singleButton.disabled = false;
    storyButton.textContent = originalStoryLabel;
  }
}


async function handleMediaFiles(files) {
  const list=[...files].filter(file=>file.type.startsWith('image/')||file.type.startsWith('video/'));
  if(!list.length){toast('지원하는 이미지 또는 영상 파일이 없습니다.','error');return;}
  const isDemo=state.scenes.length&&state.scenes.every(s=>s.sourceType==='demo'); if(isDemo)state.scenes=[];
  for(const file of list){
    let scene;
    if(file.type.startsWith('video/')) scene=await makeVideoSceneFromBlob(file,{name:file.name.replace(/\.[^.]+$/,'')});
    else scene=await makeImageSceneFromBlob(file,{name:file.name.replace(/\.[^.]+$/,''),sourceType:'upload'});
    state.scenes.push(scene); selectedSceneId=scene.id;
  }
  saveState(); await renderAll(); toast(`${list.length}개 미디어를 추가했습니다.`); location.hash='studio';
}


async function captureScreen() {
  if(!navigator.mediaDevices?.getDisplayMedia){toast('이 브라우저에서는 화면 캡처를 지원하지 않습니다.','error');return;}
  let stream;
  try{
    stream=await navigator.mediaDevices.getDisplayMedia({video:true,audio:false});
    const video=document.createElement('video'); video.srcObject=stream; video.muted=true; await video.play();
    await new Promise(resolve=>setTimeout(resolve,180));
    const shot=document.createElement('canvas'); shot.width=video.videoWidth; shot.height=video.videoHeight; shot.getContext('2d').drawImage(video,0,0);
    const blob=await new Promise(resolve=>shot.toBlob(resolve,'image/png',.94));
    const scene=await makeImageSceneFromBlob(blob,{name:`화면 캡처 ${new Date().toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})}`,sourceType:'capture'});
    if(state.scenes.length&&state.scenes.every(s=>s.sourceType==='demo'))state.scenes=[]; state.scenes.push(scene); selectedSceneId=scene.id; saveState(); await renderAll(); toast('현재 화면을 장면으로 추가했습니다.'); location.hash='studio';
  }catch(err){ if(err?.name!=='NotAllowedError')toast(`화면 캡처 실패: ${err.message}`,'error'); }
  finally{stream?.getTracks().forEach(t=>t.stop());}
}

async function recordScreenClip() {
  const button=$('#screenRecordButton');
  if(screenRecording){
    try{screenRecording.recorder.stop();}catch{} screenRecording.stream.getTracks().forEach(t=>t.stop()); return;
  }
  if(!navigator.mediaDevices?.getDisplayMedia||!window.MediaRecorder){toast('이 브라우저에서는 화면 녹화를 지원하지 않습니다.','error');return;}
  try{
    const stream=await navigator.mediaDevices.getDisplayMedia({video:{frameRate:30},audio:false});
    const mime=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'].find(t=>MediaRecorder.isTypeSupported(t))||'';
    const recorder=new MediaRecorder(stream,mime?{mimeType:mime,videoBitsPerSecond:5_000_000}:undefined); const chunks=[];
    recorder.ondataavailable=e=>{if(e.data?.size)chunks.push(e.data);};
    recorder.onstop=async()=>{
      clearTimeout(screenRecording?.timer); button.textContent='화면 녹화 클립'; button.disabled=false;
      const blob=new Blob(chunks,{type:mime||'video/webm'}); screenRecording=null;
      if(!blob.size){toast('녹화된 데이터가 없습니다.','error');return;}
      try{const scene=await makeVideoSceneFromBlob(blob,{name:`화면 녹화 ${new Date().toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})}`});if(state.scenes.length&&state.scenes.every(s=>s.sourceType==='demo'))state.scenes=[];state.scenes.push(scene);selectedSceneId=scene.id;saveState();await renderAll();toast('화면 녹화 클립을 장면으로 추가했습니다.');location.hash='studio';}catch(err){toast(`녹화 클립 처리 실패: ${err.message}`,'error');}
    };
    stream.getVideoTracks()[0]?.addEventListener('ended',()=>{if(recorder.state!=='inactive')recorder.stop();},{once:true});
    recorder.start(250); screenRecording={stream,recorder,timer:setTimeout(()=>{if(recorder.state!=='inactive'){recorder.stop();stream.getTracks().forEach(t=>t.stop());}},30000)}; button.textContent='녹화 종료'; toast('화면 녹화를 시작했습니다. 최대 30초 후 자동 종료됩니다.');
  }catch(err){if(err?.name!=='NotAllowedError')toast(`화면 녹화 실패: ${err.message}`,'error');screenRecording=null;button.textContent='화면 녹화 클립';}
}

function updateSelectedScene(patch, render=true) {
  const scene=selectedScene(); if(!scene)return; Object.assign(scene,patch); saveState(); if(render)renderAll();
}

function duplicateSelectedScene() {
  const scene=selectedScene(); if(!scene)return; const idx=state.scenes.findIndex(s=>s.id===scene.id); const copy={...structuredClone(scene),id:createId('scene'),name:`${scene.name} 복사`}; state.scenes.splice(idx+1,0,copy); selectedSceneId=copy.id; saveState(); renderAll(); toast('장면을 복제했습니다.');
}

async function deleteSelectedScene() {
  const scene=selectedScene(); if(!scene)return; const idx=state.scenes.findIndex(s=>s.id===scene.id); state.scenes.splice(idx,1);
  if(scene.assetKey && !state.scenes.some(s=>s.assetKey===scene.assetKey))await deleteAsset(scene.assetKey).catch(()=>{});
  selectedSceneId=state.scenes[Math.min(idx,state.scenes.length-1)]?.id||null; currentTime=clamp(currentTime,0,totalDuration()); saveState(); renderAll(); toast('장면을 삭제했습니다.');
}

async function audioBufferForContext(context) {
  const duration=Math.max(totalDuration(),1);
  if(state.audio.preset==='none')return null;
  if(state.audio.preset==='custom'){
    if(!state.audio.assetKey)return null;
    if(customAudioBufferCache)return customAudioBufferCache;
    const blob=await getAsset(state.audio.assetKey); if(!blob)return null;
    const arr=await blob.arrayBuffer(); customAudioBufferCache=await context.decodeAudioData(arr.slice(0)); return customAudioBufferCache;
  }
  return addSceneAccents(createProceduralBuffer(context,state.audio.preset,duration), state.scenes);
}

async function startPreviewAudio(offset=0, output=true) {
  stopPreviewAudio();
  if(state.audio.preset==='none')return null;
  const context=new (window.AudioContext||window.webkitAudioContext)(); await context.resume();
  const buffer=await audioBufferForContext(context); if(!buffer){context.close();return null;}
  const source=context.createBufferSource(); source.buffer=buffer; source.loop=state.audio.preset==='custom'&&buffer.duration<Math.max(totalDuration(),1);
  const gain=context.createGain(); applyFade(gain.gain,context,state.audio.volume/100,totalDuration(),state.audio.fade,offset); source.connect(gain); if(output)gain.connect(context.destination);
  source.start(0,offset % buffer.duration);
  previewAudio={context,source,gain}; return previewAudio;
}

function stopPreviewAudio(){ if(!previewAudio)return; try{previewAudio.source.stop();}catch{} try{previewAudio.context.close();}catch{} previewAudio=null; }

async function togglePlay() {
  if(!state.scenes.length)return;
  if(playing){ pausePlayback(); return; }
  if(currentTime>=totalDuration()-.02)currentTime=0;
  playing=true; playStartStamp=performance.now()-currentTime*1000; $('#playButton .icon-play').hidden=true; $('#playButton .icon-pause').hidden=false;
  try{await startPreviewAudio(currentTime,true);}catch(err){console.warn('audio preview',err);}
  playbackLoop();
}

function pausePlayback(){ playing=false; cancelAnimationFrame(renderRaf); stopPreviewAudio(); videoCache.forEach(async p=>{try{(await p).pause();}catch{}}); $('#playButton .icon-play').hidden=false; $('#playButton .icon-pause').hidden=true; renderMeta(); }

async function playbackLoop(){
  if(!playing)return; currentTime=(performance.now()-playStartStamp)/1000; const total=totalDuration(); if(currentTime>=total){currentTime=total; await renderAt(currentTime); renderMeta(); pausePlayback(); return;} await renderAt(currentTime); renderMeta(); renderRaf=requestAnimationFrame(playbackLoop);
}

async function previewSoundOnly(){
  clearTimeout(soundPreviewTimer); stopPreviewAudio(); if(state.audio.preset==='none'){toast('사운드 없음이 선택되어 있습니다.');return;}
  try{await startPreviewAudio(0,true); $('#soundPreviewButton').textContent='정지'; soundPreviewTimer=setTimeout(()=>{stopPreviewAudio();$('#soundPreviewButton').textContent='미리듣기';},Math.min(6000,totalDuration()*1000||6000));}catch(err){toast(`사운드 재생 실패: ${err.message}`,'error');}
}

async function handleAudioFile(file){
  if(!file||!file.type.startsWith('audio/')){toast('오디오 파일을 선택해 주세요.','error');return;}
  if(state.audio.assetKey)await deleteAsset(state.audio.assetKey).catch(()=>{});
  const key=createId('audio'); await putAsset(key,file); state.audio={...state.audio,preset:'custom',assetKey:key,name:file.name}; customAudioBufferCache=null; saveState(); renderSound(); toast('오디오 파일을 프로젝트에 연결했습니다.');
}

function supportedMimeType(){ return ['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'].find(type=>MediaRecorder.isTypeSupported(type))||''; }

async function prewarmExportMedia() {
  await Promise.all(state.scenes.map(async (scene) => {
    try {
      if (scene.sourceType === 'video') await videoForScene(scene);
      else await imageForScene(scene);
    } catch {}
  }));
}

async function exportWebM(){
  if(exportInProgress)return;
  if(!state.scenes.length){toast('내보낼 장면이 없습니다.','error');return;}
  if(!canvas.captureStream||!window.MediaRecorder){toast('이 브라우저는 WebM 렌더링을 지원하지 않습니다. Chrome/Edge 최신 버전을 권장합니다.','error');return;}
  exportInProgress=true; pausePlayback(); currentTime=0; syncCanvasSize(); $('#exportButton').disabled=true; $('#exportStatus').textContent='미디어 준비 중…'; $('#exportProgress').style.width='0%';
  let audioContext=null, audioSource=null;
  try{
    await prewarmExportMedia();
    const fps=30;
    const videoStream=canvas.captureStream(fps);
    const videoTrack=videoStream.getVideoTracks()[0];
    const tracks=[videoTrack];
    const total=totalDuration();
    if(state.audio.preset!=='none'){
      audioContext=new (window.AudioContext||window.webkitAudioContext)();
      await audioContext.resume();
      const buffer=await audioBufferForContext(audioContext);
      if(buffer){
        const dest=audioContext.createMediaStreamDestination();
        const gain=audioContext.createGain();
        applyFade(gain.gain,audioContext,state.audio.volume/100,total,state.audio.fade,0);
        audioSource=audioContext.createBufferSource();
        audioSource.buffer=buffer;
        audioSource.loop=state.audio.preset==='custom'&&buffer.duration<total;
        audioSource.connect(gain).connect(dest);
        tracks.push(...dest.stream.getAudioTracks());
      }
    }
    const stream=new MediaStream(tracks);
    const mimeType=supportedMimeType();
    const recorder=new MediaRecorder(stream,mimeType?{mimeType,videoBitsPerSecond:state.resolution==='1920x1080'?9_000_000:5_000_000}:undefined);
    const chunks=[];
    recorder.ondataavailable=e=>{if(e.data?.size)chunks.push(e.data);};
    const stopped=new Promise(resolve=>recorder.addEventListener('stop',resolve,{once:true}));
    recorder.start(250);
    audioSource?.start(0);

    const wallStart=performance.now();
    let frameIndex=0;
    while(true){
      const elapsed=Math.min((performance.now()-wallStart)/1000,total);
      currentTime=elapsed;
      await renderAt(elapsed);
      const percent=total?Math.min(100,Math.round(elapsed/total*100)):100;
      $('#exportProgress').style.width=`${percent}%`;
      $('#exportStatus').textContent=`렌더링 중 · ${percent}%`;
      if(elapsed>=total)break;
      frameIndex+=1;
      const targetWall=wallStart+frameIndex*(1000/fps);
      const wait=targetWall-performance.now();
      if(wait>1) await new Promise((resolve)=>setTimeout(resolve,wait));
      else if(wait<-1000/fps){
        frameIndex=Math.max(frameIndex,Math.floor((performance.now()-wallStart)/(1000/fps)));
      }
    }
    currentTime=total;
    await renderAt(total);
    await new Promise((resolve)=>setTimeout(resolve,90));
    try{audioSource?.stop();}catch{}
    recorder.stop();
    await stopped;
    stream.getTracks().forEach((track)=>track.stop());
    const blob=new Blob(chunks,{type:mimeType||'video/webm'});
    const link=document.createElement('a');
    const url=URL.createObjectURL(blob);
    link.href=url;
    link.download=`motionframe-${new Date().toISOString().slice(0,10)}.webm`;
    document.body.append(link); link.click(); link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),10000);
    $('#exportStatus').textContent=`완료 · ${(blob.size/1024/1024).toFixed(1)} MB`;
    $('#exportProgress').style.width='100%';
    toast('WebM 영상과 사운드 렌더링이 완료되었습니다.');
  }catch(err){
    console.error(err); $('#exportStatus').textContent='렌더링 실패'; toast(`내보내기 실패: ${err.message}`,'error');
  }
  finally{
    try{audioSource?.stop();}catch{}
    try{audioContext?.close();}catch{}
    exportInProgress=false; $('#exportButton').disabled=false; currentTime=0; renderAll();
  }
}

function safeFileName(name){return String(name||'motionframe').replace(/[^a-z0-9가-힣_-]+/gi,'-').replace(/^-+|-+$/g,'')||'motionframe';}
function downloadJson(data,name){const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);}
function blobToDataUrl(blob){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.readAsDataURL(blob);});}
function dataUrlToBlob(dataUrl){const [meta,data]=dataUrl.split(',');const type=(meta.match(/data:([^;]+)/)||[])[1]||'application/octet-stream';const binary=atob(data);const bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);return new Blob([bytes],{type});}

async function exportProject(){
  const keys=[...new Set([...state.scenes.map(s=>s.assetKey).filter(Boolean),state.audio.assetKey].filter(Boolean))]; const assets={};
  for(const key of keys){const blob=await getAsset(key);if(blob)assets[key]={type:blob.type,data:await blobToDataUrl(blob)};}
  downloadJson({kind:'motionframe-project',version:8,createdAt:new Date().toISOString(),project:state,assets,customTemplates:loadCustomTemplates()},`motionframe-project-${new Date().toISOString().slice(0,10)}.json`); toast('프로젝트 백업 파일을 만들었습니다.');
}

async function importProjectFile(file){
  try{const data=JSON.parse(await file.text());if(data.kind!=='motionframe-project'||!data.project)throw new Error('MotionFrame 프로젝트 파일이 아닙니다.');for(const [key,item] of Object.entries(data.assets||{})){await putAsset(key,dataUrlToBlob(item.data));}state=sanitizeProject(data.project);if(Array.isArray(data.customTemplates))storeCustomTemplates(data.customTemplates);selectedSceneId=state.scenes[0]?.id||null;currentTime=0;saveState();setupSelectOptions();renderTemplates();renderTemplateFilters();await renderAll();toast('프로젝트를 불러왔습니다.');}catch(err){toast(`프로젝트 불러오기 실패: ${err.message}`,'error');}
}

async function importTemplateFile(file){
  try{const data=JSON.parse(await file.text());const templates=Array.isArray(data)?data:[data];const valid=templates.filter(t=>t&&Array.isArray(t.sequence));if(!valid.length)throw new Error('유효한 템플릿이 없습니다.');const customs=loadCustomTemplates();valid.forEach(t=>customs.unshift({...t,id:createId('custom'),category:'custom'}));storeCustomTemplates(customs);setupSelectOptions();templateFilter='custom';renderTemplateFilters();renderTemplates();toast(`${valid.length}개 템플릿을 가져왔습니다.`);}catch(err){toast(`템플릿 가져오기 실패: ${err.message}`,'error');}
}

async function resetProject(){
  pausePlayback(); const oldKeys=[...new Set([...state.scenes.map(s=>s.assetKey).filter(Boolean),state.audio.assetKey].filter(Boolean))]; for(const key of oldKeys)await deleteAsset(key).catch(()=>{}); state=demoProject();directorPlan=null;directorBases=[];directorTemplateId='impact-flow';selectedSceneId=state.scenes[0].id;currentTime=0;customAudioBufferCache=null;saveState();await renderAll();toast('데모 프로젝트로 초기화했습니다.');
}

function bindInspector(){
  $('#sceneNameInput').addEventListener('input',e=>updateSelectedScene({name:e.target.value},false)); $('#sceneNameInput').addEventListener('change',()=>renderAll());
  $('#durationInput').addEventListener('change',e=>updateSelectedScene({duration:clamp(Number(e.target.value)||2.4,.8,15)})); $('#transitionSelect').addEventListener('change',e=>updateSelectedScene({transition:e.target.value}));
  $('#motionPresetSelect').addEventListener('change',e=>{const scene=selectedScene();if(!scene)return;const next=hydrateMotion(scene,e.target.value,{motionPreset:e.target.value,id:scene.id,name:scene.name,motionPath:[],cameraKeyframes:[]});Object.assign(scene,next);saveState();renderAll();});
  ['startZoom','endZoom','startX','startY','endX','endY','cursorX','cursorY'].forEach(key=>{const input=$(`#${key}Input`);input.addEventListener('input',e=>{const scene=selectedScene();if(!scene)return;scene[key]=Number(e.target.value);scene.motionPreset='custom';scene.cameraKeyframes=[];if(['startX','startY','endX','endY'].includes(key))scene.motionPath=[];const out=$(`#${key}Output`);if(out)out.textContent=`${e.target.value}%`;saveState();updatePreview();renderSceneCards();});});
  $('#cursorEnabledInput').addEventListener('change',e=>updateSelectedScene({cursorEnabled:e.target.checked,cursorFollowPath:e.target.checked&&effectiveMotionPath(selectedScene()).length>=2,motionPreset:'custom'}));
}

function bindEvents(){
  $('#menuButton').addEventListener('click',()=>{const nav=$('#mobileNav');const open=nav.hidden;nav.hidden=!open;$('#menuButton').setAttribute('aria-expanded',String(open));});
  $$('#mobileNav a').forEach(a=>a.addEventListener('click',()=>{$('#mobileNav').hidden=true;$('#menuButton').setAttribute('aria-expanded','false');}));
  $('#urlStoryButton').addEventListener('click',()=>captureUrl(true)); $('#urlSingleButton').addEventListener('click',()=>captureUrl(false)); $('#urlInput').addEventListener('keydown',e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();captureUrl(true);}});
  $('#useExampleUrlButton')?.addEventListener('click',()=>{ $('#urlInput').value='https://example.com/'; $('#urlInput').focus(); setCaptureStatus('예제 URL 입력됨','이제 “URL 시퀀스로 쇼릴”을 눌러 실제 캡처를 시작하세요.'); });
  $('#templateSearchInput')?.addEventListener('input',e=>{templateSearchQuery=e.target.value;renderTemplates();});
  $('#rebuildDirectorButton')?.addEventListener('click',rebuildDirectorPlan); $('#applyDirectorButton')?.addEventListener('click',applyDirectorPlan); $('#rebuildFromSelectionButton')?.addEventListener('click',rebuildDirectorFromSelection);
  ['#analysisPageLimitSelect','#analysisElementLimitSelect','#analysisBandSelect'].forEach((selector)=>$(selector)?.addEventListener('change',()=>{ if(directorBases.length) setCaptureStatus('분석 범위 변경됨','‘분석 범위 다시 적용’을 누르면 새 범위로 목록을 다시 만듭니다.','warning'); }));
  $$('[data-analysis-role]').forEach((input)=>input.addEventListener('change',()=>{ if(directorBases.length) setCaptureStatus('분석 범위 변경됨','‘분석 범위 다시 적용’을 누르면 새 범위로 목록을 다시 만듭니다.','warning'); }));
  bindPathEditor();
  $('#imageUploadButton').addEventListener('click',()=>$('#imageInput').click()); $('#imageInput').addEventListener('change',e=>{handleMediaFiles(e.target.files);e.target.value='';}); $('#screenCaptureButton').addEventListener('click',captureScreen); $('#screenRecordButton').addEventListener('click',recordScreenClip);
  $('#saveTemplateButton').addEventListener('click',()=>{$('#templateNameInput').value='';$('#templateSaveDialog').showModal();setTimeout(()=>$('#templateNameInput').focus(),30);});
  $('#templateSaveForm').addEventListener('submit',e=>{e.preventDefault();const name=$('#templateNameInput').value.trim();if(!name)return;saveCurrentTemplate(name,$('#templateCategoryInput').value);$('#templateSaveDialog').close();});
  $('#importTemplateButton').addEventListener('click',()=>$('#templateFileInput').click()); $('#templateFileInput').addEventListener('change',e=>{if(e.target.files[0])importTemplateFile(e.target.files[0]);e.target.value='';});
  $('#aspectSelect').addEventListener('change',e=>{state.aspect=e.target.value;saveState();renderAll();}); $('#frameStyleSelect').addEventListener('change',e=>{state.frameStyle=e.target.value;saveState();updatePreview();}); $('#resolutionSelect').addEventListener('change',e=>{state.resolution=e.target.value;saveState();renderAll();});
  $('#duplicateSceneButton').addEventListener('click',duplicateSelectedScene); $('#deleteSceneButton').addEventListener('click',deleteSelectedScene);
  $('#playButton').addEventListener('click',togglePlay); $('#seekInput').addEventListener('input',e=>{pausePlayback();currentTime=Number(e.target.value);renderMeta();updatePreview();});
  $('#soundPresetSelect').addEventListener('change',e=>{stopPreviewAudio();state.audio.preset=e.target.value;saveState();renderSound();}); $('#volumeInput').addEventListener('input',e=>{state.audio.volume=Number(e.target.value);$('#volumeOutput').textContent=`${e.target.value}%`;saveState();}); $('#fadeAudioInput').addEventListener('change',e=>{state.audio.fade=e.target.checked;saveState();});
  $('#soundPreviewButton').addEventListener('click',()=>{if(previewAudio){stopPreviewAudio();clearTimeout(soundPreviewTimer);$('#soundPreviewButton').textContent='미리듣기';}else previewSoundOnly();}); $('#audioUploadButton').addEventListener('click',()=>$('#audioInput').click()); $('#audioInput').addEventListener('change',e=>{if(e.target.files[0])handleAudioFile(e.target.files[0]);e.target.value='';});
  $('#exportButton').addEventListener('click',exportWebM);
  $('#projectExportButton').addEventListener('click',exportProject); $('#mobileProjectExportButton').addEventListener('click',exportProject); $('#projectImportButton').addEventListener('click',()=>$('#projectFileInput').click()); $('#projectFileInput').addEventListener('change',e=>{if(e.target.files[0])importProjectFile(e.target.files[0]);e.target.value='';});
  $('#resetButton').addEventListener('click',()=>$('#resetDialog').showModal()); $('#confirmResetButton').addEventListener('click',()=>{setTimeout(resetProject,0);});
  window.addEventListener('keydown',e=>{if(e.code==='Space'&&!['INPUT','SELECT','TEXTAREA','BUTTON'].includes(document.activeElement?.tagName)){e.preventDefault();togglePlay();}if(e.key==='Escape'&&!$('#mobileNav').hidden){$('#mobileNav').hidden=true;$('#menuButton').setAttribute('aria-expanded','false');}});
  window.addEventListener('beforeunload',()=>{stopPreviewAudio();assetUrlCache.forEach(url=>URL.revokeObjectURL(url));});
}

function syncScopeControls(scope) {
  if (!scope) return;
  if ($('#analysisPageLimitSelect')) $('#analysisPageLimitSelect').value = String(scope.pageLimit || 3);
  if ($('#analysisElementLimitSelect')) $('#analysisElementLimitSelect').value = String(scope.elementLimit || 10);
  if ($('#analysisBandSelect')) $('#analysisBandSelect').value = scope.grouping || 'screen';
  const roles = new Set(scope.roles || ['headings','media','navigation','actions']);
  $$('[data-analysis-role]').forEach((input) => { input.checked = roles.has(input.dataset.analysisRole); });
}

function browserSupportCheck(){
  const missing=[]; if(!('indexedDB'in window))missing.push('IndexedDB'); if(!window.MediaRecorder)missing.push('MediaRecorder'); if(!HTMLCanvasElement.prototype.captureStream)missing.push('Canvas captureStream');
  if(missing.length)setCaptureStatus('일부 기능 제한',`${missing.join(', ')} 기능이 없습니다. 최신 Chrome/Edge를 권장합니다.`,'error');
}

async function init(){
  state=loadState();
  selectedSceneId=state.scenes[0]?.id||null;
  directorPlan=state.directorPlan?.pages ? state.directorPlan : null;
  directorTemplateId=state.directorTemplateId || 'impact-flow';
  if (directorPlan?.scope) syncScopeControls(directorPlan.scope);
  if(directorPlan){
    const grouped=new Map();
    state.scenes.filter((scene)=>Number.isInteger(scene.sourcePageIndex)).forEach((scene)=>{if(!grouped.has(scene.sourcePageIndex))grouped.set(scene.sourcePageIndex,structuredClone(scene));});
    directorBases=[...grouped.entries()].sort((a,b)=>a[0]-b[0]).map(([,scene])=>scene);
    if ((Number(directorPlan.version || 0) < 4 || !Array.isArray(directorPlan.flow) || !directorPlan.flow.length) && directorBases.length) {
      directorPlan=createDirectorPlan(directorBases,{scope:directorPlan.scope || currentAnalysisScope()});
      state.directorPlan=directorPlan;
      saveState();
    }
  }
  setupSelectOptions();
  renderTemplateFilters();
  renderTemplates();
  renderDirectorPlan();
  bindInspector();
  bindEvents();
  browserSupportCheck();
  await renderAll();
  renderDomAnalysis(state.scenes);
  window.__motionframeReady = true;
  document.documentElement.classList.add('app-ready');
  const target = location.hash ? document.querySelector(location.hash) : null;
  if (target) requestAnimationFrame(() => target.scrollIntoView({ block: 'start' }));
}

init().catch(err=>{
  console.error(err);
  const message = `초기화 실패: ${err.message}`;
  try { toast(message,'error'); } catch {}
  const status = document.querySelector('#captureStatus');
  if(status){status.classList.add('error');status.querySelector('strong').textContent='앱 초기화 실패';status.querySelector('p').textContent=message;}
});
