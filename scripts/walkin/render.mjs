// Usage (from scripts/walkin): npm i && npm run fonts, then:
// node render.mjs stills 0,3,6,9,12 [w h]   -> out/still_<t>.png
// node render.mjs frames 30 [w h] [from to] -> out/frames/f_00000.png ...
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const root = path.dirname(new URL(import.meta.url).pathname);
const types = { '.js': 'text/javascript', '.html': 'text/html', '.ttf': 'font/ttf', '.mjs': 'text/javascript' };
const server = http.createServer((req, res) => {
  const f = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); res.end(d); });
}).listen(0);
const port = server.address().port;

const [mode, arg, w = '1920', h = '1080', from, to] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
page.on('console', (m) => console.log('[page]', m.text()));
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`http://localhost:${port}/index.html?w=${w}&h=${h}`);
await page.waitForFunction(() => window.ready === true, null, { timeout: 300000 });
page.setDefaultTimeout(300000);
fs.mkdirSync(path.join(root, 'out/frames'), { recursive: true });

const shot = async (t, file) => {
  const t0 = Date.now();
  await page.evaluate((t) => window.renderAt(t), t);
  await page.screenshot({ path: file, type: 'png', timeout: 300000 });
  return Date.now() - t0;
};
if (mode === 'stills') {
  for (const t of arg.split(',').map(Number)) console.log(t, await shot(t, path.join(root, `out/still_${t}.png`)), 'ms');
} else {
  const fps = +arg, total = 12 * fps;
  const a = from ? +from : 0, b = to ? +to : total;
  await page.evaluate(() => window.renderAt(0)); // warm up shaders
  for (let i = a; i < b; i++) {
    const file = path.join(root, `out/frames/f_${String(i).padStart(5, '0')}.png`);
    if (fs.existsSync(file)) continue; // resume
    const ms = await shot(i / fps, file);
    if (i % 10 === 0) console.log('frame', i, ms, 'ms');
  }
}
await browser.close(); server.close();
