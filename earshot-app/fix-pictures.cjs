// Fixes characters not showing on Vercel.
//
// The "pictures" line in the ?test readout proved that the browser can fetch and decode every picture. The game was
// still loading them through the standard texture loader (an <img> element), which is the one step that was not proven.
// This patch loads each picture the proven way (fetch + decode off-screen) and keeps the old loader as a fallback.
// It also adds a "figures" line to the ?test readout: how many people are on show, and how many pictures are loaded.
//
// Run it from the folder that contains earshot-app:   node earshot-app/fix-pictures.cjs
// It checks every change first and writes nothing unless all of them fit.

const fs = require('fs');
const os = require('os');
const path = require('path');

const srcDir = [
  path.resolve('earshot-app/src'), path.resolve('src'),
  path.join(__dirname, 'src'), path.join(__dirname, 'earshot-app/src'),
].find((p) => fs.existsSync(path.join(p, 'gala.js')));
if (!srcDir) {
  console.error('Could not find src/gala.js. Run this from the earshot folder (the one that contains earshot-app).');
  process.exit(1);
}

// New pump(): the old one is kept below it under another name and is no longer used.
const PUMP = `  // Pictures are downloaded and decoded off-screen (the same way the readout's "pictures" check does), a few at a time.
  pump() {
    while (this.active < 8 && this.queue.length) {
      const [k, url] = this.queue.shift();
      this.active++;
      this.fetchTexture(url).then(
        (t) => { this.tex[k] = t; this.active--; this.pump(); },
        (e) => { this.failed.add(k); this.active--; console.warn('Earshot: could not load ' + url + ' (' + (e && e.message ? e.message : e) + ')'); this.pump(); }
      );
    }
  }

  fetchTexture(url) {
    const viaLoader = () => new Promise((res, rej) => this.loader.load(url, (t) => { t.colorSpace = SRGBColorSpace; res(t); }, undefined, rej));
    if (typeof createImageBitmap !== 'function') return viaLoader();
    return fetch(url)
      .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.blob(); })
      .then((b) => createImageBitmap(b, { imageOrientation: 'flipY', premultiplyAlpha: 'none' }))
      .then((bmp) => { const t = new CanvasTexture(bmp); t.flipY = false; t.colorSpace = SRGBColorSpace; t.needsUpdate = true; return t; })
      .catch(() => viaLoader());
  }

  // (The old version, which used the standard texture loader only. Not used any more.)
  pumpOld() {`;

const stepHead = (who) => `  stepFigures(dt) {
    const rec = (window.earshotPics = window.earshotPics || {});
    rec.${who} = { made: this.figs.length, ready: this.figs.filter((f) => f.ready).length, loaded: Object.keys(this.tex).length, failed: this.failed.size, waiting: this.queue.length };`;

const POOL = ['pump', '  pump() {', PUMP];

const FILES = {
  'gala.js': { marker: 'fetchTexture(', edits: [POOL, ['figures count', '  stepFigures(dt) {', stepHead('gala')]] },
  'room.js': { marker: 'fetchTexture(', edits: [POOL, ['figures count', '  stepFigures(dt) {', stepHead('room')]] },
  'earshot.js': {
    marker: 'earshotPics',
    edits: [[
      'figures line', '    if (this.picCheck) {',
      "    const pp = window.earshotPics && window.earshotPics[cs.theme === 'gala' ? 'gala' : 'room'];\n" +
      "    if (pp) lines.push('figures ' + pp.ready + '/' + pp.made + ' on show, pictures ' + pp.loaded + ' loaded, ' + pp.failed + ' failed, ' + pp.waiting + ' waiting');\n" +
      '    if (this.picCheck) {',
    ]],
  },
};

function patch(file, { marker, edits }) {
  const full = path.join(srcDir, file);
  if (!fs.existsSync(full)) throw new Error(file + ' was not found in ' + srcDir + '. Nothing was changed.');
  const raw = fs.readFileSync(full, 'utf8');
  const crlf = raw.includes('\r\n');
  let s = raw.replace(/\r\n/g, '\n');
  if (s.includes(marker)) return { file, skipped: true };
  const spots = [];
  for (const [label, find, repl] of edits) {
    const n = s.split(find).length - 1;
    if (n !== 1) {
      throw new Error(file + ': the "' + label + '" change matched ' + n + ' times (it should match exactly once), so your file differs from the one I saw. Nothing was changed.');
    }
    spots.push({ at: s.indexOf(find), len: find.length, repl });
  }
  spots.sort((a, b) => b.at - a.at);
  for (const p of spots) s = s.slice(0, p.at) + p.repl + s.slice(p.at + p.len);
  return { file, full, raw, out: crlf ? s.replace(/\n/g, '\r\n') : s };
}

let results;
try {
  results = Object.entries(FILES).map(([file, spec]) => patch(file, spec));
} catch (e) {
  console.error('\n' + e.message + '\n');
  process.exit(1);
}

const backup = path.join(os.tmpdir(), 'earshot-backup2');
fs.mkdirSync(backup, { recursive: true });
for (const r of results) {
  if (r.skipped) { console.log(r.file + ': already patched, skipped.'); continue; }
  fs.writeFileSync(path.join(backup, r.file), r.raw);
  fs.writeFileSync(r.full, r.out);
  console.log(r.file + ': patched.');
}
console.log('\nOriginals saved in ' + backup);
console.log('Next: run the game locally, then commit and push.');
