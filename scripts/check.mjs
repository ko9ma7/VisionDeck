import { execFileSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
const files=[];function walk(dir){for(const n of readdirSync(dir)){const p=join(dir,n);if(statSync(p).isDirectory())walk(p);else if(/\.js$|\.mjs$/.test(p))files.push(p)}}walk('src');walk('scripts');
for(const f of files)execFileSync(process.execPath,['--check',f],{stdio:'inherit'});
console.log(`Checked ${files.length} JavaScript files.`);
