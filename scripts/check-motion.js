// Loads each SVG as an <img> (GitHub's CSP applied) and pixel-diffs frames over time
// to confirm motion plays, then repeats with prefers-reduced-motion: reduce.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const A = path.join(__dirname, '..', 'assets');
const OUT = process.argv[2] || 'shots';
const srv = http.createServer((q, r) => {
  const f = decodeURIComponent(q.url.slice(1));
  if (f.endsWith('.svg')) {
    r.setHeader('Content-Type', 'image/svg+xml');
    r.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
    return r.end(fs.readFileSync(path.join(A, f)));
  }
  r.setHeader('Content-Type', 'text/html');
  r.end(`<body style="margin:0;background:#000"><img src="/${f.replace('page/', '')}.svg" style="width:880px;display:block">`);
}).listen(8767);
(async () => {
  for (const reduced of [false, true]) {
    // emulation does not reach SVG-as-image documents; the browser switch does
    const b = await chromium.launch({ args: reduced ? ['--force-prefers-reduced-motion'] : [] });
    const ctx = await b.newContext({ viewport: { width: 880, height: 1400 } });
    for (const f of fs.readdirSync(A).filter((x) => !x.includes('-mobile'))) {
      const p = await ctx.newPage();
      await p.goto(`http://localhost:8767/page/${f.replace('.svg', '')}`);
      const shots = [];
      for (const wait of [150, 1450, 1600, 2000]) {
        await p.waitForTimeout(wait);
        shots.push(await p.locator('img').screenshot());
      }
      if (reduced) fs.writeFileSync(path.join(OUT, `reduced-${f.replace('.svg', '.png')}`), shots[3]);
      const diffs = shots.slice(1).map((s, i) => (Buffer.compare(s, shots[i]) === 0 ? 'same' : 'moved'));
      console.log(reduced ? 'reduced' : 'motion ', f.padEnd(14), diffs.join(' '));
      await p.close();
    }
    await ctx.close();
    await b.close();
  }
  srv.close();
})();
