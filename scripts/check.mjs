import fs from 'node:fs';
const req=['index.html','src/main.js','src/styles.css','public/favicon.svg','public/sample-receipt.svg','public/manifest.webmanifest','.github/workflows/deploy.yml'];
for(const p of req){if(!fs.existsSync(new URL(`../${p}`,import.meta.url)))throw new Error(`Missing ${p}`)}
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
for(const s of ['<title>','og:title','manifest.webmanifest','src/main.js'])if(!html.includes(s))throw new Error(`index.html missing ${s}`);
console.log('VisionDeck check: OK');
