// Rebuilds the dining chairs in src/room.js so they look solid from every angle.
// Run from the earshot-app folder:  node patch-chairs.mjs
// Safe to run twice. Keeps the file's line endings.
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';

const file = 'src/room.js';
let src = readFileSync(file, 'utf8');
const crlf = src.includes('\r\n');
src = src.replace(/\r\n/g, '\n');

if (src.includes('// chairs v2')) { console.log('Chairs already updated. Nothing to do.'); process.exit(0); }

const head = 'addChairs(tables, hasPiano) {';
const start = src.indexOf(head);
if (start < 0) { console.error('Could not find addChairs in ' + file); process.exit(1); }

// Find the closing brace of the method.
let i = src.indexOf('{', start), depth = 0, end = -1;
for (; i < src.length; i++) {
  const ch = src[i];
  if (ch === '{') depth++;
  else if (ch === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
}
if (end < 0) { console.error('Could not find the end of addChairs.'); process.exit(1); }

const body = `addChairs(tables, hasPiano) {
    // chairs v2: solid backs, thick legs and a seat skirt, so they read as chairs from every angle.
    const frame = mat(this.theme.chair);
    const cush = mat(this.theme.cushion);
    for (const [tx, tz] of tables) {
      const len = Math.hypot(tx, tz) || 1;
      const ox = tx / len, oz = tz / len;   // outward from the middle of the room
      const sx = -oz, sz = ox;              // sideways
      for (const side of [-1, 1]) {
        const cx = tx + sx * side * 0.88 + ox * 0.12;
        const cz = tz + sz * side * 0.88 + oz * 0.12;
        if (Math.abs(cx) > 3.15 || Math.abs(cz) > 3.15) continue;
        if (hasPiano && cx < -1.75 && cz < -2.2) continue;
        const c = new Group();
        c.position.set(cx, 0, cz);
        c.rotation.y = Math.atan2(tx - cx, tz - cz); // front faces its table
        const add = (w, h, d, x, y, z, m) => {
          const b = new Mesh(new BoxGeometry(w, h, d), m);
          b.position.set(x, y, z);
          c.add(b);
        };
        add(0.44, 0.06, 0.44, 0, 0.40, 0, frame);        // seat skirt: closes the gap under the cushion
        add(0.40, 0.07, 0.40, 0, 0.465, 0.01, cush);     // padded seat
        add(0.44, 0.50, 0.05, 0, 0.70, -0.195, frame);   // solid back panel
        add(0.34, 0.38, 0.03, 0, 0.70, -0.165, cush);    // padded back, in front of the panel
        add(0.46, 0.05, 0.07, 0, 0.965, -0.195, frame);  // top rail
        for (const lx of [-0.18, 0.18]) {
          for (const lz of [-0.18, 0.18]) add(0.045, 0.40, 0.045, lx, 0.20, lz, frame); // legs
        }
        add(0.40, 0.025, 0.025, 0, 0.12, 0.18, frame);   // front stretcher
        add(0.40, 0.025, 0.025, 0, 0.12, -0.18, frame);  // back stretcher
        this.furn.add(c);
      }
    }
  }`;

const out = src.slice(0, start) + body + src.slice(end);
copyFileSync(file, file + '.bak');
writeFileSync(file, crlf ? out.replace(/\n/g, '\r\n') : out);
console.log('Chairs updated. A backup is at ' + file + '.bak');
