// Makes each party appear straight away: every person fades in as their picture arrives,
// instead of the whole room waiting for all the pictures. Patches src/gala.js and src/room.js in place.
//
// Run it from the folder that contains earshot-app:   node apply-progressive-loading.cjs
// It checks every change first and writes nothing unless all of them fit.

const fs = require('fs');
const os = require('os');
const path = require('path');

const srcDir = ['earshot-app/src', 'src'].map((p) => path.resolve(p)).find((p) => fs.existsSync(path.join(p, 'gala.js')));
if (!srcDir) {
  console.error('Could not find src/gala.js. Run this from the earshot folder (the one that contains earshot-app).');
  process.exit(1);
}

// ---------- pieces shared by both files ----------

const QUEUE = `
  // Pictures download a few at a time, in the order of imageList(), so the people who matter first appear first.
  queueImages(list) {
    const want = new Set(list.map(([k]) => k));
    this.queue = this.queue.filter(([k]) => { if (want.has(k)) return true; this.loading.delete(k); return false; });
    for (const [k, url] of list) {
      if (this.tex[k] || this.loading.has(k) || this.failed.has(k)) continue;
      this.loading.add(k);
      this.queue.push([k, url]);
    }
    this.pump();
  }

  pump() {
    while (this.active < 8 && this.queue.length) {
      const [k, url] = this.queue.shift();
      this.active++;
      this.loader.load(
        url,
        (t) => { t.colorSpace = SRGBColorSpace; this.tex[k] = t; this.active--; this.pump(); },
        undefined,
        () => { this.failed.add(k); this.active--; console.warn('Earshot: could not load ' + url); this.pump(); }
      );
    }
  }
`;

const STEP = `
  // Each frame: put pictures on the people whose pictures have just arrived, and fade them in.
  stepFigures(dt) {
    for (const f of this.figs) {
      if (!f.ready) { if (!this.fillFigure(f)) continue; }
      else if (f.talk === f.closed) { const tk = this.tex[f.name + '-talk']; if (tk) f.talk = tk; }
      if (f.load < 1) f.load = Math.min(1, f.load + dt * 2.2);
      f.material.opacity = f.load * f.vis;
    }
  }
`;

// ---------- gala.js (Case 3) ----------

const G_INIT = `    this.open = 0; this.lastCelebrate = 0; this.wasRevealed = false;
    this.figs = []; this.queue = []; this.active = 0; this.listFor = null; this.list = []; this.builtCase = null; this.builtAt = 0;`;

const G_IMAGELIST = `  // The pictures a case needs, in the order they should load: everybody's standing picture first
  // (the host, then each group, then the people from the finale), then the talking pictures.
  imageList(cs) {
    const first = [];
    const add = (n) => { if (n && !first.includes(n)) first.push(n); };
    add(cs.host);
    for (const g of cs.groups) for (const m of (g.members || g.pair || [])) add(m);
    for (const a of (cs.finale && cs.finale.appear) || []) add(a.name);
    const keys = [...first, ...cs.images.filter((k) => !first.includes(k))];
    return keys.map((k) => [k, (cs.art || '') + k + '.png']);
  }
${QUEUE}`;

const G_MAKEFIGURE = `  makeFigure(name, x, z, h, lift, face, turn) {
    const real = (window.earshotCase && window.earshotCase.heights && window.earshotCase.heights[name]) || 1.72;
    h = h * real / 1.72;                                   // tall people look tall
    const geom = new PlaneGeometry(1, 1);
    geom.translate(0, 0.5, 0);
    // The person exists straight away; their picture is put on (and faded in) when it has downloaded.
    const material = new MeshBasicMaterial({ map: null, color: 0xd9ccbb, transparent: true, alphaTest: 0.02, side: DoubleSide, opacity: 0 });
    const mesh = new Mesh(geom, material);
    mesh.renderOrder = 2;
    mesh.visible = false;
    const shadow = new Mesh(new PlaneGeometry(1, 1), this.shadowMat);
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.012; shadow.renderOrder = 1;
    shadow.visible = false;
    const g = new Group();
    g.add(shadow, mesh);
    g.position.set(x, lift || 0, z);
    this.root.add(g);
    const f = { name, g, mesh, shadow, material, closed: null, talk: null, h, lift: lift || 0, phase: Math.random() * 6.28, vis: 1, load: 0, ready: false, face: face || null, turn: turn === undefined ? 1.05 : turn, walk: false };
    this.figs.push(f);
    this.fillFigure(f);
    return f;
  }

  fillFigure(f) {
    const closed = this.tex[f.name];
    if (!closed) return false;
    f.closed = closed;
    f.talk = this.tex[f.name + '-talk'] || closed;
    f.material.map = closed;
    f.material.needsUpdate = true;
    const a = this.aspect(closed);
    f.mesh.scale.set(f.h * a, f.h, 1);
    f.shadow.scale.set(Math.max(0.7, f.h * a * 1.5), 0.5, 1);
    f.mesh.visible = true;
    f.shadow.visible = true;
    f.ready = true;
    f.load = 0;
    return true;
  }
${STEP}
  // (The old version, which needed every picture before it could build anything. Not used any more.)
  makeFigureOld(name, x, z, h, lift, face, turn) {`;

const G_EDITS = [
  ['init fields', '    this.open = 0; this.lastCelebrate = 0; this.wasRevealed = false;', G_INIT],
  ['imageList', "  imageList(cs) { return cs.images.map((k) => [k, (cs.art || '') + k + '.png']); }", G_IMAGELIST],
  ['makeFigure', '  makeFigure(name, x, z, h, lift, face, turn) {', G_MAKEFIGURE],
  ['animate guard', '    const amp = Math.min(0.7, level * 8);', '    if (!f.ready) return;\n    const amp = Math.min(0.7, level * 8);'],
  ['clear()', '    this.open = 0; this.avoid = []; this.glide = null; this.interior = null; this.finaleSpot = null; this.hostPath = null; this.hostT = 0;',
    '    this.open = 0; this.avoid = []; this.glide = null; this.interior = null; this.finaleSpot = null; this.hostPath = null; this.hostT = 0;\n    this.figs = []; this.builtCase = null;'],
  ['built flag', '    window.earshotBuilt = cs.id;', '    this.builtCase = cs; this.builtAt = performance.now();'],
  ['start loading', '    const layout = window.earshotLayout;',
    '    // Start downloading this case\'s pictures straight away, in priority order.\n    if (this.listFor !== cs) { this.listFor = cs; this.list = this.imageList(cs); this.queueImages(this.list); }\n    const layout = window.earshotLayout;'],
  ['list (1)', '      const list = this.imageList(cs);', '      const list = this.list;'],
  ['list (2)', '      this.ensureImages(list);', '      // (pictures are loaded in priority order by queueImages, above)'],
  ['no waiting', '      if (list.every(([k]) => this.tex[k] || this.failed.has(k))) {', '      if (list.length) {'],
  ['ready gate', '    this.root.visible = true;',
    '    this.root.visible = true;\n    if (this.builtCase && window.earshotBuilt !== this.builtCase.id) {\n      // Tell the game the party is ready once the host is on show (or after a few seconds, so a slow picture never holds things up).\n      if (!this.host || this.host.ready || now - this.builtAt > 6000) window.earshotBuilt = this.builtCase.id;\n    }\n    this.stepFigures(dt);'],
  ['finalist opacity', '      f.g.visible = f.vis > 0; f.material.opacity = f.vis;', '      f.g.visible = f.vis > 0;'],
];

// ---------- room.js (Cases 1 and 2) ----------

const R_INIT = `    this.confetti = null;
    this.figs = []; this.queue = []; this.active = 0; this.listFor = null; this.list = []; this.builtCase = null; this.builtAt = 0; this.panelCase = null;`;

const R_IMAGELIST = `  // The pictures a case needs, in the order they should load: Helen first, then each pair, then the people from the
  // finale, then everything else (talking pictures last). "shared" pictures (Helen) always come from characters/.
  imageList(cs) {
    const urls = new Map();
    for (const k of cs.images) urls.set(k, (cs.art || 'characters/') + k + '.png');
    for (const k of cs.shared || []) urls.set(k, 'characters/' + k + '.png');
    const first = ['helen'];
    for (const g of cs.groups) for (const m of (g.pair || g.members || [])) first.push(m);
    for (const a of (cs.finale && cs.finale.appear) || []) first.push(a.name);
    const keys = new Set([...first.filter((k) => urls.has(k)), ...urls.keys()]);
    return [...keys].map((k) => [k, urls.get(k)]);
  }
${QUEUE}
  // The ending picture is added as soon as it has downloaded (it may arrive after the room is built).
  tryPanel() {
    const cs = this.panelCase;
    if (!cs || this.panel || !this.furn || !cs.finale || !cs.finale.picture) return;
    const pt = this.tex[cs.finale.picture];
    if (!pt) return;
    const pw = 1.5, ph = pw / this.aspect(pt);
    const grp = new Group();
    const frame = new Mesh(new PlaneGeometry(pw + 0.1, ph + 0.1), mat(0x2b1a10, { side: DoubleSide }));
    const pic = new Mesh(
      new PlaneGeometry(pw, ph),
      new MeshBasicMaterial({ map: pt, transparent: true, opacity: 0, side: DoubleSide })
    );
    pic.position.z = 0.01;
    grp.add(frame, pic);
    const y = Math.min(2.2 + ph / 2, 2.95 - ph / 2);
    grp.position.set(DOOR_X, y, -3.42);
    grp.visible = false;
    this.furn.add(grp);
    this.panel = { grp, pic, vis: 0 };
  }

  // (The old version, which waited for every picture. Not used any more.)
  imageListOld(cs) {`;

const R_MAKEFIGURE = `  makeFigure(name, x, z, h) {
    const geom = new PlaneGeometry(1, 1);
    geom.translate(0, 0.5, 0); // feet at the origin
    // The person exists straight away; their picture is put on (and faded in) when it has downloaded.
    const material = new MeshBasicMaterial({ map: null, color: 0xf0e2d0, transparent: true, alphaTest: 0.02, side: DoubleSide, opacity: 0 });
    const mesh = new Mesh(geom, material);
    mesh.renderOrder = 2;
    mesh.visible = false;
    const shadow = new Mesh(new PlaneGeometry(1, 1), this.shadowMat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.012;
    shadow.renderOrder = 1;
    shadow.visible = false;
    const g = new Group();
    g.add(shadow, mesh);
    g.position.set(x, this.floorY, z);
    this.addToScene(g);
    this.built.push(g);
    const f = { name, g, mesh, shadow, material, closed: null, talk: null, h, phase: Math.random() * 6.28, vis: 1, load: 0, ready: false };
    this.figs.push(f);
    this.fillFigure(f);
    return f;
  }

  fillFigure(f) {
    const closed = this.tex[f.name];
    if (!closed) return false;
    f.closed = closed;
    f.talk = this.tex[f.name + '-talk'] || closed;
    f.material.map = closed;
    f.material.needsUpdate = true;
    const a = this.aspect(closed);
    f.mesh.scale.set(f.h * a, f.h, 1); // size stays fixed while talking, so figures never pop
    f.shadow.scale.set(Math.max(0.6, f.h * a * 1.3), 0.45, 1);
    f.mesh.visible = true;
    f.shadow.visible = true;
    f.ready = true;
    f.load = 0;
    return true;
  }
${STEP}
  // (The old version, which needed every picture before it could build anything. Not used any more.)
  makeFigureOld(name, x, z, h) {`;

const R_EDITS = [
  ['init fields', '    this.confetti = null;', R_INIT],
  ['imageList', '  imageList(cs) {', R_IMAGELIST],
  ['makeFigure', '  makeFigure(name, x, z, h) {', R_MAKEFIGURE],
  ['clearBuilt', '    for (const g of this.built) if (g.parent) g.parent.remove(g);',
    '    this.figs = []; this.panelCase = null; this.builtCase = null;\n    for (const g of this.built) if (g.parent) g.parent.remove(g);'],
  ['ending picture', '    const pt = this.tex[cs.finale.picture];',
    '    this.panelCase = cs;\n    const pt = null; // the ending picture is added by tryPanel() as soon as it has loaded'],
  ['built flag', '    window.earshotBuilt = cs.id; // tells the game this case\'s room is ready', '    this.builtCase = cs; this.builtAt = performance.now();'],
  ['animate guard', '    const amp = Math.min(0.7, level * 8);', '    if (!f.ready) return;\n    const amp = Math.min(0.7, level * 8);'],
  ['start loading', '    if (cs && layout && !gala) {',
    '    // Start downloading this case\'s pictures straight away, in priority order.\n    if (cs && !gala && this.listFor !== cs) { this.listFor = cs; this.list = this.imageList(cs); this.queueImages(this.list); }\n    if (cs && layout && !gala) {'],
  ['list (1)', '      const list = this.imageList(cs);', '      const list = this.list;'],
  ['list (2)', '      this.ensureImages(list);', '      // (pictures are loaded in priority order by queueImages, above)'],
  ['no waiting', '      const done = list.every(([k]) => this.tex[k] || this.failed.has(k));', '      const done = list.length > 0;'],
  ['ready gate', '    // Warm glows always face the player (a flat glow looks like an oval from the side).',
    '    // The room is ready for the game once Helen is on show (or after a few seconds, so a slow picture never holds things up).\n    if (this.builtCase && window.earshotBuilt !== this.builtCase.id && (!this.helen || this.helen.ready || now - this.builtAt > 6000)) window.earshotBuilt = this.builtCase.id;\n    this.stepFigures(dt);\n    this.tryPanel();\n\n    // Warm glows always face the player (a flat glow looks like an oval from the side).'],
  ['finalist opacity', '      f.material.opacity = f.vis;', '      // (opacity is applied in stepFigures, together with the fade-in)'],
];

// ---------- apply ----------

function patch(file, edits) {
  const full = path.join(srcDir, file);
  const raw = fs.readFileSync(full, 'utf8');
  const crlf = raw.includes('\r\n');
  let s = raw.replace(/\r\n/g, '\n');
  if (s.includes('queueImages(')) return { file, full, skipped: true };
  // Every change is located in the ORIGINAL text first (so inserted code can never be mistaken for it),
  // then applied from the bottom of the file upwards.
  const spots = [];
  for (const [label, find, repl] of edits) {
    const n = s.split(find).length - 1;
    if (n !== 1) {
      throw new Error(file + ': the "' + label + '" change matched ' + n + ' times (it should match exactly once), so your file differs from the one I saw. Nothing was changed.');
    }
    spots.push({ at: s.indexOf(find), len: find.length, repl });
  }
  spots.sort((a, b) => b.at - a.at);
  for (let i = 1; i < spots.length; i++) {
    if (spots[i].at + spots[i].len > spots[i - 1].at) throw new Error(file + ': two changes overlap. Nothing was changed.');
  }
  for (const p of spots) s = s.slice(0, p.at) + p.repl + s.slice(p.at + p.len);
  return { file, full, raw, out: crlf ? s.replace(/\n/g, '\r\n') : s };
}

let results;
try {
  results = [patch('gala.js', G_EDITS), patch('room.js', R_EDITS)];
} catch (e) {
  console.error('\n' + e.message + '\n');
  process.exit(1);
}

const backup = path.join(os.tmpdir(), 'earshot-backup');
fs.mkdirSync(backup, { recursive: true });
for (const r of results) {
  if (r.skipped) { console.log(r.file + ': already patched, skipped.'); continue; }
  fs.writeFileSync(path.join(backup, r.file), r.raw);
  fs.writeFileSync(r.full, r.out);
  console.log(r.file + ': patched.');
}
console.log('\nOriginals saved in ' + backup);
console.log('Next: run the game locally, check Cases 1, 2 and 3, then commit and push.');
