import { cpSync, mkdirSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const root=resolve('.'),dist=resolve('dist');rmSync(dist,{recursive:true,force:true});mkdirSync(dist,{recursive:true});
for(const item of ['index.html','src','public','sw.js','404.html','robots.txt','README.md','LICENSE','.nojekyll'])cpSync(resolve(root,item),resolve(dist,item),{recursive:true});
const repo=process.env.GITHUB_REPOSITORY?.split('/')[1]||'';const user=process.env.GITHUB_REPOSITORY?.split('/')[0]||'';const site=repo&&user?`https://${user}.github.io/${repo}/`:'';
if(site){let html=readFileSync(resolve(dist,'index.html'),'utf8');html=html.replace('</head>',`  <link rel="canonical" href="${site}" />\n  <meta property="og:url" content="${site}" />\n</head>`);writeFileSync(resolve(dist,'index.html'),html);writeFileSync(resolve(dist,'sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${site}</loc></url></urlset>\n`);}
console.log('Built static site to dist/.');
