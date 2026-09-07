import { LOCAL_PIPELINES, DEFAULT_CLOUD_MODELS } from './config.js';
import { fileToCanvas } from './utils/image.js';
import { loadPdf, renderPdfPage, renderPdfPages } from './engines/pdf-engine.js';
import { runTesseract, terminateTesseract } from './engines/tesseract-engine.js';
import { prepareTransformersModel, runImageToText } from './engines/transformers-engine.js';
import { runCloudModel, testCloudConnection } from './engines/cloud-engine.js';
import { agreementScores, diffSummary, formatDuration } from './utils/metrics.js';
import { extractTable, rowsToMarkdown, formatDocumentJson } from './utils/postprocess.js';
import { downloadText, safeBaseName } from './utils/export.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

const state = {
  file:null, fileType:null, canvas:null, pdf:null, pdfPage:1, pdfCanvases:new Map(), task:'ocr', zoom:1,
  showBoxes:true, autoRouter:true, consensus:true, selected:new Set(['tess-original','tess-contrast','tess-threshold']),
  results:[], activeResult:null, cloudEnabled:false, cloudEndpoint:'https://gateway.vlm.run/v1/openai', apiKey:'',
  cloudModels: DEFAULT_CLOUD_MODELS.map(m=>({...m, selected:false})), optionalPrepared:new Set()
};

const els = {
  fileInput:$('#fileInput'), dropCard:$('#dropCard'), sampleButton:$('#sampleButton'), emptySampleButton:$('#emptySampleButton'), fileCard:$('#fileCard'), fileName:$('#fileName'), fileInfo:$('#fileInfo'), fileType:$('#fileType'), clearFile:$('#clearFile'),
  routerToggle:$('#routerToggle'), routerTask:$('#routerTask'), routerReason:$('#routerReason'), routerType:$('#routerType'), modelList:$('#modelList'), selectedCount:$('#selectedCount'), consensusToggle:$('#consensusToggle'), privacyTitle:$('#privacyTitle'), privacyText:$('#privacyText'),
  taskTabs:$('#taskTabs'), runButton:$('#runButton'), modelSelectLabel:$('#modelSelectLabel'), sourceName:$('#sourceName'), previewEmpty:$('#previewEmpty'), previewScroll:$('#previewScroll'), previewTransform:$('#previewTransform'), progressOverlay:$('#progressOverlay'), progressTitle:$('#progressTitle'), progressText:$('#progressText'), progressBar:$('#progressBar'),
  boxButton:$('#boxButton'), zoomLabel:$('#zoomLabel'), zoomIn:$('#zoomIn'), zoomOut:$('#zoomOut'), fitButton:$('#fitButton'), pdfNav:$('#pdfNav'), pageNum:$('#pageNum'), pageCount:$('#pageCount'), prevPage:$('#prevPage'), nextPage:$('#nextPage'),
  outputEmpty:$('#outputEmpty'), resultsView:$('#resultsView'), outputTitle:$('#outputTitle'), readyStatus:$('#readyStatus'), bestAgreement:$('#bestAgreement'), fastestModel:$('#fastestModel'), completedCount:$('#completedCount'), resultRows:$('#resultRows'), detailTabs:$('#detailTabs'), detailTitle:$('#detailTitle'), detailMeta:$('#detailMeta'), detailText:$('#detailText'), consensusBox:$('#consensusBox'), consensusContent:$('#consensusContent'), copyResult:$('#copyResult'), downloadJson:$('#downloadJson'), downloadTxt:$('#downloadTxt'),
  themeButton:$('#themeButton'), settingsButton:$('#settingsButton'), settingsDialog:$('#settingsDialog'), endpointInput:$('#endpointInput'), apiKeyInput:$('#apiKeyInput'), cloudModelGrid:$('#cloudModelGrid'), testConnection:$('#testConnection'), connectionStatus:$('#connectionStatus'), saveSettings:$('#saveSettings'), modeBadge:$('#modeBadge'),
  localModelsButton:$('#localModelsButton'), localModelsDialog:$('#localModelsDialog'), toast:$('#toast'), engineStatus:$('#engineStatus'), centerStatus:$('#centerStatus')
};

init();

function init() {
  renderCloudModels();
  renderModels();
  bindEvents();
  applyTheme(localStorage.getItem('visiondeck-theme') || 'dark');
  updateUI();
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('./sw.js').catch(()=>{});
}

function bindEvents() {
  els.fileInput.addEventListener('change', e => e.target.files?.[0] && loadFile(e.target.files[0]));
  ['dragenter','dragover'].forEach(ev => els.dropCard.addEventListener(ev, e => { e.preventDefault(); els.dropCard.classList.add('drag'); }));
  ['dragleave','drop'].forEach(ev => els.dropCard.addEventListener(ev, e => { e.preventDefault(); els.dropCard.classList.remove('drag'); }));
  els.dropCard.addEventListener('drop', e => e.dataTransfer.files?.[0] && loadFile(e.dataTransfer.files[0]));
  els.sampleButton.addEventListener('click', loadSample); els.emptySampleButton.addEventListener('click', loadSample);
  els.clearFile.addEventListener('click', resetFile);
  els.routerToggle.addEventListener('change', e => { state.autoRouter=e.target.checked; updateRouter(); updateCenterStatus(); });
  els.consensusToggle.addEventListener('change', e => { state.consensus=e.target.checked; renderConsensus(); updateCenterStatus(); });
  els.taskTabs.addEventListener('click', e => { const b=e.target.closest('[data-task]'); if(!b)return; setTask(b.dataset.task); });
  els.modelList.addEventListener('click', e => { const card=e.target.closest('[data-model]'); if(!card)return; const id=card.dataset.model; if(state.selected.has(id)) state.selected.delete(id); else state.selected.add(id); renderModels(); updateUI(); });
  els.runButton.addEventListener('click', runSelected);
  els.zoomIn.addEventListener('click',()=>setZoom(state.zoom+.1)); els.zoomOut.addEventListener('click',()=>setZoom(state.zoom-.1)); els.fitButton.addEventListener('click',()=>setZoom(1));
  els.boxButton.addEventListener('click',()=>{state.showBoxes=!state.showBoxes;els.boxButton.classList.toggle('active',state.showBoxes);renderBoxes();});
  els.prevPage.addEventListener('click',()=>changePdfPage(-1)); els.nextPage.addEventListener('click',()=>changePdfPage(1));
  els.resultRows.addEventListener('click',e=>{const tr=e.target.closest('tr[data-result]');if(tr)showResult(tr.dataset.result);});
  els.detailTabs.addEventListener('click',e=>{const b=e.target.closest('[data-result]');if(b)showResult(b.dataset.result);});
  els.copyResult.addEventListener('click',copyCurrent); els.downloadTxt.addEventListener('click',()=>exportCurrent('txt')); els.downloadJson.addEventListener('click',()=>exportCurrent('json'));
  els.themeButton.addEventListener('click',()=>applyTheme(document.documentElement.dataset.theme==='dark'?'light':'dark'));
  els.settingsButton.addEventListener('click',()=>els.settingsDialog.showModal());
  els.localModelsButton.addEventListener('click',()=>els.localModelsDialog.showModal());
  els.testConnection.addEventListener('click',testConnection);
  els.saveSettings.addEventListener('click',saveSettings);
  $$('[data-local-model]').forEach(btn=>btn.addEventListener('click',()=>prepareLocalModel(btn.dataset.localModel,btn)));
  window.addEventListener('beforeunload',()=>terminateTesseract());
}

async function loadSample() {
  const res = await fetch('./public/sample-document.png');
  const blob = await res.blob();
  await loadFile(new File([blob], 'visiondeck-sample.png', { type:'image/png' }));
  toast('샘플도 고정 결과가 아니라 실제 OCR로 처리됩니다.');
}

async function loadFile(file) {
  resetResults();
  state.file=file; state.pdf=null; state.canvas=null; state.pdfCanvases.clear(); state.pdfPage=1;
  state.fileType = file.type === 'application/pdf' || /\.pdf$/i.test(file.name) ? 'pdf' : file.type.startsWith('video/') ? 'video' : 'image';
  showProgress('파일 준비 중', .05);
  try {
    if (state.fileType === 'pdf') {
      state.pdf = await loadPdf(file);
      state.canvas = await renderPdfPage(state.pdf,1);
      state.pdfCanvases.set(1,state.canvas);
      els.pageCount.textContent=state.pdf.numPages; els.pdfNav.hidden=false;
    } else {
      state.canvas = await fileToCanvas(file); els.pdfNav.hidden=true;
    }
    await displayCanvas(state.canvas);
    if (state.autoRouter) autoRoute(); else updateRouter();
    updateUI();
  } catch(e) { console.error(e); toast(`파일을 열 수 없습니다: ${e.message}`, true); resetFile(); }
  finally { hideProgress(); }
}

function resetFile() {
  state.file=null;state.fileType=null;state.canvas=null;state.pdf=null;state.pdfCanvases.clear();
  els.fileInput.value=''; els.previewTransform.innerHTML=''; els.previewEmpty.hidden=false; els.previewScroll.hidden=true; els.pdfNav.hidden=true;
  resetResults(); updateRouter(); updateUI();
}

async function displayCanvas(canvas) {
  els.previewTransform.innerHTML='';
  const wrap=document.createElement('div'); wrap.className='canvas-wrap';
  const display=canvas.cloneNode(true); display.getContext('2d').drawImage(canvas,0,0); display.className='source-canvas';
  wrap.append(display); const overlay=document.createElementNS('http://www.w3.org/2000/svg','svg');overlay.classList.add('bbox-layer');overlay.setAttribute('viewBox',`0 0 ${canvas.width} ${canvas.height}`);overlay.dataset.overlay='1';wrap.append(overlay);
  els.previewTransform.append(wrap); els.previewEmpty.hidden=true; els.previewScroll.hidden=false; setZoom(state.zoom); renderBoxes();
}

async function changePdfPage(delta) {
  if(!state.pdf)return; const next=Math.min(state.pdf.numPages,Math.max(1,state.pdfPage+delta)); if(next===state.pdfPage)return; state.pdfPage=next;
  showProgress(`PDF 페이지 ${next} 렌더링`,.25);
  try { let c=state.pdfCanvases.get(next); if(!c){c=await renderPdfPage(state.pdf,next);state.pdfCanvases.set(next,c);} state.canvas=c; await displayCanvas(c); els.pageNum.textContent=next; renderBoxes(); } finally {hideProgress();}
}

function autoRoute() {
  if(!state.file)return;
  const name=state.file.name.toLowerCase();
  let task='ocr', reason='이미지에서 텍스트를 읽는 기본 OCR을 추천합니다.';
  if(state.fileType==='video'){task='vision';reason='영상은 대표 프레임을 추출해 Vision 분석을 추천합니다.';}
  else if(/table|표|sheet|excel|chart/.test(name)){task='table';reason='파일 이름에 표/데이터 신호가 있어 표 추출을 추천합니다.';}
  else if(/invoice|receipt|영수증|세금|계산서|document|문서/.test(name)||state.fileType==='pdf'){task='document';reason='문서/PDF 신호가 있어 OCR 후 구조화 정보 추출을 추천합니다.';}
  else if(/photo|image|screenshot|capture|스크린|사진/.test(name)){task='ocr';reason='Screenshot/이미지는 먼저 OCR로 실제 텍스트를 확인하는 것이 빠릅니다.';}
  state.task=task; setDefaultSelection(task); updateRouter(); renderModels(); updateTaskTabs();
}

function setTask(task) { state.task=task; setDefaultSelection(task); updateRouter(); renderModels(); updateTaskTabs(); resetResults(); updateUI(); }
function setDefaultSelection(task) {
  if(task==='vision') state.selected=new Set(['local-caption']);
  else state.selected=new Set(['tess-original','tess-contrast','tess-threshold']);
  for(const m of state.cloudModels.filter(m=>m.selected)) state.selected.add(`cloud:${m.id}`);
}

function updateRouter() {
  els.routerToggle.checked=state.autoRouter;
  if(!state.file){els.routerTask.textContent='대기 중';els.routerType.textContent='파일을 먼저 넣으세요';els.routerReason.textContent='이미지/PDF의 형식과 로컬 신호를 기반으로 작업을 추천합니다.';return;}
  const labels={ocr:'OCR',vision:'VLM',table:'TABLE',document:'DOCUMENT',compare:'COMPARE'};
  els.routerTask.textContent=labels[state.task]||state.task; els.routerType.textContent=state.fileType.toUpperCase();
  els.routerReason.textContent = state.autoRouter ? ({ocr:'실제 텍스트 인식부터 시작하는 것이 적합합니다.',vision:'대표 프레임/이미지 의미 분석을 추천합니다.',table:'OCR 후 행·열 구조 추출을 추천합니다.',document:'OCR 후 날짜·금액·식별자 구조화를 추천합니다.',compare:'선택한 파이프라인 결과를 비교합니다.'}[state.task]) : 'Auto Router가 꺼져 있습니다. 위 탭에서 작업을 직접 선택하세요.';
}

function renderModels() {
  const local=LOCAL_PIPELINES.filter(m=>m.tasks.includes(state.task) || state.task==='compare');
  const cloud=state.cloudModels.filter(m=>m.selected).map(m=>({ id:`cloud:${m.id}`,label:m.label,short:'CL',role:m.role,location:'CLOUD',engine:'cloud',description:'OpenAI-compatible API',tasks:['ocr','vision','table','document','compare'] }));
  const models=[...local,...cloud];
  els.modelList.innerHTML=models.map(m=>{
    const sel=state.selected.has(m.id); const optional=m.optionalDownload&&!state.optionalPrepared.has(m.id);
    return `<button class="model-card ${sel?'selected':''}" data-model="${escapeAttr(m.id)}"><span class="model-code">${m.short}</span><span class="model-copy"><strong>${escapeHtml(m.label)}</strong><small>${escapeHtml(m.description)}${optional?' · 다운로드 필요':''}</small></span><span class="model-check">${sel?'✓':''}</span></button>`;
  }).join('');
  els.selectedCount.textContent=`${[...state.selected].filter(id=>models.some(m=>m.id===id)).length} selected`;
  els.modelSelectLabel.textContent=`${[...state.selected].filter(id=>models.some(m=>m.id===id)).length} pipelines`;
}

function updateTaskTabs(){$$('#taskTabs [data-task]').forEach(b=>b.classList.toggle('active',b.dataset.task===state.task));}

function updateUI(){
  if(state.file){els.fileCard.hidden=false;els.dropCard.hidden=true;els.sampleButton.hidden=true;els.fileName.textContent=state.file.name;els.fileInfo.textContent=`${formatBytes(state.file.size)} · ${state.fileType.toUpperCase()}`;els.fileType.textContent=state.fileType==='pdf'?'PDF':state.fileType==='video'?'VID':'IMG';els.sourceName.textContent=state.file.name;els.runButton.disabled=false;}
  else{els.fileCard.hidden=true;els.dropCard.hidden=false;els.sampleButton.hidden=false;els.sourceName.textContent='파일을 선택하세요';els.runButton.disabled=true;}
  updateTaskTabs();renderModels();updatePrivacy();updateCenterStatus();
}

function updatePrivacy(){const anyCloud=[...state.selected].some(id=>id.startsWith('cloud:'));if(anyCloud){els.privacyTitle.textContent='Cloud model selected';els.privacyText.textContent='Run 시 렌더링 이미지가 설정한 API로 전송됩니다.';}else{els.privacyTitle.textContent='Local only';els.privacyText.textContent='파일이 외부 서버로 전송되지 않습니다.';}}
function updateCenterStatus(){els.centerStatus.textContent=`Auto Router ${state.autoRouter?'ON':'OFF'} · Consensus ${state.consensus?'ON':'OFF'}`;}

async function runSelected(){
  if(!state.file)return; const definitions=getSelectedDefinitions(); if(!definitions.length){toast('실행할 파이프라인을 하나 이상 선택하세요.',true);return;}
  resetResults(); els.runButton.disabled=true; els.readyStatus.textContent='● Running'; els.readyStatus.classList.add('running');
  let canvases;
  try {
    if(state.fileType==='pdf') canvases=await renderPdfPages(state.pdf,Math.min(3,state.pdf.numPages),progress=>showProgress(progress.status,progress.progress));
    else canvases=[state.canvas];
    for(let i=0;i<definitions.length;i++){
      const def=definitions[i];
      showProgress(`${def.label} 실행`, i/definitions.length);
      const result={id:def.id,label:def.label,role:def.role,location:def.location,status:'running',text:'',latency:null,confidence:null,words:[]}; state.results.push(result); renderResults();
      try{
        let raw;
        if(def.engine==='tesseract') raw=await runTesseract(canvases,def.profile,p=>showProgress(`${def.label} · ${p.status}`, (i+(p.progress||0))/definitions.length));
        else if(def.engine==='transformers') raw=await runImageToText(canvases[0],def.model,p=>showProgress(`${def.label} · ${p.status}`, (i+(p.progress||0))/definitions.length));
        else raw=await runCloudModel({endpoint:state.cloudEndpoint,apiKey:state.apiKey,model:def.cloudId,task:state.task,canvases,onProgress:p=>showProgress(`${def.label} · ${p.status}`,(i+(p.progress||0))/definitions.length)});
        Object.assign(result,raw,{status:'done'}); result.text=postprocessForTask(raw.text,state.task,def);
      } catch(e){console.error(e);result.status='error';result.text=`ERROR\n${e.message}`;result.error=e.message;}
      renderResults();
    }
    const firstDone=state.results.find(r=>r.status==='done'); if(firstDone)showResult(firstDone.id); renderBoxes();
  } finally {hideProgress();els.runButton.disabled=false;els.readyStatus.classList.remove('running');els.readyStatus.textContent='⚡ Ready';renderResults();}
}

function postprocessForTask(text,task,def){
  if(task==='table' && def.engine==='tesseract') return rowsToMarkdown(extractTable(text));
  if(task==='document' && def.engine==='tesseract') return formatDocumentJson(text);
  return text;
}

function getSelectedDefinitions(){
  const local=LOCAL_PIPELINES.filter(m=>state.selected.has(m.id) && (m.tasks.includes(state.task)||state.task==='compare'));
  const cloud=state.cloudModels.filter(m=>m.selected&&state.selected.has(`cloud:${m.id}`)).map(m=>({id:`cloud:${m.id}`,label:m.label,role:m.role,location:'CLOUD',engine:'cloud',cloudId:m.id}));
  return [...local,...cloud];
}

function renderResults(){
  if(!state.results.length){els.outputEmpty.hidden=false;els.resultsView.hidden=true;return;}
  els.outputEmpty.hidden=true;els.resultsView.hidden=false;els.outputTitle.textContent=state.task==='compare'?'Compare results':`${state.task.toUpperCase()} results`;
  const done=state.results.filter(r=>r.status==='done'); const agreements=agreementScores(state.results); const best=agreements.slice().sort((a,b)=>b.score-a.score)[0]; const fast=done.slice().sort((a,b)=>a.latency-b.latency)[0];
  els.bestAgreement.textContent=best&&done.length>1?`${Math.round(best.score*100)}%`:'—';els.fastestModel.textContent=fast?.label||'—';els.completedCount.textContent=`${done.length}/${state.results.length}`;
  els.resultRows.innerHTML=state.results.map(r=>{const ag=agreements.find(a=>a.id===r.id);const signal=Number.isFinite(r.confidence)?`${Math.round(r.confidence)} conf.`:ag&&done.length>1?`${Math.round(ag.score*100)}% overlap`:'—';return `<tr data-result="${escapeAttr(r.id)}" class="${state.activeResult===r.id?'active':''}"><td><strong>${escapeHtml(r.label)}</strong><small>${escapeHtml(r.error||'')}</small></td><td>${r.role}</td><td>${signal}</td><td>${formatDuration(r.latency)}</td><td>${r.location}</td><td><span class="status-cell ${r.status}">${r.status==='done'?'■':r.status==='error'?'!':'…'}</span></td></tr>`}).join('');
  els.detailTabs.innerHTML=done.map(r=>`<button data-result="${escapeAttr(r.id)}" class="${state.activeResult===r.id?'active':''}">${escapeHtml(r.label)}</button>`).join('');
  renderConsensus();
}

function showResult(id){const r=state.results.find(x=>x.id===id);if(!r)return;state.activeResult=id;els.detailTitle.textContent=r.label;els.detailMeta.textContent=`${r.location} · ${r.role} · ${formatDuration(r.latency)}${Number.isFinite(r.confidence)?` · Tesseract confidence ${r.confidence.toFixed(1)}`:''}`;els.detailText.textContent=r.text||'(empty)';renderResults();renderBoxes();}

function renderConsensus(){
  els.consensusBox.hidden=!state.consensus; if(!state.consensus)return; const diff=diffSummary(state.results); if(state.results.filter(r=>r.status==='done').length<2){els.consensusContent.innerHTML='<p class="muted">완료된 결과가 2개 이상이면 공통/고유 토큰을 계산합니다.</p>';return;}
  els.consensusContent.innerHTML=`<div class="common-tokens"><strong>공통 토큰</strong><div>${diff.common.map(t=>`<span>${escapeHtml(t)}</span>`).join('')||'<em>공통 토큰 없음</em>'}</div></div>${diff.unique.map(u=>`<div class="unique-row"><strong>${escapeHtml(u.label)}</strong><div>${u.tokens.map(t=>`<span>${escapeHtml(t)}</span>`).join('')||'<em>고유 토큰 없음</em>'}</div></div>`).join('')}`;
}

function renderBoxes(){
  const overlay=$('[data-overlay]');if(!overlay)return;overlay.innerHTML='';overlay.style.display=state.showBoxes?'block':'none';if(!state.showBoxes)return; const r=state.results.find(x=>x.id===state.activeResult)||state.results.find(x=>x.words?.length);if(!r?.words?.length)return; const words=r.words.filter(w=>(w.page||1)===state.pdfPage).slice(0,400);for(const w of words){if(!w.bbox)continue;const rect=document.createElementNS('http://www.w3.org/2000/svg','rect');const {x0,y0,x1,y1}=w.bbox;rect.setAttribute('x',x0);rect.setAttribute('y',y0);rect.setAttribute('width',Math.max(1,x1-x0));rect.setAttribute('height',Math.max(1,y1-y0));rect.setAttribute('class','bbox');overlay.append(rect);}}

function setZoom(v){state.zoom=Math.min(2.2,Math.max(.45,v));els.previewTransform.style.transform=`scale(${state.zoom})`;els.zoomLabel.textContent=`${Math.round(state.zoom*100)}%`;}

function renderCloudModels(){els.cloudModelGrid.innerHTML=state.cloudModels.map((m,i)=>`<label class="cloud-check"><input type="checkbox" data-cloud-index="${i}" ${m.selected?'checked':''}/><span><strong>${escapeHtml(m.label)}</strong><small>${escapeHtml(m.id)} · ${m.role}</small></span></label>`).join('');els.cloudModelGrid.addEventListener('change',e=>{const idx=Number(e.target.dataset.cloudIndex);if(Number.isInteger(idx))state.cloudModels[idx].selected=e.target.checked;});}

async function testConnection(){els.connectionStatus.textContent='확인 중…';try{const count=await testCloudConnection(els.endpointInput.value.trim(),els.apiKeyInput.value);els.connectionStatus.textContent=`연결됨${Number.isFinite(count)?` · ${count} models`:''}`;}catch(e){els.connectionStatus.textContent=`실패: ${e.message}`;}}
function saveSettings(){state.cloudEndpoint=els.endpointInput.value.trim();state.apiKey=els.apiKeyInput.value;state.cloudEnabled=state.cloudModels.some(m=>m.selected);state.cloudModels.forEach(m=>{const id=`cloud:${m.id}`;if(m.selected)state.selected.add(id);else state.selected.delete(id);});els.modeBadge.textContent=state.cloudEnabled?'LOCAL + CLOUD':'LOCAL';els.modeBadge.className=`mode-badge ${state.cloudEnabled?'hybrid':'local'}`;renderModels();updatePrivacy();toast(state.cloudEnabled?'Cloud AI가 선택되었습니다. Run 시 선택 모델에만 파일이 전송됩니다.':'Local-only 모드입니다.');}

async function prepareLocalModel(id,button){const def=LOCAL_PIPELINES.find(m=>m.id===id);if(!def)return;button.disabled=true;const old=button.textContent;button.textContent='준비 중…';showProgress(`${def.label} 모델 준비`,.02);try{await prepareTransformersModel(def.model,p=>showProgress(`${def.label} · ${p.status}`,p.progress));state.optionalPrepared.add(id);button.textContent='준비 완료';state.selected.add(id);renderModels();toast(`${def.label} 준비 완료`);}catch(e){console.error(e);button.textContent='다시 시도';button.disabled=false;toast(`모델 준비 실패: ${e.message}`,true);}finally{hideProgress();if(state.optionalPrepared.has(id))button.disabled=true;else button.textContent=old;}}

function resetResults(){state.results=[];state.activeResult=null;els.outputEmpty.hidden=false;els.resultsView.hidden=true;els.outputTitle.textContent='Ready for a real run';renderBoxes();}
function showProgress(title,p=0){els.progressOverlay.hidden=false;els.progressTitle.textContent=title;const pct=Math.round(Math.max(0,Math.min(1,Number.isFinite(p)?p:0))*100);els.progressText.textContent=`${pct}%`;els.progressBar.style.width=`${pct}%`;els.engineStatus.textContent=title;}
function hideProgress(){els.progressOverlay.hidden=true;els.engineStatus.textContent='Local core ready · No API required';}
function toast(msg,error=false){els.toast.textContent=msg;els.toast.classList.toggle('error',error);els.toast.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>els.toast.hidden=true,3600);}
function applyTheme(theme){document.documentElement.dataset.theme=theme;localStorage.setItem('visiondeck-theme',theme);els.themeButton.textContent=theme==='dark'?'☼':'☾';}

async function copyCurrent(){const r=state.results.find(x=>x.id===state.activeResult);if(!r)return;await navigator.clipboard.writeText(r.text);toast('결과를 복사했습니다.');}
function exportCurrent(kind){const r=state.results.find(x=>x.id===state.activeResult);if(!r)return;const base=safeBaseName(state.file?.name);if(kind==='json')downloadText(`${base}-${r.id}.json`,JSON.stringify({file:state.file?.name,task:state.task,model:r.label,location:r.location,latency_ms:r.latency,tesseract_confidence:r.confidence,text:r.text},null,2),'application/json');else downloadText(`${base}-${r.id}.txt`,r.text);}
function formatBytes(n){if(n<1024)return`${n} B`;if(n<1024**2)return`${(n/1024).toFixed(1)} KB`;return`${(n/1024**2).toFixed(1)} MB`;}
function escapeHtml(s=''){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function escapeAttr(s=''){return escapeHtml(s);}
