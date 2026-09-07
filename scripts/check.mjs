import { access, readFile } from 'node:fs/promises';
const required = ['index.html','src/main.js','src/styles/global.css','public/favicon.svg','public/manifest.webmanifest','public/404.html','.github/workflows/deploy.yml','README.md'];
for (const file of required) await access(file);
const html = await readFile('index.html','utf8');
for (const token of ['<title>','og:title','twitter:card','manifest.webmanifest','src/main.js']) if (!html.includes(token)) throw new Error(`index.html missing ${token}`);
const js = await readFile('src/main.js','utf8');
for (const token of ['runComparison','autoRoute','consensusScores','runGatewayModel']) if (!js.includes(token)) throw new Error(`src/main.js missing ${token}`);
console.log('VisionDeck static checks passed.');
