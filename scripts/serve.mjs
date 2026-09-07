import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const port = Number(process.env.PORT || 5173);
const mime = { '.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.json':'application/json','.webmanifest':'application/manifest+json','.txt':'text/plain; charset=utf-8','.pdf':'application/pdf' };
const server = http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, `http://${req.headers.host}`).pathname);
    let file = path.join(root, pathname === '/' ? 'index.html' : pathname.replace(/^\//,''));
    const info = await stat(file).catch(() => null);
    if (!info?.isFile()) file = path.join(root, 'public', pathname.replace(/^\//,''));
    let body = await readFile(file);
    if (path.basename(file) === 'index.html') body = Buffer.from(body.toString().replaceAll('__SITE_URL__', `http://localhost:${port}/`));
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control':'no-store' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type':'text/html; charset=utf-8' });
    res.end(await readFile(path.join(root,'public','404.html')));
  }
});
server.listen(port, '0.0.0.0', () => console.log(`VisionDeck dev server: http://localhost:${port}/`));
