// Puts the Platane/snk SVG on the same dark rounded panel as the rest of the README.
// Usage: node scripts/snake-panel.js dist/github-snake.svg
const fs = require('fs');
const file = process.argv[2];
let s = fs.readFileSync(file, 'utf8');
const vb = (s.match(/viewBox="([^"]+)"/) || [])[1];
if (!vb) throw new Error('no viewBox in ' + file);
const [x, y, w, h] = vb.trim().split(/[\s,]+/).map(Number);
const pad = 16;
s = s.replace(/viewBox="[^"]+"/, `viewBox="${x - pad} ${y - pad} ${w + pad * 2} ${h + pad * 2}"`);
s = s.replace(/(<svg[^>]*?)\swidth="[^"]*"/, '$1').replace(/(<svg[^>]*?)\sheight="[^"]*"/, '$1');
s = s.replace(/<svg([^>]*)>/, `<svg$1 width="${w + pad * 2}" height="${h + pad * 2}"><rect x="${x - pad}" y="${y - pad}" width="${w + pad * 2}" height="${h + pad * 2}" rx="18" fill="#0B0B0A"/>`);
fs.writeFileSync(file, s);
console.log('panelled', file);
