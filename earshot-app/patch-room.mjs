// Applies the three room.js edits in place, keeping everything else in your file.
// Run it from the earshot-app folder:   node patch-room.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const file = path.join(path.dirname(fileURLToPath(import.meta.url)), 'src', 'room.js');
const original = fs.readFileSync(file, 'utf8');
let s = original;
const report = [];

function once(label, apply, alreadyDone) {
  if (alreadyDone(s)) { report.push('already done: ' + label); return; }
  const next = apply(s);
  if (next === s) { report.push('NOT FOUND:   ' + label); return; }
  s = next;
  report.push('changed:      ' + label);
}

once('1. PAIR_TURN 0.5 -> 0.9',
  (t) => t.replace('const PAIR_TURN = 0.5;', 'const PAIR_TURN = 0.9;'),
  (t) => t.includes('const PAIR_TURN = 0.9;'));

once('2. pairs stand closer (0.36 -> 0.3)',
  (t) => t.replace('bx + sx * 0.36 * k, bz + sz * 0.36 * k', 'bx + sx * 0.3 * k, bz + sz * 0.3 * k'),
  (t) => t.includes('bx + sx * 0.3 * k, bz + sz * 0.3 * k'));

once('3. the gala has its own scene',
  (t) => t.replace(
    /(const layout = window\.earshotLayout;)(\r?\n)(\s*)if \(cs && layout\) \{/,
    (m, a, eol, ind) => [
      a,
      ind + "const gala = !!(cs && cs.theme === 'gala'); // the gala has its own scene (gala.js)",
      ind + 'this.party.visible = !gala;',
      ind + "if (gala && this.layoutKey) { this.clearBuilt(); this.layoutKey = ''; }",
      ind + 'if (cs && layout && !gala) {',
    ].join(eol)
  ),
  (t) => t.includes('const gala = !!(cs && cs.theme'));

console.log(report.join('\n'));
if (s !== original) {
  const backup = path.join(os.tmpdir(), 'room.js.backup');
  fs.writeFileSync(backup, original);
  fs.writeFileSync(file, s);
  console.log('\nSaved src/room.js. A backup of the old file is at ' + backup);
} else {
  console.log('\nNothing to change.');
}
if (report.some((r) => r.startsWith('NOT FOUND'))) { console.log('\nAt least one edit was not found; send me that part of room.js.'); process.exitCode = 1; }
