// Checks every picture and audio file that src/cases.js asks for, the way a Linux server (Vercel) would see them:
//   1. does the file exist with EXACTLY that capitalisation?  (Windows hides this problem, Vercel does not)
//   2. is it committed to git?                                   (files that are not committed never reach Vercel)
// Run from the earshot-app folder:   node check-assets.mjs
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const { CASES } = await import(pathToFileURL(path.join(root, 'src', 'cases.js')).href);

let tracked = new Set();
try {
  tracked = new Set(execSync('git ls-files', { cwd: root, encoding: 'utf8', maxBuffer: 1 << 26 }).split('\n').map((s) => s.trim()).filter(Boolean));
} catch (e) { console.log('(could not read git, skipping the committed check)'); tracked = null; }

const want = [];
for (const c of CASES) {
  for (const k of c.images || []) want.push([c.id, 'public/' + (c.art || '') + k + '.png']);
  for (const k of c.shared || []) want.push([c.id, 'public/characters/' + k + '.png']);
  for (const u of [c.intro, c.ask, c.reveal]) if (u) want.push([c.id, 'public/' + u]);
  for (const g of c.groups || []) for (const u of [g.chatter, g.clue]) if (u) want.push([c.id, 'public/' + u]);
}
want.push([0, 'public/audio/chime.mp3']);

const exactExists = (rel) => {
  let dir = root;
  for (const part of rel.split('/')) {
    let list; try { list = fs.readdirSync(dir); } catch (e) { return { ok: false }; }
    if (list.includes(part)) { dir = path.join(dir, part); continue; }
    const alt = list.find((n) => n.toLowerCase() === part.toLowerCase());
    return alt ? { ok: false, wrongCase: alt } : { ok: false };
  }
  return { ok: true };
};

const seen = new Set(); let bad = 0;
for (const [id, rel] of want) {
  if (seen.has(rel)) continue; seen.add(rel);
  const e = exactExists(rel);
  if (!e.ok) { bad++; console.log((e.wrongCase ? 'WRONG CASE   ' : 'MISSING      ') + rel + (e.wrongCase ? '   (the file is really called "' + e.wrongCase + '")' : '') + '   [case ' + id + ']'); continue; }
  if (tracked && !tracked.has(rel)) { bad++; console.log('NOT IN GIT   ' + rel + '   [case ' + id + ']'); }
}
console.log('\nChecked ' + seen.size + ' files. ' + (bad ? bad + ' problem(s) above. Fix those, commit, push, and Vercel will redeploy.' : 'All present, correctly capitalised and committed. The cause is somewhere else: send me the browser console errors.'));
process.exitCode = bad ? 1 : 0;
