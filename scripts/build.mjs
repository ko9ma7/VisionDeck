import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(new URL('..',import.meta.url).pathname);
const out=path.join(root,'dist');
fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out,{recursive:true});
const repo=process.env.GITHUB_REPOSITORY?.split('/')[1];
const user=process.env.GITHUB_REPOSITORY_OWNER;
const site=(process.env.SITE_URL || (repo&&user?`https://${user}.github.io/${repo}/`:'http://localhost:5173/')).replace(/([^/])$/,'$1/');
for(const name of ['index.html','.nojekyll']){let s=fs.readFileSync(path.join(root,name),'utf8');s=s.replaceAll('__SITE_URL__',site);fs.writeFileSync(path.join(out,name),s)}
function copyDir(src,dst){fs.mkdirSync(dst,{recursive:true});for(const ent of fs.readdirSync(src,{withFileTypes:true})){const a=path.join(src,ent.name),b=path.join(dst,ent.name);ent.isDirectory()?copyDir(a,b):fs.copyFileSync(a,b)}}
copyDir(path.join(root,'src'),path.join(out,'src'));copyDir(path.join(root,'public'),out);
for(const f of ['robots.txt','sitemap.xml']){const p=path.join(out,f);fs.writeFileSync(p,fs.readFileSync(p,'utf8').replaceAll('__SITE_URL__',site))}
console.log(`Built VisionDeck → ${out}`);console.log(`SITE_URL=${site}`);
