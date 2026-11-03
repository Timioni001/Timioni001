// Local check: renders every SVG and an approximation of the GitHub README layout
// at 1280px and 390px, served with GitHub's raw-content CSP on the SVGs.
// Usage: node scripts/preview.js <outdir>
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..');
const OUT = process.argv[2] || 'shots';
fs.mkdirSync(OUT, { recursive: true });

const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8')
  // snake is produced by the Action on the output branch; use a local stand-in if present
  .replace('https://raw.githubusercontent.com/Timioni001/Timioni001/output/github-snake.svg', fs.existsSync(path.join(OUT, 'snake.svg')) ? '/shots/snake.svg' : 'about:blank');
const page = (w) => `<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width">
<style>body{margin:0;background:#0d1117;color:#e6edf3;font:14px -apple-system,Segoe UI,Helvetica,Arial,sans-serif}
.box{max-width:830px;margin:24px auto;padding:0 ${w < 600 ? 16 : 24}px}
p{margin:0 0 16px}img{max-width:100%;vertical-align:middle}a{color:#4493f8;text-decoration:none}</style>
<div class=box>${readme}</div>`;

const server = http.createServer((q, r) => {
  const u = decodeURIComponent(q.url.split('?')[0]);
  if (u === '/' || u.startsWith('/readme')) { r.setHeader('Content-Type', 'text/html'); return r.end(page(+(q.url.split('w=')[1] || 1280))); }
  if (u.startsWith('/single/')) {
    const f = u.slice(8);
    r.setHeader('Content-Type', 'text/html');
    return r.end(`<body style="margin:0;background:#0d1117"><img src="/assets/${f}" style="width:100%;display:block">`);
  }
  const p = u.startsWith('/shots/') ? path.join(OUT, u.slice(7)) : path.join(ROOT, u);
  if (!fs.existsSync(p)) { r.statusCode = 404; return r.end(); }
  r.setHeader('Content-Type', 'image/svg+xml');
  r.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
  r.end(fs.readFileSync(p));
}).listen(8766);

(async () => {
  const b = await chromium.launch();
  for (const [w, tag] of [[1280, 'desktop'], [390, 'mobile']]) {
    const ctx = await b.newContext({ viewport: { width: w, height: 900 }, deviceScaleFactor: 2 });
    const pg = await ctx.newPage();
    await pg.goto(`http://localhost:8766/readme?w=${w}`);
    // SVG-in-img animations only run while on screen: scroll through so every entrance plays
    const h = await pg.evaluate(() => document.body.scrollHeight);
    for (let y = 0; y < h; y += 400) { await pg.evaluate((yy) => window.scrollTo(0, yy), y); await pg.waitForTimeout(700); }
    await pg.evaluate(() => window.scrollTo(0, 0));
    await pg.waitForTimeout(2500);
    await pg.screenshot({ path: path.join(OUT, `readme-${tag}.png`), fullPage: true });
    for (const f of fs.readdirSync(path.join(ROOT, 'assets'))) {
      if (tag === 'desktop' && f.includes('-mobile')) continue;
      if (tag === 'mobile' && !f.includes('-mobile')) continue;
      const sp = await ctx.newPage();
      await sp.setViewportSize({ width: w === 1280 ? 880 : 358, height: 600 });
      await sp.goto(`http://localhost:8766/single/${f}`);
      await sp.waitForTimeout(2500);
      await sp.locator('img').screenshot({ path: path.join(OUT, f.replace('.svg', '.png')) });
      await sp.close();
    }
    await ctx.close();
  }
  await b.close();
  server.close();
})();
