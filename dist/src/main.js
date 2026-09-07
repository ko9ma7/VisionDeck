import { MODELS, DEFAULT_MODEL_IDS } from './data/models.js';
import { DEMO_OUTPUTS, DEMO_LATENCY, DEMO_COST } from './data/demo.js';
import { autoRoute, formatBytes, getInputKind } from './lib/files.js';
import { consensusScores } from './lib/scoring.js';
import { runGatewayModel } from './lib/gateway.js';

const state = {
  file: null,
  objectUrl: null,
  tab: 'ocr',
  zoom: 1,
  showBoxes: true,
  selectionMode: false,
  autoRouter: true,
  consensus: true,
  selectedIds: loadJSON('visiondeck.models', DEFAULT_MODEL_IDS),
  theme: localStorage.getItem('visiondeck.theme') || 'dark',
  settings: { mode: 'demo', endpoint: 'https://gateway.vlm.run/v1/openai', apiKey: '', remoteUrl: '' },
  runs: makeRuns(),
  running: false,
};

const $ = (id) => document.getElementById(id);
const tabs = ['ocr', 'vision', 'table', 'document', 'compare'];

function loadJSON(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
function makeRuns() { return Object.fromEntries(MODELS.map((m) => [m.id, { modelId: m.id, status: 'idle', output: '', latencyMs: null, costUsd: null, agreement: null, error: '' }])); }
function icon(id) { return `<svg><use href="#${id}"/></svg>`; }
function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function selectedModels() { return MODELS.filter((model) => state.selectedIds.includes(model.id)); }
function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[c])); }

function notify(message, type = 'info') {
  const item = document.createElement('div');
  item.className = `toast toast-${type}`;
  item.textContent = message;
  $('toastStack').append(item);
  setTimeout(() => item.remove(), 3200);
}

function updateTheme() {
  document.documentElement.dataset.theme = state.theme;
  localStorage.setItem('visiondeck.theme', state.theme);
  $('themeButton').innerHTML = icon(state.theme === 'dark' ? 'i-sun' : 'i-moon');
}

function renderDropZone() {
  const root = $('dropContainer');
  if (state.file) {
    const kind = getInputKind(state.file);
    root.innerHTML = `<div class="file-card"><div class="file-icon">${kind === 'pdf' ? 'PDF' : kind === 'video' ? 'VID' : 'IMG'}</div><div class="file-meta"><strong title="${escapeHtml(state.file.name)}">${escapeHtml(state.file.name)}</strong><span>${formatBytes(state.file.size)} · ${kind.toUpperCase()}</span></div><button id="removeFile" class="icon-button" aria-label="파일 제거" title="파일 제거">${icon('i-close')}</button></div>`;
    $('removeFile').onclick = () => setFile(null);
    return;
  }
  root.innerHTML = `<button id="dropZone" type="button" class="drop-zone"><input id="fileInput" class="sr-only" type="file" accept="application/pdf,image/*,video/*"><span class="drop-icon">${icon('i-upload')}</span><span class="drop-title">파일을 끌어놓거나 클릭</span><span class="drop-copy">PDF · Image · Screenshot · Video</span></button>`;
  const zone = $('dropZone'); const input = $('fileInput');
  zone.onclick = () => input.click();
  input.onchange = () => input.files?.[0] && setFile(input.files[0]);
  zone.ondragover = (e) => { e.preventDefault(); zone.classList.add('is-dragging'); };
  zone.ondragleave = () => zone.classList.remove('is-dragging');
  zone.ondrop = (e) => { e.preventDefault(); zone.classList.remove('is-dragging'); if (e.dataTransfer.files?.[0]) setFile(e.dataTransfer.files[0]); };
}

function setFile(file) {
  if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
  state.file = file;
  state.objectUrl = file ? URL.createObjectURL(file) : null;
  state.runs = makeRuns();
  state.zoom = 1;
  if (state.autoRouter && file) {
    const route = autoRoute(file);
    state.selectedIds = route.recommendedModelIds.filter((id) => MODELS.some((m) => m.id === id));
    localStorage.setItem('visiondeck.models', JSON.stringify(state.selectedIds));
  }
  renderAll();
}

function renderRouter() {
  const route = autoRoute(state.file);
  $('routeLabel').textContent = route.label;
  $('routeKind').textContent = route.kind;
  $('routeReason').textContent = route.reason;
  $('autoRouterToggle').checked = state.autoRouter;
  $('consensusToggle').checked = state.consensus;
  $('featureStatus').textContent = `Auto Router ${state.autoRouter ? 'ON' : 'OFF'} · Consensus ${state.consensus ? 'ON' : 'OFF'}`;
}

function renderModels() {
  $('selectedCount').textContent = `${state.selectedIds.length} selected`;
  $('modelSelectorLabel').textContent = `${state.selectedIds.length} models`;
  const list = $('modelList');
  list.innerHTML = MODELS.map((model) => `<label class="model-row ${state.selectedIds.includes(model.id) ? 'is-selected' : ''}" data-model="${model.id}"><input type="checkbox" ${state.selectedIds.includes(model.id) ? 'checked' : ''}><span class="model-avatar">${escapeHtml(model.shortName.slice(0,2).toUpperCase())}</span><span><strong>${escapeHtml(model.shortName)}</strong><small>${model.kind} · ${model.speedClass}</small></span></label>`).join('');
  list.querySelectorAll('[data-model]').forEach((row) => row.querySelector('input').onchange = () => toggleModel(row.dataset.model));
  const menu = $('modelMenu');
  menu.innerHTML = MODELS.map((model) => `<label data-menu-model="${model.id}"><input type="checkbox" ${state.selectedIds.includes(model.id) ? 'checked' : ''}><span>${escapeHtml(model.shortName)}</span></label>`).join('');
  menu.querySelectorAll('[data-menu-model]').forEach((row) => row.querySelector('input').onchange = () => toggleModel(row.dataset.menuModel));
}

function toggleModel(id) {
  state.selectedIds = state.selectedIds.includes(id) ? state.selectedIds.filter((item) => item !== id) : [...state.selectedIds, id];
  localStorage.setItem('visiondeck.models', JSON.stringify(state.selectedIds));
  renderModels(); renderResults();
}

function renderTabs() {
  $('tabs').innerHTML = tabs.map((tab) => `<button data-tab="${tab}" class="${state.tab === tab ? 'is-active' : ''}" role="tab" aria-selected="${state.tab === tab}">${tab[0].toUpperCase() + tab.slice(1)}</button>`).join('');
  $('tabs').querySelectorAll('[data-tab]').forEach((button) => button.onclick = () => { state.tab = button.dataset.tab; renderTabs(); renderResults(); });
  $('resultTitle').textContent = state.tab === 'compare' ? 'Compare results' : `${state.tab.toUpperCase()} results`;
}

function sampleReceipt() {
  return `<article class="sample-receipt" aria-label="샘플 영수증"><div class="receipt-head"><div class="receipt-logo">VD</div><div><strong>비전카페 강남점</strong><span>서울특별시 강남구 테헤란로 123</span></div></div><div class="receipt-dashed"></div><dl class="receipt-info"><div><dt>사업자번호</dt><dd>120-88-02104</dd></div><div><dt>일시</dt><dd>2026-09-06 18:42</dd></div></dl><table><thead><tr><th>품목</th><th>수량</th><th>금액</th></tr></thead><tbody><tr><td>아메리카노</td><td>2</td><td>9,000</td></tr><tr><td>치즈케이크</td><td>1</td><td>6,500</td></tr></tbody></table><div class="receipt-total"><span>합계</span><strong>₩ 15,500</strong></div><div class="barcode" aria-hidden="true"></div><small>감사합니다 · VisionDeck Demo Receipt</small>${state.showBoxes ? '<span class="bbox bbox-demo-one"></span><span class="bbox bbox-demo-two"></span><span class="bbox bbox-demo-three"></span>' : ''}</article>`;
}

function renderPreview() {
  $('sourceLabel').textContent = state.file ? state.file.name : '샘플 영수증';
  $('zoomValue').textContent = `${Math.round(state.zoom * 100)}%`;
  $('boxButton').classList.toggle('is-active', state.showBoxes);
  $('selectionButton').classList.toggle('is-active', state.selectionMode);
  $('previewStage').classList.toggle('selection-mode', state.selectionMode);
  const root = $('previewTransform');
  root.style.transform = `scale(${state.zoom})`;
  if (!state.file) { root.innerHTML = sampleReceipt(); return; }
  const kind = getInputKind(state.file); const url = state.objectUrl;
  if (kind === 'image') root.innerHTML = `<img src="${url}" alt="${escapeHtml(state.file.name)} 미리보기">${state.showBoxes ? '<span class="bbox bbox-one"></span><span class="bbox bbox-two"></span><span class="bbox bbox-three"></span>' : ''}`;
  else if (kind === 'video') root.innerHTML = `<video src="${url}" controls preload="metadata"></video>`;
  else if (kind === 'pdf') root.innerHTML = `<object data="${url}" type="application/pdf" aria-label="${escapeHtml(state.file.name)} PDF 미리보기"><p>이 브라우저에서는 PDF 미리보기를 표시할 수 없습니다.</p></object>`;
  else root.innerHTML = '<div class="unsupported">지원하지 않는 미리보기 형식입니다.</div>';
}

function resultCard(model) {
  const run = state.runs[model.id];
  let body = '<div class="result-state"><strong>대기 중</strong><span>상단의 Run comparison을 눌러 결과를 생성하세요.</span></div>';
  if (run.status === 'running' || run.status === 'queued') body = '<div class="result-state"><div class="spinner"></div><strong>분석 중</strong><span>모델 응답을 기다리고 있습니다.</span></div>';
  else if (run.status === 'error') body = `<div class="result-state is-error"><strong>요청 실패</strong><span>${escapeHtml(run.error)}</span></div>`;
  else if (run.output) body = `<pre>${escapeHtml(run.output)}</pre>`;
  return `<article class="result-card ${state.selectedIds.includes(model.id) ? 'is-selected' : ''}"><header class="result-card-header"><label class="model-check"><input data-card-model="${model.id}" type="checkbox" ${state.selectedIds.includes(model.id) ? 'checked' : ''}><span class="check-ui">✓</span><span><strong>${escapeHtml(model.shortName)}</strong><small>${escapeHtml(model.vendor)} · ${model.speedClass}</small></span></label><span class="status-dot status-${run.status}"></span></header><div class="result-body">${body}</div><footer class="result-footer"><span><small>일치도</small><strong>${run.agreement ? `${run.agreement}%` : '—'}</strong></span><span><small>시간</small><strong>${run.latencyMs ? `${(run.latencyMs/1000).toFixed(2)}s` : '—'}</strong></span><span><small>비용</small><strong>${run.costUsd != null ? `$${run.costUsd.toFixed(4)}` : '—'}</strong></span><button data-copy-model="${model.id}" class="icon-button" ${run.output ? '' : 'disabled'} title="결과 복사">${icon('i-copy')}</button></footer></article>`;
}

function compareView(models) {
  const completed = models.filter((model) => state.runs[model.id]?.status === 'done');
  const bestAgreement = completed.reduce((best, model) => Math.max(best, state.runs[model.id].agreement || 0), 0);
  const fastest = completed.reduce((best, model) => !best || (state.runs[model.id].latencyMs ?? Infinity) < (state.runs[best.id].latencyMs ?? Infinity) ? model : best, null);
  return `<div class="compare-wrap"><div class="compare-summary"><div><small>Best agreement</small><strong>${bestAgreement ? bestAgreement + '%' : '—'}</strong></div><div><small>Fastest model</small><strong>${fastest?.shortName || '—'}</strong></div><div><small>Completed</small><strong>${completed.length}/${models.length}</strong></div></div><div class="table-scroll"><table class="compare-table"><thead><tr><th>Model</th><th>Role</th><th>Agreement</th><th>Latency</th><th>Cost</th><th>Status</th></tr></thead><tbody>${models.map((model) => { const run=state.runs[model.id]; return `<tr><td><strong>${escapeHtml(model.shortName)}</strong><small>${escapeHtml(model.vendor)}</small></td><td>${model.kind}</td><td>${run.agreement ? run.agreement+'%' : '—'}</td><td>${run.latencyMs ? (run.latencyMs/1000).toFixed(2)+'s' : '—'}</td><td>${run.costUsd != null ? '$'+run.costUsd.toFixed(4) : '—'}</td><td><span class="table-status status-${run.status}">${run.status}</span></td></tr>`; }).join('')}</tbody></table></div><p class="metric-note">일치도는 여러 모델 출력 간 토큰 중첩을 이용한 비교용 휴리스틱입니다. 실제 OCR 정확도 평가에는 정답 데이터셋이 필요합니다.</p></div>`;
}

function renderResults() {
  const models = selectedModels(); const root = $('rightPanelScroll');
  root.innerHTML = state.tab === 'compare' ? compareView(models) : `<div class="result-stack">${models.map(resultCard).join('')}</div>`;
  root.querySelectorAll('[data-card-model]').forEach((input) => input.onchange = () => toggleModel(input.dataset.cardModel));
  root.querySelectorAll('[data-copy-model]').forEach((button) => button.onclick = async () => { try { await navigator.clipboard.writeText(state.runs[button.dataset.copyModel].output); notify('결과를 클립보드에 복사했습니다.', 'success'); } catch { notify('클립보드 복사에 실패했습니다.', 'error'); } });
}

function renderSettings() {
  $('modeBadge').textContent = state.settings.mode === 'live' ? 'LIVE' : 'DEMO';
  $('modeBadge').classList.toggle('is-live', state.settings.mode === 'live');
  $('demoModeButton').classList.toggle('is-active', state.settings.mode === 'demo');
  $('liveModeButton').classList.toggle('is-active', state.settings.mode === 'live');
  $('endpointInput').value = state.settings.endpoint;
  $('apiKeyInput').value = state.settings.apiKey;
  $('remoteUrlInput').value = state.settings.remoteUrl;
  $('gatewayStatus').textContent = state.settings.mode === 'demo' ? 'Demo sandbox' : state.settings.endpoint.replace('https://','');
}

function renderAll() { updateTheme(); renderDropZone(); renderRouter(); renderModels(); renderTabs(); renderPreview(); renderResults(); renderSettings(); }

async function runComparison() {
  const sourceTab = state.tab;
  const models = selectedModels();
  if (!models.length) return notify('비교할 모델을 하나 이상 선택하세요.', 'error');
  if (state.running) return;
  state.running = true; state.tab = 'compare';
  $('runButton').disabled = true; $('runButton').querySelector('span').textContent = 'Running…'; $('analysisState').textContent = 'Running';
  for (const model of models) state.runs[model.id] = { ...state.runs[model.id], status: 'queued', error: '' };
  renderTabs(); renderResults();

  if (state.settings.mode === 'demo') {
    const outputs = {};
    await Promise.all(models.map(async (model, index) => {
      state.runs[model.id].status = 'running'; renderResults(); await sleep(420 + index * 160);
      const output = DEMO_OUTPUTS[model.id] || `${model.shortName} demo output`;
      outputs[model.id] = output;
      state.runs[model.id] = { ...state.runs[model.id], status: 'done', output, latencyMs: DEMO_LATENCY[model.id] || 1500, costUsd: DEMO_COST[model.id] ?? null };
      renderResults();
    }));
    if (state.consensus) { const scores = consensusScores(outputs); Object.entries(scores).forEach(([id, agreement]) => state.runs[id].agreement = agreement); }
    finishRun('모델 비교가 완료되었습니다.', 'success'); return;
  }

  if (!state.file) { finishRun('Live Gateway 실행에는 파일이 필요합니다.', 'error'); return; }
  const outputs = {};
  await Promise.all(models.map(async (model) => {
    state.runs[model.id].status = 'running'; renderResults();
    try {
      const prompt = sourceTab === 'vision' ? 'Describe the visual content accurately.' : 'Extract the content faithfully. Preserve tables and important numbers.';
      const result = await runGatewayModel(model, state.file, state.settings, prompt);
      outputs[model.id] = result.output;
      state.runs[model.id] = { ...state.runs[model.id], status: 'done', output: result.output, latencyMs: result.latencyMs, costUsd: result.costUsd };
    } catch (error) { state.runs[model.id] = { ...state.runs[model.id], status: 'error', error: error instanceof Error ? error.message : '알 수 없는 오류' }; }
    renderResults();
  }));
  if (state.consensus) { const scores = consensusScores(outputs); Object.entries(scores).forEach(([id, agreement]) => state.runs[id].agreement = agreement); }
  finishRun(Object.keys(outputs).length ? 'Live Gateway 요청이 끝났습니다.' : '모든 Live 요청이 실패했습니다. CORS·URL·rate limit을 확인하세요.', Object.keys(outputs).length ? 'success' : 'error');
}

function finishRun(message, type) { state.running = false; $('runButton').disabled = false; $('runButton').querySelector('span').textContent = 'Run comparison'; $('analysisState').textContent = 'Ready'; renderResults(); notify(message, type); }

$('themeButton').onclick = () => { state.theme = state.theme === 'dark' ? 'light' : 'dark'; updateTheme(); };
$('resetButton').onclick = () => { setFile(null); state.tab='ocr'; notify('워크스페이스를 초기화했습니다.'); };
$('autoRouterToggle').onchange = (e) => { state.autoRouter = e.target.checked; if (state.autoRouter && state.file) { state.selectedIds = autoRoute(state.file).recommendedModelIds; localStorage.setItem('visiondeck.models', JSON.stringify(state.selectedIds)); } renderRouter(); renderModels(); renderResults(); };
$('consensusToggle').onchange = (e) => { state.consensus = e.target.checked; renderRouter(); };
$('runButton').onclick = runComparison;
$('modelSelectorButton').onclick = () => { $('modelMenu').hidden = !$('modelMenu').hidden; };
$('boxButton').onclick = () => { state.showBoxes=!state.showBoxes; renderPreview(); };
$('selectionButton').onclick = () => { state.selectionMode=!state.selectionMode; renderPreview(); };
$('zoomOutButton').onclick = () => { state.zoom=Math.max(.7, state.zoom-.1); renderPreview(); };
$('zoomInButton').onclick = () => { state.zoom=Math.min(1.6, state.zoom+.1); renderPreview(); };
$('settingsButton').onclick = () => { $('settingsBackdrop').hidden=false; renderSettings(); };
$('settingsClose').onclick = $('settingsDone').onclick = () => $('settingsBackdrop').hidden=true;
$('settingsBackdrop').onmousedown = (e) => { if (e.target === $('settingsBackdrop')) $('settingsBackdrop').hidden=true; };
$('demoModeButton').onclick = () => { state.settings.mode='demo'; renderSettings(); };
$('liveModeButton').onclick = () => { state.settings.mode='live'; renderSettings(); };
$('endpointInput').oninput = (e) => { state.settings.endpoint=e.target.value; renderSettings(); };
$('apiKeyInput').oninput = (e) => { state.settings.apiKey=e.target.value; };
$('remoteUrlInput').oninput = (e) => { state.settings.remoteUrl=e.target.value; };
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { $('settingsBackdrop').hidden=true; $('modelMenu').hidden=true; } });
document.addEventListener('click', (e) => { if (!$('modelSelectorButton').contains(e.target) && !$('modelMenu').contains(e.target)) $('modelMenu').hidden=true; });

renderAll();
