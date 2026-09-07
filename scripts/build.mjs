import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const out = path.join(root, 'dist');
const repository = process.env.GITHUB_REPOSITORY?.split('/')[1];
const owner = process.env.GITHUB_REPOSITORY_OWNER;
const siteUrl = process.env.VITE_SITE_URL || process.env.SITE_URL || (owner && repository ? `https://${owner}.github.io/${repository}/` : 'http://localhost:5173/');
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
let html = await readFile(path.join(root, 'index.html'), 'utf8');
html = html.replaceAll('__SITE_URL__', siteUrl);
await writeFile(path.join(out, 'index.html'), html);
await cp(path.join(root, 'src'), path.join(out, 'src'), { recursive: true });
await cp(path.join(root, 'public'), out, { recursive: true });
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${siteUrl}</loc></url></urlset>\n`;
await writeFile(path.join(out, 'sitemap.xml'), sitemap);
console.log(`Built VisionDeck -> ${out}`);
console.log(`Site URL: ${siteUrl}`);
