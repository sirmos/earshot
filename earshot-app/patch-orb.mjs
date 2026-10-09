// Makes the glowing orb above each conversation a soft warm glow instead of a flat brown disc (gala only).
// Run from the earshot-app folder:   node patch-orb.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const file = path.join(path.dirname(fileURLToPath(import.meta.url)), 'src', 'earshot.js');
const raw = fs.readFileSync(file, 'utf8');
const crlf = raw.includes('\r\n');
let s = raw.replace(/\r\n/g, '\n');
if (s.includes('AdditiveBlending')) { console.log('already done: orb patch'); process.exit(0); }

const edits = [
  ['import AdditiveBlending', '  CanvasTexture, SRGBColorSpace, DoubleSide,\n} from', '  CanvasTexture, SRGBColorSpace, DoubleSide, AdditiveBlending,\n} from'],
  ['soft glowing orb',
    'new MeshBasicMaterial({ color: 0xff9f5b, transparent: true, opacity: 0.4, depthWrite: false })',
    "new MeshBasicMaterial({ color: cs.theme === 'gala' ? 0xffc47a : 0xff9f5b, transparent: true, opacity: 0.4, depthWrite: false, ...(cs.theme === 'gala' ? { blending: AdditiveBlending } : {}) })"],
  ['orb colour',
    'c.orb.material.color.setHex(c.caught ? 0xffd34d : 0xff9f5b);',
    "c.orb.material.color.setHex(c.caught ? 0xffd34d : cs.theme === 'gala' ? 0xffc47a : 0xff9f5b);"],
  ['orb brightness',
    'c.orb.material.opacity = c.caught ? 0.95 : 0.3 + 0.4 * focus + 0.25 * prog;',
    "c.orb.material.opacity = (c.caught ? 0.95 : 0.3 + 0.4 * focus + 0.25 * prog) * (cs.theme === 'gala' ? 0.65 : 1);"],
];
let bad = 0;
for (const [label, from, to] of edits) {
  if (!s.includes(from)) { console.log('NOT FOUND:   ' + label); bad++; continue; }
  s = s.replace(from, to); console.log('changed:     ' + label);
}
if (bad) { console.log('\nNothing was saved. Send me the lines marked NOT FOUND.'); process.exit(1); }
fs.writeFileSync(path.join(path.dirname(file), 'earshot.js.orb.bak'), raw);
fs.writeFileSync(file, crlf ? s.replace(/\n/g, '\r\n') : s);
console.log('\nSaved src/earshot.js (backup: src/earshot.js.orb.bak)');
