// Removes the flat grey background from the character PNGs (transparent PNG out), in place.
//
// Run from the earshot-app folder:
//   npm i -D sharp          (once)
//   node cutout.mjs         (defaults: public/characters/case3)
//
// Options:  node cutout.mjs [folder] [--force] [--no-trim] [--max-h=1400]
//   --force     redo files that are already cut out (re-reads the untouched originals from the backup folder)
//   --no-trim   keep the original canvas size instead of cropping to the figure
//   --max-h=N   shrink figures taller than N pixels (default 1400) so the headset loads faster
//
// Your untouched originals are copied once to  ./case3-originals  (add that folder to .gitignore).

import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const args = process.argv.slice(2);
const flag = (n) => args.includes('--' + n);
const opt = (n, d) => { const a = args.find((x) => x.startsWith('--' + n + '=')); return a ? Number(a.split('=')[1]) : d; };
const dir = path.resolve(args.find((a) => !a.startsWith('--')) || 'public/characters/case3');
const backupDir = path.resolve('case3-originals');
const FORCE = flag('force');
const TRIM = !flag('no-trim');
const MAX_H = opt('max-h', 1400);

const T_BG = 22;      // colour distance from the background that still counts as background (flood from the edges)
const T_HOLE = 12;    // enclosed pockets (between arm and body) this close to the background are removed too
const HOLE_MIN = 300; // ...but only if the pocket is at least this many pixels
const RAMP_HI = 52;   // edge pixels fade from transparent (T_BG) to opaque (RAMP_HI)

const median = (a) => { a.sort((x, y) => x - y); return a[a.length >> 1]; };

function cutout(data, w, h) {
  const n = w * h;
  // 1. Background colour = the median of every border pixel.
  const br = [], bgc = [], bb = [];
  const sample = (x, y) => { const i = (y * w + x) * 4; br.push(data[i]); bgc.push(data[i + 1]); bb.push(data[i + 2]); };
  for (let x = 0; x < w; x++) { sample(x, 0); sample(x, h - 1); }
  for (let y = 1; y < h - 1; y++) { sample(0, y); sample(w - 1, y); }
  const bg = [median(br), median(bgc), median(bb)];

  // 2. Distance of every pixel from that colour.
  const dist = new Float32Array(n);
  for (let p = 0; p < n; p++) {
    const i = p * 4;
    dist[p] = Math.hypot(data[i] - bg[0], data[i + 1] - bg[1], data[i + 2] - bg[2]);
  }

  // 3. Flood fill from the border through background-coloured pixels.
  const isBg = new Uint8Array(n);
  const stack = new Int32Array(n);
  let sp = 0;
  const push = (p) => { if (!isBg[p] && dist[p] < T_BG) { isBg[p] = 1; stack[sp++] = p; } };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  while (sp) {
    const p = stack[--sp], x = p % w, y = (p / w) | 0;
    if (x > 0) push(p - 1); if (x < w - 1) push(p + 1);
    if (y > 0) push(p - w); if (y < h - 1) push(p + w);
  }

  // 4. Enclosed pockets of background colour (gaps between arm and body, etc.).
  const seen = new Uint8Array(n);
  const comp = [];
  for (let s = 0; s < n; s++) {
    if (isBg[s] || seen[s] || dist[s] >= T_HOLE) continue;
    comp.length = 0; comp.push(s); seen[s] = 1;
    for (let k = 0; k < comp.length; k++) {
      const p = comp[k], x = p % w, y = (p / w) | 0;
      const nb = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1];
      for (const q of nb) if (q >= 0 && !seen[q] && !isBg[q] && dist[q] < T_HOLE) { seen[q] = 1; comp.push(q); }
    }
    if (comp.length >= HOLE_MIN) for (const p of comp) isBg[p] = 1;
  }

  // 5. Alpha: background = 0, figure = 255, and a soft 2px edge so there is no grey halo.
  const alpha = new Uint8Array(n);
  for (let p = 0; p < n; p++) alpha[p] = isBg[p] ? 0 : 255;
  let ring = [];
  for (let p = 0; p < n; p++) {
    if (isBg[p]) continue;
    const x = p % w, y = (p / w) | 0;
    if ((x > 0 && isBg[p - 1]) || (x < w - 1 && isBg[p + 1]) || (y > 0 && isBg[p - w]) || (y < h - 1 && isBg[p + w])) ring.push(p);
  }
  const fringe = new Set(ring);
  for (const p of ring) {
    const x = p % w, y = (p / w) | 0;
    for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1]) if (q >= 0 && !isBg[q]) fringe.add(q);
  }
  for (const p of fringe) {
    const a = Math.min(1, Math.max(0, (dist[p] - T_BG) / (RAMP_HI - T_BG)));
    alpha[p] = Math.round(a * 255);
    if (a > 0.02 && a < 1) { // take the grey out of the semi-transparent edge colours
      const i = p * 4;
      for (let c = 0; c < 3; c++) data[i + c] = Math.max(0, Math.min(255, Math.round((data[i + c] - (1 - a) * bg[c]) / a)));
    }
  }
  for (let p = 0; p < n; p++) data[p * 4 + 3] = alpha[p];

  // 6. Bounding box of what is left.
  let x0 = w, y0 = h, x1 = -1, y1 = -1, kept = 0;
  for (let p = 0; p < n; p++) {
    if (alpha[p] > 8) { const x = p % w, y = (p / w) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; kept++; }
  }
  return { bg, box: x1 < 0 ? null : { x0, y0, x1, y1 }, keptPct: (100 * kept) / n };
}

async function load(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data: Buffer.from(data), w: info.width, h: info.height };
}

async function save(file, img, box) {
  let s = sharp(img.data, { raw: { width: img.w, height: img.h, channels: 4 } });
  if (box) s = s.extract({ left: box.x0, top: box.y0, width: box.x1 - box.x0 + 1, height: box.y1 - box.y0 + 1 });
  const h = box ? box.y1 - box.y0 + 1 : img.h;
  if (h > MAX_H) s = s.resize({ height: MAX_H, kernel: 'lanczos3' });
  const out = await s.png({ compressionLevel: 9 }).toBuffer();
  fs.writeFileSync(file, out);
  return out.length;
}

if (!fs.existsSync(dir)) { console.error('Folder not found: ' + dir); process.exit(1); }
fs.mkdirSync(backupDir, { recursive: true });

const files = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.png'));
const names = files.filter((f) => !f.endsWith('-talk.png')).map((f) => f.slice(0, -4));
let done = 0, skipped = 0;

for (const name of names) {
  const pair = [name + '.png', name + '-talk.png'].filter((f) => files.includes(f));
  const imgs = [];
  let skip = false;
  for (const f of pair) {
    const live = path.join(dir, f), keep = path.join(backupDir, f);
    if (!fs.existsSync(keep)) fs.copyFileSync(live, keep);        // untouched original, saved once
    const img = await load(FORCE ? keep : live);
    if (!FORCE && img.data[3] < 250) { skip = true; break; }       // corner already transparent
    imgs.push({ f, img });
  }
  if (skip) { console.log('skip  ' + name + '  (already cut out; use --force to redo)'); skipped++; continue; }

  const results = imgs.map(({ img }) => cutout(img.data, img.w, img.h));
  // The mouth-open picture must be cropped exactly like the closed one so the swap does not jump.
  let box = null;
  if (TRIM) {
    const boxes = results.map((r) => r.box).filter(Boolean);
    if (boxes.length) box = { x0: Math.min(...boxes.map((b) => b.x0)), y0: Math.min(...boxes.map((b) => b.y0)), x1: Math.max(...boxes.map((b) => b.x1)), y1: Math.max(...boxes.map((b) => b.y1)) };
  }
  for (let k = 0; k < imgs.length; k++) {
    const { f, img } = imgs[k], r = results[k];
    const bytes = await save(path.join(dir, f), img, box);
    const warn = r.keptPct > 70 ? '  <-- WARNING: little removed, is the background plain?' : r.keptPct < 8 ? '  <-- WARNING: almost everything removed' : '';
    console.log('done  ' + f.padEnd(18) + ' bg rgb(' + r.bg.join(',') + ')  figure ' + r.keptPct.toFixed(0) + '%  ' + (bytes / 1024).toFixed(0) + ' KB' + warn);
  }
  done++;
}
console.log('\n' + done + ' characters cut out, ' + skipped + ' skipped. Originals are in ' + backupDir);
