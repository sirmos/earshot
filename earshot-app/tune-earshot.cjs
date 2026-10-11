// Patches your current src/earshot.js (everything else in it stays exactly as you have it):
//   1. easier clue catching:  EV_NEED 0.5 -> 0.4,  EV_GAZE 0.6 -> 0.9,  HEAR_NEAR 4.5 -> 6.0
//   2. a "pictures" line in the ?test / ?debug readout: the browser fetches and decodes every picture of the
//      case and reports how many worked, and the name of any that did not. Players never see it.
//
// Run it from the folder that contains earshot-app:   node tune-earshot.cjs
// It checks every change first and writes nothing unless all of them fit.

const fs = require('fs');
const os = require('os');
const path = require('path');

const target = [
  path.resolve('earshot-app/src/earshot.js'),
  path.resolve('src/earshot.js'),
  path.join(__dirname, 'src/earshot.js'),
  path.join(__dirname, 'earshot-app/src/earshot.js'),
].find((p) => fs.existsSync(p));
if (!target) {
  console.error('Could not find src/earshot.js. Run this from the earshot folder (the one that contains earshot-app).');
  process.exit(1);
}

const CHECK = `  // Debug only (?test or ?debug): fetches and decodes every picture of the case in the browser and reports the
  // result in the readout, so a missing, blocked or broken picture shows up by name.
  async checkPictures(cs) {
    const urls = [];
    for (const k of cs.images || []) urls.push((cs.art || 'characters/') + k + '.png');
    for (const k of cs.shared || []) urls.push('characters/' + k + '.png');
    const res = { ok: 0, total: urls.length, bad: [], ms: 0, done: false };
    this.picCheck = res;
    const t0 = performance.now();
    await Promise.all(urls.map(async (url) => {
      try {
        const r = await fetch(url);
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const bmp = await createImageBitmap(await r.blob());
        if (bmp.close) bmp.close();
        res.ok++;
      } catch (e) {
        res.bad.push(url.split('/').pop() + ' (' + (e && e.message ? e.message : e) + ')');
      }
    }));
    res.ms = Math.round(performance.now() - t0);
    res.done = true;
  }

  teardown() {`;

const edits = [
  ['EV_NEED', 'const EV_NEED = 0.5;', 'const EV_NEED = 0.4;'],
  ['EV_GAZE', 'const EV_GAZE = 0.6;', 'const EV_GAZE = 0.9;'],
  ['HEAR_NEAR', 'const HEAR_NEAR = 4.5;', 'const HEAR_NEAR = 6.0;'],
  ['start check', '    window.earshotLayout = null; // the room builds only once this case has its own layout',
    '    window.earshotLayout = null; // the room builds only once this case has its own layout\n    if (DEBUG) this.checkPictures(cs);'],
  ['check method', '  teardown() {', CHECK],
  ['readout line', "    lines.push('');",
    "    if (this.picCheck) {\n      const p = this.picCheck;\n      lines.push('pictures ' + p.ok + '/' + p.total + ' ok' + (p.done ? ' in ' + p.ms + ' ms' : ' ...') + (p.bad.length ? '  FAILED: ' + p.bad.slice(0, 3).join(', ') : ''));\n    }\n    lines.push('');"],
];

const raw = fs.readFileSync(target, 'utf8');
const crlf = raw.includes('\r\n');
let s = raw.replace(/\r\n/g, '\n');
if (s.includes('checkPictures(')) {
  console.log('earshot.js: already patched, nothing to do.');
  process.exit(0);
}

// Locate every change in the ORIGINAL text first, then apply from the bottom upwards.
const spots = [];
for (const [label, find, repl] of edits) {
  const n = s.split(find).length - 1;
  if (n !== 1) {
    console.error('\nThe "' + label + '" change matched ' + n + ' times (it should match exactly once), so your earshot.js differs from the one I saw. Nothing was changed.\n');
    process.exit(1);
  }
  spots.push({ at: s.indexOf(find), len: find.length, repl });
}
spots.sort((a, b) => b.at - a.at);
for (const p of spots) s = s.slice(0, p.at) + p.repl + s.slice(p.at + p.len);

const backup = path.join(os.tmpdir(), 'earshot-backup');
fs.mkdirSync(backup, { recursive: true });
fs.writeFileSync(path.join(backup, 'earshot.js'), raw);
fs.writeFileSync(target, crlf ? s.replace(/\n/g, '\r\n') : s);
console.log('earshot.js: patched.');
console.log('Original saved in ' + backup);
console.log('Next: run the game locally, then commit and push.');
