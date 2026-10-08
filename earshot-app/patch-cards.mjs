// Lifts the menu / answer cards into view in the flat desktop preview. Headset placement is unchanged.
// Run from the earshot-app folder:   node patch-cards.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const file = path.join(path.dirname(fileURLToPath(import.meta.url)), 'src', 'earshot.js');
const src = fs.readFileSync(file, 'utf8');

if (src.includes("vs.value === 'non-immersive'")) { console.log('already done: cards patch'); process.exit(0); }

const re = /([ \t]*)put\(titleCard\.mesh, 0, 1\.2, baseY - 0\.4\);(\r?\n)[ \t]*items\.forEach\(\(it, i\) => put\(it\.mesh, \(i - \(items\.length - 1\) \/ 2\) \* 26, 1\.1, baseY - 0\.68\)\);/;
if (!re.test(src)) { console.log('NOT FOUND: the two put(...) lines in showCards(). Send me that part of earshot.js.'); process.exitCode = 1; process.exit(); }

const out = src.replace(re, (m, ind, eol) => [
  ind + "// In the flat desktop preview the view is much narrower than in a headset, so lift the cards into frame.",
  ind + "const vs = this.world && this.world.visibilityState;",
  ind + "const desk = !!vs && vs.value === 'non-immersive';",
  ind + "const titleY = desk ? baseY - 0.08 : baseY - 0.4, cardY = desk ? baseY - 0.4 : baseY - 0.68;",
  ind + "const dist = desk ? 1.5 : 1.1, gap = desk ? 22 : 26;",
  ind + "put(titleCard.mesh, 0, desk ? 1.5 : 1.2, titleY);",
  ind + "items.forEach((it, i) => put(it.mesh, (i - (items.length - 1) / 2) * gap, dist, cardY));",
].join(eol));

fs.writeFileSync(path.join(path.dirname(file), 'earshot.js.bak'), src);
fs.writeFileSync(file, out);
console.log('changed: cards now sit inside the desktop preview (backup: src/earshot.js.bak)');
