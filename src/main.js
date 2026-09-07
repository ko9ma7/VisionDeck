const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

const models = [
  { id:'glm', name:'GLM-OCR', meta:'OCR · 한글/숫자 강점', kind:'OCR', score:96, time:2.1, cost:0.002 },
  { id:'deepseek', name:'DeepSeek OCR 2', meta:'OCR · 빠른 처리', kind:'OCR', score:93, time:1.2, cost:0.001 },
  { id:'dots', name:'dots.mocr', meta:'Document · 구조 인식', kind:'DOC', score:91, time:1.8, cost:0.001 },
  { id:'qwen', name:'Qwen 3.5', meta:'Vision · 이미지 이해', kind:'VLM', score:89, time:1.5, cost:0.001 }
];

const taskLabels = {ocr:'텍스트 읽기',table:'표 추출',document:'정보 추출',vision:'이미지 이해'};
const taskDescriptions = {
  ocr:'OCR 모델 {n}개를 같은 파일로 비교합니다.',
  table:'표 인식에 강한 모델 {n}개를 비교합니다.',
  document:'문서 정보를 구조화하는 모델 {n}개를 비교합니다.',
  vision:'이미지를 설명하는 Vision 모델 {n}개를 비교합니다.'
};

const demoResults = {
  glm:`# 영수증\n\n상호: VISION CAFE 강남점\n사업자번호: 120-88-02104\n날짜: 2026-09-06 18:42\n\n| 품목 | 수량 | 금액 |\n| --- | ---: | ---: |\n| 아메리카노 | 2 | 9,000원 |\n| 치즈케이크 | 1 | 6,500원 |\n\n합계: 15,500원\n부가세: 1,409원\n결제수단: 신용카드`,
  deepseek:`VISION CAFE 강남점\n사업자 번호 120-88-02104\n일시 2026-09-06 18:42\n\n아메리카노 x 2 — 9,000원\n치즈케이크 x 1 — 6,500원\n\n결제금액 15,500원\nVAT 1,409원\n신용카드`,
  dots:`{\n  "merchant": "VISION CAFE 강남점",\n  "business_no": "120-88-02104",\n  "date": "2026-09-06 18:42",\n  "items": [\n    {"name":"아메리카노","qty":2,"amount":9000},\n    {"name":"치즈케이크","qty":1,"amount":6500}\n  ],\n  "total": 15500,\n  "vat": 1409,\n  "payment": "신용카드"\n}`,
  qwen:`이 이미지는 카페 영수증입니다. 상호는 VISION CAFE 강남점이며, 아메리카노 2잔과 치즈케이크 1개를 구매했습니다. 총 결제금액은 15,500원입니다.`
};

let state = {
  file:null, sample:false, task:'ocr', selected:['glm','deepseek','dots'], zoom:1, showBoxes:true,
  results:null, activeResult:'glm', mode:'demo', apiKey:'', endpoint:'https://gateway.vlm.run/v1/openai'
};

function init(){
  const savedTheme = localStorage.getItem('visiondeck-theme') || 'light';
  document.documentElement.dataset.theme = savedTheme;
  renderModels();
  bindEvents();
  updateRunSummary();
}

function bindEvents(){
  $('#fileInput').addEventListener('change', e => e.target.files[0] && loadFile(e.target.files[0]));
  $('#sampleButton').addEventListener('click', loadSample);
  ['dragenter','dragover'].forEach(ev => $('#dropzone').addEventListener(ev,e=>{e.preventDefault();$('#dropzone').classList.add('is-dragover')}));
  ['dragleave','drop'].forEach(ev => $('#dropzone').addEventListener(ev,e=>{e.preventDefault();$('#dropzone').classList.remove('is-dragover')}));
  $('#dropzone').addEventListener('drop', e=> e.dataTransfer.files[0] && loadFile(e.dataTransfer.files[0]));
  $('#resetButton').addEventListener('click', resetAll);
  $('#zoomIn').addEventListener('click',()=>setZoom(Math.min(1.6,state.zoom+.1)));
  $('#zoomOut').addEventListener('click',()=>setZoom(Math.max(.6,state.zoom-.1)));
  $('#boxToggle').addEventListener('click',()=>{state.showBoxes=!state.showBoxes;$('#boxToggle').classList.toggle('is-active',state.showBoxes);$('.sample-preview')?.classList.toggle('hide-boxes',!state.showBoxes)});
  $('#taskGrid').addEventListener('click',e=>{const b=e.target.closest('.task-card');if(!b)return;state.task=b.dataset.task;$$('.task-card').forEach(x=>x.classList.toggle('is-selected',x===b));updateRunSummary();markStep(2)});
  $('#runButton').addEventListener('click',runComparison);
  $('#rerunButton').addEventListener('click',runComparison);
  $('#chooseWinnerButton').addEventListener('click',()=>toast(`${models.find(m=>m.id===state.activeResult)?.name || '추천'} 결과를 선택했습니다.`));
  $('#resultTabs').addEventListener('click',e=>{const b=e.target.closest('.result-tab');if(!b)return;state.activeResult=b.dataset.model;renderActiveResult()});
  $('#copyButton').addEventListener('click',async()=>{await navigator.clipboard.writeText($('#resultText').textContent);toast('결과를 클립보드에 복사했습니다.')});
  $('#exportJson').addEventListener('click',()=>download('visiondeck-result.json',JSON.stringify(buildExport(),null,2),'application/json'));
  $('#exportCsv').addEventListener('click',()=>download('visiondeck-result.csv',buildCsv(),'text/csv;charset=utf-8'));
  $('#themeButton').addEventListener('click',toggleTheme);
  $('#settingsButton').addEventListener('click',()=>$('#settingsDialog').showModal());
  $('#guideButton').addEventListener('click',()=>$('#guideDialog').showModal());
  $('#settingsForm').addEventListener('submit',e=>{e.preventDefault();applySettings();$('#settingsDialog').close()});
}

function loadSample(){
  state.sample=true;state.file=null;state.task='ocr';state.selected=['glm','deepseek','dots'];
  showLoadedFile('한국어_영수증_샘플.svg','Sample · receipt','SVG');
  renderSamplePreview();
  revealControls('영수증으로 감지됨');
}

function loadFile(file){
  state.file=file;state.sample=false;
  const type = detectType(file);
  const route = routeFor(file,type);
  state.task=route.task;state.selected=route.models;
  showLoadedFile(file.name, `${formatBytes(file.size)} · ${type.label}`, type.badge);
  renderFilePreview(file,type);
  revealControls(route.label);
}

function detectType(file){
  if(file.type.startsWith('image/')) return {kind:'image',label:'Image',badge:'IMG'};
  if(file.type==='application/pdf'||file.name.toLowerCase().endsWith('.pdf')) return {kind:'pdf',label:'PDF',badge:'PDF'};
  if(file.type.startsWith('video/')) return {kind:'video',label:'Video',badge:'VID'};
  return {kind:'other',label:'Document',badge:'DOC'};
}

function routeFor(file,type){
  const n=file.name.toLowerCase();
  if(/screenshot|스크린|capture|ui/.test(n)) return {task:'vision',models:['qwen','glm','deepseek'],label:'Screenshot → Vision 추천'};
  if(/table|표|invoice|receipt|영수증|세금/.test(n)) return {task:'ocr',models:['glm','deepseek','dots'],label:'문서/영수증 → OCR 추천'};
  if(type.kind==='image') return {task:'vision',models:['qwen','glm','deepseek'],label:'일반 이미지 → Vision 추천'};
  return {task:'document',models:['dots','glm','deepseek'],label:'문서 → 정보 추출 추천'};
}

function showLoadedFile(name,info,badge){
  $('#dropzone').hidden=true;$('#sampleButton').hidden=true;$('#fileMeta').hidden=false;$('#resetButton').hidden=false;
  $('#fileName').textContent=name;$('#fileInfo').textContent=info;$('#fileTypeIcon').textContent=badge;
  $('#previewEmpty').hidden=true;$('#previewCanvas').hidden=false;$('#controlEmpty').hidden=true;$('#controlContent').hidden=false;
  markStep(1,true);markStep(2);
}

function revealControls(label){
  $('#autoLabel').textContent=label;
  $$('.task-card').forEach(b=>b.classList.toggle('is-selected',b.dataset.task===state.task));
  $$('.recommend-tag').forEach(t=>t.remove());
  const selectedTask=$(`.task-card[data-task="${state.task}"]`);
  const tag=document.createElement('span');tag.className='recommend-tag';tag.textContent='추천';selectedTask.appendChild(tag);
  renderModels();updateRunSummary();
}

function renderSamplePreview(){
  $('#previewTransform').innerHTML=`<div class="sample-preview"><img src="./sample-receipt.svg" alt="VisionDeck 샘플 영수증" /></div>`;
}

function renderFilePreview(file,type){
  const url=URL.createObjectURL(file);const box=$('#previewTransform');
  if(type.kind==='image') box.innerHTML=`<img src="${url}" alt="업로드한 이미지 미리보기" />`;
  else if(type.kind==='pdf') box.innerHTML=`<object data="${url}" type="application/pdf" aria-label="업로드한 PDF 미리보기"><p>이 브라우저에서는 PDF 미리보기를 지원하지 않습니다.</p></object>`;
  else if(type.kind==='video') box.innerHTML=`<video src="${url}" controls></video>`;
  else box.innerHTML=`<div style="padding:60px;background:var(--surface);border:1px solid var(--line);border-radius:12px;text-align:center">미리보기를 지원하지 않는 파일입니다.</div>`;
}

function renderModels(){
  $('#modelList').innerHTML=models.map(m=>`<button class="model-row ${state.selected.includes(m.id)?'is-selected':''}" data-model="${m.id}" aria-pressed="${state.selected.includes(m.id)}"><span class="model-check">${state.selected.includes(m.id)?'✓':''}</span><span><strong>${m.name}</strong><small>${m.meta}</small></span><span class="model-kind">${m.kind}</span></button>`).join('');
  $$('.model-row').forEach(row=>row.addEventListener('click',()=>toggleModel(row.dataset.model)));
  $('#modelCount').textContent=`${state.selected.length}개 선택`;
}

function toggleModel(id){
  if(state.selected.includes(id)){if(state.selected.length===1){toast('비교하려면 최소 1개 모델이 필요합니다.');return}state.selected=state.selected.filter(x=>x!==id)}else{if(state.selected.length===4){toast('최대 4개 모델까지 비교할 수 있습니다.');return}state.selected.push(id)}
  renderModels();updateRunSummary();
}

function updateRunSummary(){
  const n=state.selected.length;$('#runSummaryTitle').textContent=taskDescriptions[state.task].replace('{n}',n);$('#runButtonText').textContent=`${n}개 모델로 비교 시작`;
}

async function runComparison(){
  if(!state.sample&&!state.file){toast('먼저 파일을 넣어주세요.');return}
  const btn=$('#runButton');btn.disabled=true;$('#runButtonText').textContent='비교 중…';markStep(3);
  await new Promise(r=>setTimeout(r,780));
  if(state.mode==='live'&&state.file?.type.startsWith('image/')){
    try{state.results=await runLiveImage()}catch(err){toast(`Live 요청 실패: ${err.message}`);state.results=buildDemoResults()}
  }else state.results=buildDemoResults();
  renderResults();btn.disabled=false;updateRunSummary();markStep(3,true);markStep(4);$('#resultsSection').hidden=false;$('#resultsSection').scrollIntoView({behavior:'smooth',block:'start'});
}

function buildDemoResults(){return state.selected.map(id=>{const m=models.find(x=>x.id===id);return {...m,text:demoResults[id]}})}

async function runLiveImage(){
  const dataUrl=await fileToDataUrl(state.file);const prompt=state.task==='vision'?'Describe this image in Korean with useful detail.':'Read this document image. Preserve Korean text, numbers, tables, and structure.';
  const outputs=[];
  for(const id of state.selected){const m=models.find(x=>x.id===id);const t0=performance.now();const res=await fetch(`${state.endpoint.replace(/\/$/,'')}/chat/completions`,{method:'POST',headers:{'Content-Type':'application/json',...(state.apiKey?{'Authorization':`Bearer ${state.apiKey}`}:{})},body:JSON.stringify({model:modelApiName(id),messages:[{role:'user',content:[{type:'text',text:prompt},{type:'image_url',image_url:{url:dataUrl}}]}]})});if(!res.ok)throw new Error(`${res.status} ${res.statusText}`);const json=await res.json();outputs.push({...m,score:null,time:+((performance.now()-t0)/1000).toFixed(2),cost:null,text:json.choices?.[0]?.message?.content||JSON.stringify(json,null,2)})}
  return outputs;
}
function modelApiName(id){return {glm:'glm-ocr',deepseek:'deepseek-ocr-2',dots:'dots.mocr',qwen:'qwen3.5-0.8b'}[id]}

function renderResults(){
  const sorted=[...state.results].sort((a,b)=>(b.score??0)-(a.score??0));const winner=sorted[0];state.activeResult=winner.id;
  $('#winnerModel').textContent=winner.name;$('#winnerReason').textContent=winner.score!=null?'샘플 기준 정답과 가장 많이 일치했고 한글·숫자·구조를 안정적으로 읽었습니다.':'Live 결과에서는 정답 데이터가 없어 정확도 대신 결과를 직접 비교해 선택합니다.';
  $('#scoreCards').innerHTML=state.results.map((r,i)=>`<article class="score-card ${r.id===winner.id?'is-best':''}"><header><strong>${r.name}</strong>${r.id===winner.id?'<span class="best-pill">추천</span>':''}</header><div class="metrics"><div><span>${r.score!=null?'정확도*':'결과'}</span><b>${r.score!=null?r.score+'%':'완료'}</b></div><div><span>처리시간</span><b>${r.time}s</b></div><div><span>비용</span><b>${r.cost!=null?'$'+r.cost.toFixed(3):'—'}</b></div></div></article>`).join('');
  $('#resultTabs').innerHTML=state.results.map(r=>`<button class="result-tab ${r.id===state.activeResult?'is-active':''}" data-model="${r.id}">${r.name}</button>`).join('');
  $('#consensusDiff').innerHTML=`<div class="diff-row"><span>모든 모델 일치</span><strong>합계 15,500원</strong></div><div class="diff-row"><span>표현 차이</span><b>“부가세” ↔ “VAT”</b></div><div class="diff-row"><span>검토 권장</span><b>사업자번호 표기 형식</b></div>`;
  renderActiveResult();
}

function renderActiveResult(){const r=state.results.find(x=>x.id===state.activeResult);if(!r)return;$$('.result-tab').forEach(b=>b.classList.toggle('is-active',b.dataset.model===r.id));$('#resultModelName').textContent=r.name;$('#resultModelMeta').textContent=r.score!=null?`샘플 정확도 ${r.score}% · ${r.time}s`:`Live result · ${r.time}s`;$('#resultText').textContent=r.text}

function buildExport(){const r=state.results?.find(x=>x.id===state.activeResult);return {service:'VisionDeck',task:state.task,file:state.sample?'sample-receipt.svg':state.file?.name,selected_model:r?.name,output:r?.text,comparison:state.results?.map(x=>({model:x.name,score:x.score,time:x.time,cost:x.cost}))}}
function buildCsv(){const rows=[['model','score','time_sec','cost_usd'],...(state.results||[]).map(r=>[r.name,r.score??'',r.time,r.cost??''])];return '\uFEFF'+rows.map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(',')).join('\n')}
function download(name,data,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([data],{type}));a.download=name;a.click();URL.revokeObjectURL(a.href);toast(`${name} 파일을 만들었습니다.`)}
function setZoom(v){state.zoom=+v.toFixed(1);$('#previewTransform').style.transform=`scale(${state.zoom})`;$('#zoomLabel').textContent=`${Math.round(state.zoom*100)}%`}
function resetAll(){state.file=null;state.sample=false;state.results=null;state.zoom=1;$('#dropzone').hidden=false;$('#sampleButton').hidden=false;$('#fileMeta').hidden=true;$('#resetButton').hidden=true;$('#previewEmpty').hidden=false;$('#previewCanvas').hidden=true;$('#controlEmpty').hidden=false;$('#controlContent').hidden=true;$('#resultsSection').hidden=true;$('#previewTransform').innerHTML='';setZoom(1);markStep(1);$$('.stepper li').slice(1).forEach(li=>li.classList.remove('is-active','is-done'));window.scrollTo({top:0,behavior:'smooth'})}
function markStep(n,done=false){const li=$(`.stepper li[data-step="${n}"]`);if(!li)return;li.classList.add(done?'is-done':'is-active');if(done)li.classList.remove('is-active')}
function toggleTheme(){const t=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=t;localStorage.setItem('visiondeck-theme',t)}
function applySettings(){const mode=$('input[name="runMode"]:checked').value;state.mode=mode;state.endpoint=$('#endpointInput').value.trim()||state.endpoint;state.apiKey=$('#apiKeyInput').value;$('#modeChip').innerHTML=`<span></span> ${mode==='live'?'Live Gateway':'Demo mode'}`;$('#settingsButton').innerHTML=`<span class="status-dot"></span> ${mode==='live'?'Live 연결됨':'실제 AI 연결'}`;toast(mode==='live'?'Live Gateway 모드를 사용합니다.':'Demo 모드를 사용합니다.')}
function toast(msg){const t=$('#toast');t.textContent=msg;t.hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.hidden=true,2500)}
function formatBytes(n){if(n<1024)return `${n} B`;if(n<1024*1024)return `${(n/1024).toFixed(0)} KB`;return `${(n/1024/1024).toFixed(1)} MB`}
function fileToDataUrl(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file)})}

init();
