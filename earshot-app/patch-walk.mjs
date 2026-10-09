// Adds walking support to src/earshot.js: hearing depends on distance, a whoosh while you glide, a "how to walk" hint,
// the finale card follows you, and the starting spot is restored when a case restarts.
// Run from the earshot-app folder:   node patch-walk.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const file = path.join(path.dirname(fileURLToPath(import.meta.url)), 'src', 'earshot.js');
const raw = fs.readFileSync(file, 'utf8');
const crlf = raw.includes('\r\n');
let s = raw.replace(/\r\n/g, '\n');

if (s.includes('HEAR_NEAR')) { console.log('already done: walking patch'); process.exit(0); }

const edits = [
  ['hearing distances',
    'const ACCUSE_DWELL = 1.5;\n',
    'const ACCUSE_DWELL = 1.5;\nconst HEAR_NEAR = 4.5;     // timed case: within this many metres you hear evidence at full strength\nconst HEAR_FAR = 8.0;      // ...and beyond this you cannot catch it at all, so you have to walk over\n'],
  ['far conversations stay audible',
    '      c.gain.gain.setTargetAtTime((hush ? QUIET : 0.15 + 0.85 * focus) * c.boost, now, 0.1);',
    '      // Far conversations are lifted a little so you can still tell something is going on over there.\n      const comp = Math.min(2, Math.max(0.8, Math.pow((1 + 0.5 * (len - 1)) / 1.6, 0.6)));\n      c.gain.gain.setTargetAtTime((hush ? QUIET : 0.15 + 0.85 * focus) * c.boost * comp, now, 0.1);'],
  ['evidence needs you to be close',
    '          const rate = cup >= CUP_ON ? 1 : i === lookIdx ? EV_GAZE : 0;',
    '          const near = clamp01((HEAR_FAR - len) / (HEAR_FAR - HEAR_NEAR));\n          const rate = (cup >= CUP_ON ? 1 : i === lookIdx ? EV_GAZE : 0) * near;'],
  ['notebook hint text',
    "      const lines = wrapLines(g, 'Noted: ' + toast.text, 960).slice(0, 2);",
    "      const lines = wrapLines(g, (toast.hint ? '' : 'Noted: ') + toast.text, 960).slice(0, 2);"],
  ['how-to-walk hint at the start',
    "      this.notes = []; this.hudOn = true; this.downT = 0;\n      this.message = 'Listen in. Cup a hand toward a conversation.';",
    "      this.notes = []; this.hudOn = true; this.downT = 0;\n      this.toast = { text: 'Point at a glowing marker and hold to walk over to a conversation.', t: performance.now(), hint: true };\n      this.message = 'Listen in. Walk to a conversation, then cup a hand toward it.';"],
  ['finale card follows you',
    "    this.showCards('CASE SOLVED', cs.finale.text, []);",
    "    this.showCards('CASE SOLVED', cs.finale.text, [], true);"],
  ['sound effect hook',
    'celebrate: 0, convos: [] };',
    "celebrate: 0, moving: false, convos: [] };\n    window.earshotFx = (name) => { if (this.ctx && name === 'move') this.playWhoosh(); };"],
  ['whoosh sound',
    '  startChatter() {\n',
    `  // A soft sweep while the camera glides to a new spot.
  playWhoosh() {
    const ctx = this.ctx, t = ctx.currentTime, len = Math.floor(ctx.sampleRate * 2.2);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const s = ctx.createBufferSource(); s.buffer = buf;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.8;
    bp.frequency.setValueAtTime(260, t); bp.frequency.exponentialRampToValueAtTime(1500, t + 1.0); bp.frequency.exponentialRampToValueAtTime(320, t + 2.1);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.16, t + 0.7); g.gain.linearRampToValueAtTime(0.0001, t + 2.1);
    s.connect(bp).connect(g).connect(ctx.destination);
    s.start(t);
  }

  startChatter() {
`],
  ['return to the start spot on restart',
    '  async loadCase(cs, first) {\n    this.teardown();\n',
    `  async loadCase(cs, first) {
    this.teardown();
    // Remember where you started, and put you back there when a case restarts (you may have walked across the party).
    const rig = this.player;
    if (rig && rig.position && rig.rotation) {
      if (!this.rigHome) this.rigHome = { x: rig.position.x, z: rig.position.z, y: rig.rotation.y };
      else { rig.position.x = this.rigHome.x; rig.position.z = this.rigHome.z; rig.rotation.y = this.rigHome.y; }
    }
`],
];

let bad = 0;
for (const [label, from, to] of edits) {
  if (!s.includes(from)) { console.log('NOT FOUND:   ' + label); bad++; continue; }
  s = s.replace(from, to);
  console.log('changed:     ' + label);
}
if (bad) { console.log('\nNothing was saved. Send me the part of earshot.js for the lines marked NOT FOUND.'); process.exit(1); }
fs.writeFileSync(path.join(path.dirname(file), 'earshot.js.walk.bak'), raw);
fs.writeFileSync(file, crlf ? s.replace(/\n/g, '\r\n') : s);
console.log('\nSaved src/earshot.js (backup: src/earshot.js.walk.bak)');
