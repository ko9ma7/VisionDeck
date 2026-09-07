import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
const root=fileURLToPath(new URL('../',import.meta.url)),failures=[];
const required=['index.html','404.html','favicon.svg','manifest.webmanifest','robots.txt','sitemap.xml','.nojekyll','assets/styles.css','assets/app.js','assets/templates.js','assets/audio.js','assets/director.js','.github/workflows/deploy.yml'];
for(const f of required)if(!fs.existsSync(path.join(root,f)))failures.push(`missing: ${f}`);
const read=f=>fs.readFileSync(path.join(root,f),'utf8'),html=read('index.html'),app=read('assets/app.js'),templates=read('assets/templates.js'),audio=read('assets/audio.js'),director=read('assets/director.js'),css=read('assets/styles.css'),workflow=read('.github/workflows/deploy.yml');
function syntax(file){const r=spawnSync(process.execPath,['--input-type=module','--check'],{input:read(file),encoding:'utf8'});if(r.status!==0)failures.push(`module syntax failed: ${file}\n${r.stderr.trim()}`)}
['assets/app.js','assets/templates.js','assets/audio.js','assets/director.js'].forEach(syntax);
const domFn=app.match(/const DOM_FUNCTION = `([\s\S]*?)`;/);if(!domFn)failures.push('DOM_FUNCTION not found');else if(Buffer.byteLength(domFn[1],'utf8')>1024)failures.push(`DOM_FUNCTION exceeds 1024 bytes: ${Buffer.byteLength(domFn[1],'utf8')}`);
const ids=[...html.matchAll(/id="([^"]+)"/g)].map(m=>m[1]),dups=[...new Set(ids.filter((id,i)=>ids.indexOf(id)!==i))];if(dups.length)failures.push(`duplicate ids: ${dups.join(', ')}`);
const idSet=new Set(ids),appIds=[...app.matchAll(/\$\('#([A-Za-z0-9_-]+)'\)/g)].map(m=>m[1]),missing=[...new Set(appIds.filter(id=>!idSet.has(id)))];if(missing.length)failures.push(`missing DOM ids: ${missing.join(', ')}`);
const tmod=await import(`${pathToFileURL(path.join(root,'assets/templates.js')).href}?v=${Date.now()}`);if(tmod.builtinTemplates.length<20)failures.push(`need >=20 templates, got ${tmod.builtinTemplates.length}`);
const checks=[
 ['AI story capture mode',html.includes('value="story" selected')&&app.includes("requestedMode === 'story' ? 'viewport' : requestedMode")],
 ['explicit URL order',app.includes('urls.length > 1 ? urls.slice(0, 8)')],
 ['scroll-aware geometry',app.includes('scrollY: Number(fn?.sy || 0)')&&director.includes('p.viewportTop')&&director.includes('d.scrollY')],
 ['same-document chapters',director.includes('exactTarget')&&director.includes('chapterLabel')&&director.includes('viewIntent')],
 ['chapter-first UI',app.includes('chapter-beats')&&css.includes('.chapter-beat')&&html.includes('AI 추천 스토리보드')],
 ['raw analysis collapsed',app.includes('raw-analysis')&&css.includes('.raw-analysis')],
 ['compact AI selection',director.includes('bestSurface')&&director.includes('bestAction')&&director.includes('nearestHeading')],
 ['impact grammar',app.includes("impact === 'chapter'")&&app.includes("impact === 'spotlight'")&&app.includes("impact === 'punch'")],
 ['impact page transition',app.includes("scene.transition === 'page-flow'")&&app.includes("ctx.fillStyle='#b8c9ff'")],
 ['source projected cursor',app.includes('projectSourcePointToFrame')&&app.includes('cursorStartX')],
 ['sound accents',audio.includes("['punch','chapter','spotlight']")&&audio.includes('addSceneAccents')],
 ['WebM continuous A/V',app.includes('createMediaStreamDestination')&&app.includes('canvas.captureStream(fps)')&&!app.includes('canvas.captureStream(0)')],
 ['visual path override',app.includes('commitPath')&&app.includes('scene.cameraKeyframes=[]')],
 ['Microlink + fallback',app.includes('fetchMicrolinkCapture')&&app.includes('fetchMshotsCapture')],
 ['responsive v9 UI',css.includes('.chapter-summary')&&css.includes('@media(max-width:820px)')],
 ['GitHub Pages workflow',workflow.includes('actions/deploy-pages@v4')&&workflow.includes('node scripts/verify.mjs')],
 ['v9 cache + storage',html.includes('v=9.0.0')&&app.includes("motionframe:v9:project")],
 ['boot watchdog',html.includes('__motionframeReady')&&app.includes('window.__motionframeReady = true')]
];for(const[n,ok]of checks)if(!ok)failures.push(`check failed: ${n}`);
const dmod=await import(`${pathToFileURL(path.join(root,'assets/director.js')).href}?v=${Date.now()}`);
const base='https://example.com/app/';const vw=1440,vh=1000;
const elements=[
 {id:'h1',tag:'h1',text:'Build product demos automatically',x:340,y:250,top:180,w:580,h:150},
 {id:'hero-ui',tag:'canvas',role:'surface',text:'Product preview',x:1030,y:360,top:140,w:650,h:520},
 {id:'start',tag:'a',text:'Start with URL',href:base+'#capture',x:220,y:650,top:620,w:180,h:48},
 {id:'capture-title',tag:'h2',text:'Capture and understand the page',x:520,y:1650,top:1600,w:760,h:90},
 {id:'urlbox',tag:'textarea',role:'surface',text:'Site URL',x:600,y:1950,top:1840,w:880,h:240},
 {id:'auto',tag:'button',text:'Auto Director',x:1140,y:1930,top:1890,w:220,h:50},
 {id:'to-templates',tag:'a',text:'Motion styles',href:base+'#templates',x:1120,y:50,top:50,w:110,h:36,inNav:true},
 {id:'templates-title',tag:'h2',text:'Choose a motion style',x:540,y:3200,top:3150,w:800,h:90},
 {id:'impact',tag:'h3',text:'Impact Product Flow',x:300,y:3500,top:3450,w:320,h:60},
 {id:'to-studio',tag:'a',text:'Editor',href:base+'#studio',x:1260,y:50,top:50,w:80,h:36,inNav:true},
 {id:'studio-title',tag:'h2',text:'Edit scenes, motion and sound',x:520,y:4800,top:4750,w:800,h:90},
 {id:'preview',tag:'canvas',role:'surface',text:'Live preview',x:720,y:5350,top:5050,w:850,h:520}
];
const defs=[['',0],['#capture',1450],['#templates',3000],['#studio',4650]];
const scenes=defs.map(([hash,scrollY],i)=>({id:`s${i}`,name:'Demo',sourceUrl:base+hash,sourceAnalysis:{url:base+hash,title:'Demo',captureMode:'viewport',documentWidth:1440,documentHeight:6200,viewportWidth:vw,viewportHeight:vh,scrollX:0,scrollY,elements}}));
const plan=dmod.createDirectorPlan(scenes,{scope:{pageLimit:5,elementLimit:6,grouping:'screen',roles:['headings','media','navigation','actions']}}),beats=dmod.buildBeatSpecs(plan),summary=dmod.planSummary(plan);
if(plan.pages.length!==4)failures.push(`expected 4 chapters, got ${plan.pages.length}`);
if(summary.beats<11||summary.beats>16)failures.push(`expected compact 11-16 beats, got ${summary.beats}`);
if(summary.navigations!==3)failures.push(`expected 3 linked chapter transitions, got ${summary.navigations}`);
if(summary.selected>14)failures.push(`too many AI-selected targets: ${summary.selected}`);
if(plan.pages[1].elements.find(e=>e.id==='h1')?.selected)failures.push('scroll-aware selection incorrectly chose offscreen root H1 for #capture');
if(!plan.pages[1].elements.find(e=>e.id==='capture-title')?.selected)failures.push('#capture title not selected');
if(!plan.pages[2].elements.find(e=>e.id==='templates-title')?.selected)failures.push('#templates title not selected');
if(!plan.pages[3].elements.find(e=>e.id==='studio-title')?.selected)failures.push('#studio title not selected');
for(const expected of ['Start with URL','Motion styles','Editor'])if(!plan.flow.some(s=>s.action==='navigate'&&s.label===expected))failures.push(`navigation beat missing: ${expected}`);
for(const expected of ['punch','spotlight','chapter','navigate','resolve'])if(!beats.some(b=>b.impact===expected))failures.push(`impact beat missing: ${expected}`);
if(/Lorem ipsum|TODO|FIXME/.test(html+app+templates+audio+director))failures.push('placeholder/TODO text found');
if(failures.length){console.error(failures.join('\n'));process.exit(1)}
console.log(`Verification passed: ${tmod.builtinTemplates.length} templates, ${Object.keys(tmod.motionPresets).length} motion presets, ${checks.length} v9 feature checks, ${required.length} required files, ${appIds.length} DOM references, ${summary.beats} expert-story beats.`);
