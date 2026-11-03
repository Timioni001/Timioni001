// Generates every SVG in /assets. Plain string templates, no design tool.
//   npm run build   (node scripts/build-assets.js && svgo)
// Display type is Anton (SIL OFL, scripts/fonts) converted to <path> at build time,
// because GitHub's image proxy blocks web fonts. Everything else uses system stacks.
// Project screenshots come from each project's own repo (see scripts/media/SOURCES.md)
// and are embedded as small WebP data URIs.
const fs = require('fs');
const path = require('path');
const opentype = require('opentype.js');

const OUT = path.join(__dirname, '..', 'assets');
const FONT = opentype.parse(fs.readFileSync(path.join(__dirname, 'fonts', 'Anton-Regular.ttf')).buffer);
const media = (n) => 'data:image/webp;base64,' + fs.readFileSync(path.join(__dirname, 'media', `${n}.webp`)).toString('base64');

// ---- Palette: one background, one ink, one muted gray, one accent ----
const C = { bg: '#0B0B0A', ink: '#F2EBDC', muted: '#8E897E', accent: '#D4A866' };
const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans',Helvetica,Arial,sans-serif";
const MONO = "ui-monospace,SFMono-Regular,'SF Mono',Menlo,Consolas,'Liberation Mono',monospace";
const EASE = 'cubic-bezier(.45,0,.55,1)'; // ease-in-out
const OUTEASE = 'cubic-bezier(.2,.7,.2,1)';
const R = 18; // panel corner radius

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const f1 = (n) => +n.toFixed(1);

// ---- Anton -> path ----
function glyphRun(text, size) {
  const sc = size / FONT.unitsPerEm;
  let x = 0;
  let prev = null;
  const glyphs = [];
  for (const ch of text) {
    const g = FONT.charToGlyph(ch);
    if (prev) x += FONT.getKerningValue(prev, g) * sc;
    glyphs.push({ ch, x, d: g.getPath(0, 0, size).toPathData(1), w: g.advanceWidth * sc });
    x += g.advanceWidth * sc;
    prev = g;
  }
  return { glyphs, width: x, cap: FONT.tables.os2.sCapHeight * sc };
}
// whole word as one path (glyph offsets baked into coordinates)
function display(text, size, x, y, fill = C.ink, attrs = '') {
  const run = glyphRun(text, size);
  const d = run.glyphs.map((g) => g.d.replace(/([MLQCZ])([^MLQCZ]*)/g, (m, cmd, args) => {
    if (cmd === 'Z') return 'Z';
    const nums = (args.match(/-?\d*\.?\d+/g) || []).map(Number);
    return cmd + nums.map((n, i) => f1(i % 2 === 0 ? n + g.x : n)).join(' ');
  })).join('');
  return `<path transform="translate(${f1(x)} ${f1(y)})" fill="${fill}" d="${d}" ${attrs}/>`;
}

const BASE_CSS = `
text{font-family:${SANS};fill:${C.ink}}
.m{font-family:${MONO}}
.mu{fill:${C.muted}}
.ac{fill:${C.accent}}
.lab{font-size:13px;font-weight:800;letter-spacing:.02em;fill:${C.ink}}
.cap{font-size:12px;font-weight:700;letter-spacing:.08em;fill:${C.muted}}
.in{animation:in .9s ${OUTEASE} both}
@keyframes in{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
.fade{animation:fade 1s ${OUTEASE} both}
@keyframes fade{from{opacity:0}to{opacity:1}}
.rise{animation:rise 1s ${OUTEASE} both}
@keyframes rise{from{transform:translateY(105%)}to{transform:none}}
.ring{transform-box:fill-box;transform-origin:center;animation:ring 6s ${EASE} infinite}
@keyframes ring{0%{opacity:.5;transform:scale(1)}55%,100%{opacity:0;transform:scale(2.8)}}
.breathe{animation:breathe 6s ${EASE} infinite}
@keyframes breathe{0%,100%{opacity:1}50%{opacity:.3}}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
`;

function svg(W, H, title, body, css = '') {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="t" fill="none">
<title id="t">${esc(title)}</title>
<style>${BASE_CSS}${css}</style>
<clipPath id="panel"><rect width="${W}" height="${H}" rx="${R}"/></clipPath>
<g clip-path="url(#panel)">
<rect width="${W}" height="${H}" fill="${C.bg}"/>
${body}
</g>
</svg>`;
}

const d = (s) => `style="animation-delay:${s.toFixed(2)}s"`;
const t = (x, y, s, attrs = '') => `<text x="${f1(x)}" y="${f1(y)}" ${attrs}>${esc(s)}</text>`;
const sansW = (s, size) => s.length * size * 0.56;
const hair = (x1, y1, x2, y2, o = 0.14) => `<line x1="${f1(x1)}" y1="${f1(y1)}" x2="${f1(x2)}" y2="${f1(y2)}" stroke="${C.ink}" stroke-opacity="${o}"/>`;

function wrap(text, maxChars) {
  const lines = [];
  let cur = '';
  for (const w of text.split(' ')) {
    if ((cur + ' ' + w).trim().length > maxChars) { lines.push(cur.trim()); cur = w; } else cur += ' ' + w;
  }
  if (cur.trim()) lines.push(cur.trim());
  return lines;
}

// Section header: tan number + Anton title that rises out of a clip, hairline after it
let clipN = 0;
function sectionHeader(x, W, num, title, mobile) {
  const size = mobile ? 40 : 52;
  const run = glyphRun(title, size);
  const base = 24 + run.cap;
  const id = `sh${clipN++}`;
  return `<g class="fade">${t(x, 32, num, 'class="cap ac"')}</g>
<clipPath id="${id}"><rect x="${x + 30}" y="18" width="${f1(run.width + 10)}" height="${f1(run.cap + 8)}"/></clipPath>
<g clip-path="url(#${id})"><g class="rise" ${d(0.05)}>${display(title, size, x + 30, base)}</g></g>
<g class="fade" ${d(0.3)}>${hair(x + 30 + run.width + 20, base - 6, W - x, base - 6)}</g>`;
}
const headerH = (mobile) => 24 + glyphRun('A', mobile ? 40 : 52).cap;

// status dot: live (accent, pulsing ring), active (ink, pulsing ring), early (hollow, breathing)
function statusDot(cx, cy, kind, color) {
  if (kind === 'early') return `<circle class="breathe" cx="${cx}" cy="${cy}" r="4" stroke="${color}" stroke-width="1.6"/>`;
  return `<circle class="ring" cx="${cx}" cy="${cy}" r="4" fill="${color}" opacity="0"/><circle cx="${cx}" cy="${cy}" r="4" fill="${color}"/>`;
}

function grainDefs() {
  return `<filter id="noise" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .9 0"/></filter>`;
}

// ============================ HERO ============================
function hero(mobile) {
  const W = mobile ? 400 : 880;
  const pad = mobile ? 20 : 40;
  const size = mobile ? 222 : 440;
  const run = glyphRun('TIMI', size);
  const nameX = (W - run.width) / 2;
  const nameTop = mobile ? 92 : 104;
  const baseY = nameTop + run.cap;
  const capY = baseY + (mobile ? 44 : 54);
  const termY = capY + (mobile ? 82 : 84);
  const H = termY + (mobile ? 34 : 42);

  const phrases = mobile
    ? ['streaming payroll on NEAR', 'watching Bayse markets', 'replaying bugs to prove them']
    : ['streaming payments and payroll on NEAR', 'watching Bayse prediction markets', 'replaying bugs until they prove themselves'];
  const fsz = mobile ? 13 : 15;
  const cw = fsz * 0.6;
  const prompt = '~/timi $';
  const textX = pad + prompt.length * cw + cw;

  let css = `
.drift1{animation:drift1 12s ${EASE} infinite alternate}
.drift2{animation:drift2 10s ${EASE} infinite alternate}
@keyframes drift1{from{transform:translate(0,0)}to{transform:translate(${mobile ? -80 : -220}px,40px)}}
@keyframes drift2{from{transform:translate(0,0)}to{transform:translate(${mobile ? 70 : 180}px,-30px)}}
.grain{animation:grain 8s ${EASE} infinite alternate}
@keyframes grain{from{transform:translate(0,0)}to{transform:translate(-30px,-18px)}}
.cur{animation:blink 1.2s ${EASE} infinite}
@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
.slash{animation:slash 8s ${EASE} infinite}
@keyframes slash{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
.nudge{animation:nudge 6s ${EASE} infinite}
@keyframes nudge{0%,60%,100%{transform:translateX(0)}30%{transform:translateX(10px)}}
@media (prefers-reduced-motion:reduce){.p1,.p2{display:none}}
`;
  let term = '';
  phrases.forEach((p, i) => {
    const n = p.length;
    const w = n * cw;
    css += `
.g${i}{animation:g${i} 12s linear ${i * 4}s infinite both}
@keyframes g${i}{0%{opacity:0}.5%{opacity:1}30%{opacity:1}33%{opacity:0}100%{opacity:0}}
.c${i}{transform-box:view-box;transform-origin:${f1(textX)}px 0;animation:c${i} 12s ${i * 4}s infinite both}
@keyframes c${i}{0%{transform:scaleX(0);animation-timing-function:steps(${n},end)}16%,100%{transform:scaleX(1)}}
.k${i}{animation:k${i} 12s ${i * 4}s infinite both}
@keyframes k${i}{0%{transform:translateX(-${f1(w)}px);animation-timing-function:steps(${n},end)}16%,100%{transform:translateX(0)}}`;
    term += `<clipPath id="cp${i}"><rect class="c${i}" x="${f1(textX)}" y="${termY - 18}" width="${f1(w + 2)}" height="26"/></clipPath>
<g class="g${i} p${i}">
  <text class="m" x="${f1(textX)}" y="${termY}" font-size="${fsz}" textLength="${f1(w)}" lengthAdjust="spacingAndGlyphs" clip-path="url(#cp${i})">${esc(p)}</text>
  <g class="k${i}"><rect class="cur" x="${f1(textX + w + 2)}" y="${termY - 13}" width="${f1(cw * 0.9)}" height="17" fill="${C.accent}"/></g>
</g>`;
  });

  // giant name: each letter rises out of a baseline clip (kinetic type)
  let name = `<clipPath id="nameclip"><rect x="0" y="${f1(nameTop - 10)}" width="${W}" height="${f1(run.cap + 12)}"/></clipPath><g clip-path="url(#nameclip)">`;
  run.glyphs.forEach((g, i) => {
    name += `<g class="rise" ${d(0.1 + i * 0.09)}><path transform="translate(${f1(nameX + g.x)} ${f1(baseY)})" fill="${C.ink}" d="${g.d}"/></g>`;
  });
  name += '</g>';

  const capSize = mobile ? 12 : 15;
  const arrowW = mobile ? 34 : 46;
  const body = `
<defs>
  <radialGradient id="ga"><stop offset="0" stop-color="${C.accent}" stop-opacity=".2"/><stop offset="1" stop-color="${C.accent}" stop-opacity="0"/></radialGradient>
  <radialGradient id="gb"><stop offset="0" stop-color="${C.accent}" stop-opacity=".1"/><stop offset="1" stop-color="${C.accent}" stop-opacity="0"/></radialGradient>
  ${grainDefs()}
</defs>
<circle class="drift1" cx="${W * 0.8}" cy="${f1(H * 0.3)}" r="${mobile ? 240 : 380}" fill="url(#ga)"/>
<circle class="drift2" cx="${W * 0.15}" cy="${f1(H * 0.9)}" r="${mobile ? 200 : 320}" fill="url(#gb)"/>
<rect class="grain" x="-40" y="-40" width="${W + 80}" height="${f1(H + 80)}" filter="url(#noise)" opacity=".05"/>
<g class="fade">
  ${t(pad, 42, 'TIMI', 'class="lab"')}
  ${t(pad, 57, 'ONCHAIN', 'class="lab"')}
  <g class="slash"><path d="M${W - pad - 18} 54l6 -14M${W - pad - 8} 54l6 -14" stroke="${C.accent}" stroke-width="2.4" stroke-linecap="round"/></g>
</g>
${name}
<g class="in" ${d(0.55)}>
  ${t(W / 2, capY, 'DEVELOPER · ONCHAIN BUILDER', `font-size="${capSize}" font-weight="800" letter-spacing=".04em" text-anchor="middle" class="ac"`)}
  ${t(W / 2, capY + capSize + 8, 'PAYMENTS · DEFI · SECURITY · BOTS', `font-size="${capSize}" font-weight="800" letter-spacing=".04em" text-anchor="middle" class="ac"`)}
</g>
<g class="fade" ${d(0.8)}>
  ${hair(pad, termY - 34, W - pad, termY - 34)}
  ${t(pad, termY, prompt, `class="m ac" font-size="${fsz}" textLength="${f1(prompt.length * cw)}" lengthAdjust="spacingAndGlyphs"`)}
  <g class="nudge"><path d="M${W - pad - arrowW} ${f1(termY - 5)}h${arrowW}m-9 -7l9 7l-9 7" stroke="${C.ink}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></g>
</g>
${term}
`;
  return svg(W, Math.round(H), 'TIMI. Developer, onchain builder. Payments, DeFi, security, bots.', body, css);
}

// ============================ ABOUT ============================
function about(mobile) {
  const W = mobile ? 400 : 880;
  const pad = mobile ? 20 : 40;
  const colX = mobile ? pad : 250;
  const size = mobile ? 19 : 24;
  const lh = mobile ? 28 : 36;
  const statement = mobile
    ? ['I build onchain products where', 'money moves: streaming payments,', 'trading bots, and perps for', 'tokenized stocks. I also hunt', 'web and API bugs, so what I ship', 'gets the same scrutiny.']
    : ['I build onchain products where money moves:', 'streaming payments, trading bots, and perps', 'for tokenized stocks. I also hunt web and API', 'bugs, so what I ship gets the same scrutiny.'];
  const focus = ['Payments', 'DeFi', 'Security', 'Bots', 'AI agents', 'Tokenized equities', 'Privacy'];
  let body = sectionHeader(pad, W, '01', 'ABOUT', mobile);
  let y = headerH(mobile) + (mobile ? 42 : 50);
  if (!mobile) body += `<g class="fade" ${d(0.2)}>${t(pad, y, 'WHO', 'class="cap"')}</g>`;
  statement.forEach((line, i) => {
    body += `<g class="in" ${d(0.2 + i * 0.1)}>${t(colX, y + i * lh, line, `font-size="${size}" font-weight="500" letter-spacing="-.01em"`)}</g>`;
  });
  y += (statement.length - 1) * lh + (mobile ? 40 : 46);
  body += `<g class="fade" ${d(0.6)}>${t(pad, mobile ? y : y + 22, 'FOCUS', 'class="cap"')}</g>`;
  if (mobile) y += 16;
  const fsz = 14, h = 34, gap = 10;
  let x = colX;
  focus.forEach((f, i) => {
    const w = Math.round(sansW(f, fsz) + 30);
    if (x + w > W - pad) { x = colX; y += h + gap; }
    const filled = i < 3;
    body += `<g class="in" ${d(0.65 + i * 0.07)}>
  <rect x="${x}" y="${f1(y)}" width="${w}" height="${h}" rx="${h / 2}" ${filled ? `fill="${C.accent}"` : `stroke="${C.ink}" stroke-opacity=".28"`}/>
  ${t(x + w / 2, y + 22, f, `font-size="${fsz}" font-weight="700" text-anchor="middle" ${filled ? `style="fill:${C.bg}"` : ''}`)}
</g>`;
    x += w + gap;
  });
  const H = y + h + (mobile ? 24 : 34);
  return svg(W, Math.round(H), 'About: I build onchain products where money moves: streaming payments, trading bots, and perps for tokenized stocks. I also hunt web and API bugs. Focus: payments, DeFi, security, bots, AI agents, tokenized equities, privacy.', body);
}

// ============================ BUILDING NOW (bento) ============================
const PROJECTS = {
  arclis: { name: 'ARCLIS', status: 'active', tag: 'SOLANA', img: 'arclis',
    desc: 'Tokenized equities on Solana: a backing registry, and perps that keep market hours, splits and dividends.' },
  eye: { name: 'THE EYE', status: 'live', tag: 'TELEGRAM', deco: 'eye',
    desc: 'Telegram trading bot for Bayse prediction markets.' },
  ferret: { name: 'FERRET', status: 'early', tag: 'WEB · QA', deco: 'term',
    desc: 'Explores your app like a user and proves every bug by replaying it.' },
  cascade: { name: 'CASCADE', status: 'active', tag: 'NEAR', deco: 'streams', tan: true,
    desc: 'Streaming payments for individuals and teams. Get paid in crypto from any chain, receive dollars, run payroll with no fees.' },
};

function deco(kind, x, y, w, h, fg) {
  if (kind === 'streams') {
    let g = '';
    [0, 1, 2, 3].forEach((k) => {
      const yy = f1(y + h / 2 - 24 + k * 16);
      g += `<line x1="${x}" y1="${yy}" x2="${x + w}" y2="${yy}" stroke="${fg}" stroke-opacity=".2" stroke-width="2.5" stroke-linecap="round"/>`;
      g += `<line class="flow f${k}" x1="${x}" y1="${yy}" x2="${x + w}" y2="${yy}" stroke="${fg}" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="18 30"/>`;
    });
    return g;
  }
  if (kind === 'eye') {
    const cx = f1(x + w / 2), cy = f1(y + h / 2);
    const shape = `M${cx - 46} ${cy}Q${cx} ${cy - 36} ${cx + 46} ${cy}Q${cx} ${cy + 36} ${cx - 46} ${cy}Z`;
    return `<path d="${shape}" stroke="${C.ink}" stroke-width="2"/>
<clipPath id="eyeclip"><path d="${shape}"/></clipPath>
<g clip-path="url(#eyeclip)"><g class="look"><circle cx="${cx}" cy="${cy}" r="13" fill="${C.accent}"/><circle cx="${cx}" cy="${cy}" r="5" fill="${C.bg}"/></g></g>`;
  }
  if (kind === 'term') {
    // lines adapted from Ferret's own README output
    const rows = ['✔ confirmed [high] POST /api/cart 500', '✔ confirmed [critical] blank page', '✔ confirmed [medium] dead button'];
    const max = Math.floor(w / 7);
    const y0 = y + h / 2 - 22;
    return rows.map((r, k) => `<g class="tline" style="animation-delay:${k * 0.6}s">${t(x, y0 + k * 20, r.length > max ? r.slice(0, max - 1) + '…' : r, `class="m" font-size="11.5" style="fill:${k === 0 ? C.accent : C.muted}"`)}</g>`).join('');
  }
  return '';
}

let imgClip = 0;
function card(p, x, y, w, h, i) {
  const tan = !!p.tan;
  const fg = tan ? C.bg : C.ink;
  const pad = 20;
  const lines = wrap(p.desc, Math.floor((w - pad * 2) / (14 * 0.53)));
  const nameSize = 34;
  const nameCap = glyphRun('A', nameSize).cap;
  const descTop = y + h - pad - (lines.length - 1) * 19;
  const nameBase = descTop - 26;
  const mediaTop = y + pad + 26;
  const mediaH = nameBase - nameCap - 18 - mediaTop;
  let s = `<g class="in" ${d(0.15 + i * 0.12)}>
<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="14" ${tan ? `fill="${C.accent}"` : `fill="${C.ink}" fill-opacity=".04" stroke="${C.ink}" stroke-opacity=".14"`}/>
${statusDot(x + pad + 4, y + pad + 5, p.status, tan ? C.bg : p.status === 'live' ? C.accent : p.status === 'early' ? C.muted : C.ink)}
<text x="${x + pad + 16}" y="${y + pad + 9}" class="cap" style="fill:${tan ? C.bg : C.muted}">${p.status.toUpperCase()}</text>
<text x="${x + w - pad}" y="${y + pad + 9}" class="cap" text-anchor="end" style="fill:${tan ? C.bg : C.muted}">${esc(p.tag)}</text>`;
  if (p.img) {
    const id = `ic${imgClip++}`;
    s += `<clipPath id="${id}"><rect x="${x + pad}" y="${mediaTop}" width="${w - pad * 2}" height="${f1(mediaH)}" rx="8"/></clipPath>
<g clip-path="url(#${id})"><image class="kb" href="${media(p.img)}" x="${x + pad}" y="${mediaTop}" width="${w - pad * 2}" height="${f1(mediaH)}" preserveAspectRatio="xMinYMin slice"/></g>
<rect x="${x + pad}" y="${mediaTop}" width="${w - pad * 2}" height="${f1(mediaH)}" rx="8" stroke="${C.ink}" stroke-opacity=".12"/>`;
  } else if (p.deco) {
    s += deco(p.deco, x + pad, mediaTop, w - pad * 2, mediaH, fg);
  }
  s += display(p.name, nameSize, x + pad, nameBase, fg);
  lines.forEach((l, k) => {
    s += `<text x="${x + pad}" y="${f1(descTop + k * 19)}" font-size="14" style="fill:${tan ? C.bg : C.muted}">${esc(l)}</text>`;
  });
  return s + '</g>';
}

function building(mobile) {
  const W = mobile ? 400 : 880;
  const pad = mobile ? 20 : 40;
  const gap = 16;
  const top = Math.round(headerH(mobile) + 30);
  let body = sectionHeader(pad, W, '02', 'BUILDING NOW', mobile);
  let H;
  const P = PROJECTS;
  if (!mobile) {
    const inner = W - pad * 2;
    const wide = Math.round((inner - gap) * 0.6);
    const narrow = inner - gap - wide;
    const h = 300;
    body += card(P.arclis, pad, top, wide, h, 0);
    body += card(P.eye, pad + wide + gap, top, narrow, h, 1);
    body += card(P.ferret, pad, top + h + gap, narrow, h, 2);
    body += card(P.cascade, pad + narrow + gap, top + h + gap, wide, h, 3);
    H = top + h * 2 + gap + pad;
  } else {
    const w = W - pad * 2;
    let y = top;
    [P.arclis, P.eye, P.ferret, P.cascade].forEach((p, i) => {
      const h = p.img ? 320 : 260;
      body += card(p, pad, y, w, h, i);
      y += h + gap;
    });
    H = y - gap + pad;
  }
  const css = `
.flow{animation:flow 8s ${EASE} infinite}
.f1{animation-duration:10s}.f2{animation-duration:12s}.f3{animation-duration:9s}
@keyframes flow{from{stroke-dashoffset:0}to{stroke-dashoffset:-192}}
.look{animation:look 10s ${EASE} infinite}
@keyframes look{0%,20%,100%{transform:translateX(0)}35%,50%{transform:translateX(-18px)}65%,80%{transform:translateX(18px)}}
.kb{transform-box:fill-box;transform-origin:center;animation:kb 12s ${EASE} infinite alternate}
@keyframes kb{from{transform:scale(1)}to{transform:scale(1.06)}}
.tline{animation:tline 9s ${EASE} infinite both}
@keyframes tline{0%,5%{opacity:0}15%,85%{opacity:1}95%,100%{opacity:0}}
`;
  return svg(W, H, 'Building now: Arclis (active), tokenized equities on Solana. The Eye (live), Telegram trading bot for Bayse prediction markets. Ferret (early), bug detection that proves every bug. Cascade (active), streaming payments on NEAR.', body, css);
}

// ============================ SHIPPED (timeline with screenshots) ============================
const SHIPPED = [
  { name: 'GALLERY ARCANA', desc: 'Sealed unlockables, paid for in shielded ZEC', tag: 'ZCASH', img: 'gallery' },
  { name: 'ARCWAY', desc: 'Discovery hub and sponsored USDC quests for Arc', tag: 'ARC MAINNET', img: 'arcway' },
  { name: 'MODALIS', desc: 'Goal-based savings with onchain spending limits', tag: 'MONAD', img: 'modalis' },
  { name: 'CHOG ARENA', desc: '3D battler where your NFT is the fighter', tag: 'MONAD', img: 'chog' },
  { name: 'ROOK', desc: 'Operations agent that proves the fix', tag: 'AI AGENT', img: 'rook' },
  { name: 'BUG BOUNTIES', desc: 'Web and API security research on Cantina', tag: 'SECURITY', img: null },
];

function shipped(mobile) {
  const W = mobile ? 400 : 880;
  const pad = mobile ? 20 : 40;
  const top = Math.round(headerH(mobile) + (mobile ? 46 : 52));
  const row = mobile ? 116 : 120;
  const thumbW = mobile ? 128 : 176;
  const thumbH = Math.round(thumbW * 9 / 16);
  const railX = pad + 6;
  const n = SHIPPED.length;
  const railEnd = top + (n - 1) * row;
  let body = sectionHeader(pad, W, '03', 'SHIPPED', mobile);
  body += `<line class="rail" x1="${railX}" y1="${top}" x2="${railX}" y2="${railEnd}" stroke="${C.ink}" stroke-opacity=".2" stroke-width="1.5" pathLength="100" stroke-dasharray="100"/>`;
  body += `<circle class="trav" cx="${railX}" cy="${top}" r="3.5" fill="${C.accent}" opacity="0"/>`;
  SHIPPED.forEach((s, i) => {
    const y = top + i * row;
    const nx = railX + 22;
    const tx = W - pad - thumbW;
    const ty = y - 22;
    const nameSize = mobile ? 22 : 28;
    const cap = glyphRun('A', nameSize).cap;
    const textW = tx - nx - 16;
    const id = `th${i}`;
    let thumb;
    if (s.img) {
      thumb = `<clipPath id="${id}"><rect x="${tx}" y="${ty}" width="${thumbW}" height="${thumbH}" rx="8"/></clipPath>
<g clip-path="url(#${id})"><image href="${media(s.img)}" x="${tx}" y="${ty}" width="${thumbW}" height="${thumbH}" preserveAspectRatio="xMidYMid slice"/></g>`;
    } else {
      // research work has no screenshot: a severity-bars motif instead
      const bars = [0.35, 0.6, 0.85, 0.5];
      const bw = (thumbW - 36) / 4;
      thumb = `<rect x="${tx}" y="${ty}" width="${thumbW}" height="${thumbH}" rx="8" fill="${C.ink}" fill-opacity=".04"/>` +
        bars.map((b, k) => `<rect class="bar" style="animation-delay:${k * 0.3}s" x="${f1(tx + 18 + k * bw)}" y="${f1(ty + thumbH - 12 - (thumbH - 40) * b)}" width="${f1(bw - 8)}" height="${f1((thumbH - 40) * b)}" rx="2" fill="${k === 2 ? C.accent : C.ink}" fill-opacity="${k === 2 ? 1 : 0.25}"/>`).join('') +
        t(tx + 18, ty + 22, 'WEB / API', 'class="cap"');
    }
    thumb += `<rect x="${tx}" y="${ty}" width="${thumbW}" height="${thumbH}" rx="8" stroke="${C.ink}" stroke-opacity=".14"/>`;
    const dsz = mobile ? 13 : 14;
    const descLines = wrap(s.desc, Math.floor(textW / (dsz * 0.56)));
    const nameBase = y + cap - 8;
    body += `<g class="in" ${d(0.25 + i * 0.1)}>
<circle cx="${railX}" cy="${y}" r="5.5" fill="${C.bg}" stroke="${i === n - 1 ? C.accent : C.ink}" stroke-width="1.5"/>
${t(nx, y - 12, `${String(i + 1).padStart(2, '0')} · ${s.tag}`, 'class="cap"')}
${display(s.name, nameSize, nx, nameBase)}
${descLines.map((l, k) => t(nx, nameBase + 21 + k * 17, l, `class="mu" font-size="${dsz}"`)).join('')}
${thumb}
${i < n - 1 ? hair(nx, f1(y + row - 34), W - pad, f1(y + row - 34), 0.08) : ''}
</g>`;
  });
  const H = railEnd + thumbH - 22 + pad;
  const css = `
.rail{animation:rail 1.6s ${OUTEASE} .2s both}
@keyframes rail{from{stroke-dashoffset:100}to{stroke-dashoffset:0}}
.trav{animation:trav 10s ${EASE} 2s infinite}
@keyframes trav{0%{opacity:0;transform:translateY(0)}8%{opacity:1}72%{opacity:1;transform:translateY(${railEnd - top}px)}80%,100%{opacity:0;transform:translateY(${railEnd - top}px)}}
.bar{transform-box:fill-box;transform-origin:bottom;animation:bar 8s ${EASE} infinite}
@keyframes bar{0%,100%{transform:scaleY(1)}50%{transform:scaleY(.7)}}
`;
  return svg(W, H, 'Shipped: Gallery Arcana (Zcash), Arcway (Arc mainnet), Modalis (Monad), Chog Arena (Monad), Rook (AI agent), web and API bug bounty research on Cantina.', body, css);
}

// ============================ STACK ============================
const STACK = [
  ['LANGUAGES', ['TypeScript', 'Python', 'Rust', 'Solidity']],
  ['BUILD', ['Anchor', 'Foundry', 'Next.js', 'React', 'Node']],
  ['INFRA', ['PostgreSQL', 'SQLite', 'Cloudflare Workers', 'Playwright']],
  ['CHAINS', ['Solana', 'NEAR', 'Monad', 'Arc', 'Zcash']],
];
function stack(mobile) {
  const W = mobile ? 400 : 880;
  const pad = mobile ? 20 : 40;
  let body = sectionHeader(pad, W, '04', 'STACK', mobile);
  let y = Math.round(headerH(mobile) + (mobile ? 40 : 46));
  STACK.forEach(([label, items], i) => {
    if (mobile) {
      const lines = [];
      let cur = [];
      for (const it of items) {
        if ([...cur, it].join(' / ').length > 32 && cur.length) { lines.push(cur.join(' / ')); cur = []; }
        cur.push(it);
      }
      lines.push(cur.join(' / '));
      body += `<g class="in" ${d(0.15 + i * 0.1)}>${t(pad, y, label, 'class="cap ac"')}`;
      lines.forEach((l, k) => { body += t(pad, y + 26 + k * 25, l, 'font-size="18" font-weight="700"'); });
      body += '</g>';
      y += 26 + lines.length * 25 + 14;
    } else {
      body += `<g class="in" ${d(0.15 + i * 0.1)}>${t(pad, y, label, 'class="cap ac"')}
<text x="250" y="${y + 2}" font-size="20" font-weight="700" letter-spacing="-.01em">${items.map((it, k) => (k ? `<tspan class="mu" font-weight="400">  /  </tspan>` : '') + esc(it)).join('')}</text>
${i < STACK.length - 1 ? hair(pad, y + 22, W - pad, y + 22, 0.08) : ''}</g>`;
      y += 50;
    }
  });
  const H = y - (mobile ? 10 : 22);
  return svg(W, H, 'Stack: TypeScript, Python, Rust, Solidity; Anchor, Foundry, Next.js, React, Node; PostgreSQL, SQLite, Cloudflare Workers, Playwright; Solana, NEAR, Monad, Arc, Zcash.', body);
}

// ============================ CONTRIBUTIONS header ============================
function contrib(mobile) {
  const W = mobile ? 400 : 880;
  const pad = mobile ? 20 : 40;
  const hh = headerH(mobile);
  const body = sectionHeader(pad, W, '05', 'CONTRIBUTIONS', mobile) +
    `<g class="fade" ${d(0.3)}>${t(pad + 30, hh + 30, mobile ? 'REDRAWN DAILY BY A GITHUB ACTION' : 'THE GRAPH, EATEN DAILY BY A GITHUB ACTION', 'class="cap"')}</g>`;
  return svg(W, Math.round(hh + 50), 'Contributions', body);
}

// ============================ FOOTER ============================
function footer(mobile) {
  const W = mobile ? 400 : 880;
  const pad = mobile ? 20 : 40;
  const size = mobile ? 64 : 120;
  const run = glyphRun('SAY HI', size);
  const top = 40;
  const base = top + run.cap;
  const handleY = base + (mobile ? 46 : 58);
  const H = Math.round(handleY + (mobile ? 78 : 88));
  const handleSize = mobile ? 24 : 32;
  const ax = pad + sansW('@0x_TIMii on X', handleSize) * 1.02 + 16;
  const css = `
.nudge{animation:nudge 6s ${EASE} infinite}
@keyframes nudge{0%,60%,100%{transform:translateX(0)}30%{transform:translateX(10px)}}
`;
  let word = `<clipPath id="fw"><rect x="0" y="${top - 6}" width="${W}" height="${f1(run.cap + 8)}"/></clipPath><g clip-path="url(#fw)">`;
  run.glyphs.forEach((g, i) => {
    word += `<g class="rise" ${d(0.05 + i * 0.06)}><path transform="translate(${f1(pad + g.x)} ${f1(base)})" fill="${C.ink}" d="${g.d}"/></g>`;
  });
  word += '</g>';
  const body = `
${word}
<g class="in" ${d(0.5)}>
  ${t(pad, handleY, '@0x_TIMii on X', `font-size="${handleSize}" font-weight="800" letter-spacing="-.02em" class="ac"`)}
  <g class="nudge"><path d="M${f1(ax)} ${f1(handleY - handleSize * 0.33)}h${handleSize}m-${f1(handleSize * 0.38)} -${f1(handleSize * 0.38)}l${f1(handleSize * 0.38)} ${f1(handleSize * 0.38)}l-${f1(handleSize * 0.38)} ${f1(handleSize * 0.38)}" stroke="${C.accent}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></g>
</g>
<g class="fade" ${d(0.7)}>
  ${hair(pad, H - 52, W - pad, H - 52)}
  ${t(pad, H - 24, '© 2026 TIMI', 'class="cap"')}
  ${t(W - pad, H - 24, mobile ? 'HAND-WRITTEN SVG' : 'HAND-WRITTEN SVG · NO TRACKERS', 'class="cap" text-anchor="end"')}
</g>`;
  return svg(W, H, 'Say hi: @0x_TIMii on X', body, css);
}

const builders = { hero, about, building, shipped, stack, contrib, footer };
fs.mkdirSync(OUT, { recursive: true });
for (const [name, fn] of Object.entries(builders)) {
  for (const mobile of [false, true]) {
    clipN = 0; imgClip = 0;
    fs.writeFileSync(path.join(OUT, `${name}${mobile ? '-mobile' : ''}.svg`), fn(mobile));
  }
}
console.log('wrote', Object.keys(builders).length * 2, 'svgs');
