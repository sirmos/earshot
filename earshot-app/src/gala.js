// The Lumen Awards v2: a night-time courtyard party. A glass pavilion with a stage, a lit pool, six conversation
// spots lit like film sets, and glowing markers you point at to walk between them (a smooth, film-style glide).
//
// Everything is in "party coordinates": x is right, z is forward (negative = ahead), origin is where you start.
import {
  createSystem, Group, Mesh, BoxGeometry, PlaneGeometry, SphereGeometry, CylinderGeometry, RingGeometry,
  MeshBasicMaterial, DoubleSide, BackSide, AdditiveBlending, TextureLoader, CanvasTexture, SRGBColorSpace,
} from '@iwsdk/core';

const FIG_H = 1.55;
const TAU = Math.PI * 2;
const DWELL = 0.85;                          // seconds to hold your aim on a marker to walk there
const HOVER_COS = Math.cos((9 * Math.PI) / 180);
const EYE = 1.25;                            // seated eye height above the floor
const wrapPI = (a) => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };
const ease = (u) => u * u * u * (u * (u * 6 - 15) + 10);
const clamp01 = (v) => Math.min(1, Math.max(0, v));

// ---------- textures (all drawn in code, so there are no image files to load) ----------

function canvasTexture(w, h, draw, wrap) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  if (wrap) t.wrapS = t.wrapT = 1000;
  return t;
}
const lin = (g, x0, y0, x1, y1, stops) => { const gr = g.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, c]) => gr.addColorStop(o, c)); return gr; };
const rad = (g, x, y, r0, r1, stops) => { const gr = g.createRadialGradient(x, y, r0, x, y, r1); stops.forEach(([o, c]) => gr.addColorStop(o, c)); return gr; };

const glowTexture = () => canvasTexture(128, 128, (g, w, h) => { g.fillStyle = rad(g, w / 2, h / 2, 0, w / 2, [[0, 'rgba(255,255,255,1)'], [0.3, 'rgba(255,255,255,0.4)'], [1, 'rgba(255,255,255,0)']]); g.fillRect(0, 0, w, h); });
const softTexture = () => canvasTexture(128, 128, (g, w, h) => { g.fillStyle = rad(g, w / 2, h / 2, 0, w / 2, [[0, 'rgba(255,255,255,0.9)'], [0.6, 'rgba(255,255,255,0.35)'], [1, 'rgba(255,255,255,0)']]); g.fillRect(0, 0, w, h); });
const shadowTexture = () => canvasTexture(128, 128, (g, w, h) => { g.fillStyle = rad(g, w / 2, h / 2, 0, w / 2, [[0, 'rgba(0,0,0,0.6)'], [1, 'rgba(0,0,0,0)']]); g.fillRect(0, 0, w, h); });
const beamTexture = () => canvasTexture(64, 256, (g, w, h) => { g.fillStyle = lin(g, 0, 0, 0, h, [[0, 'rgba(255,255,255,0.55)'], [1, 'rgba(255,255,255,0)']]); g.fillRect(0, 0, w, h); });
const vGrad = (c0, c1) => canvasTexture(4, 64, (g, w, h) => { g.fillStyle = lin(g, 0, 0, 0, h, [[0, c0], [1, c1]]); g.fillRect(0, 0, w, h); });

function skyTexture() {
  return canvasTexture(2048, 1024, (g, w, h) => {
    g.fillStyle = lin(g, 0, 0, 0, h, [[0, '#01020a'], [0.22, '#070c2a'], [0.38, '#14194a'], [0.46, '#3d2a68'], [0.5, '#b9607a'], [0.515, '#2e1f4c'], [0.6, '#090a1b'], [1, '#05060d']]);
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#fff';
    for (let i = 0; i < 1100; i++) { g.globalAlpha = 0.2 + Math.random() * 0.8; g.fillRect(Math.random() * w, Math.pow(Math.random(), 1.5) * h * 0.46, 1.5, 1.5); }
    g.globalAlpha = 1;
    g.fillStyle = rad(g, w * 0.7, h * 0.2, 0, 90, [[0, 'rgba(255,244,214,0.5)'], [1, 'rgba(255,244,214,0)']]); g.fillRect(w * 0.7 - 90, h * 0.2 - 90, 180, 180);
    g.fillStyle = '#fff6dc'; g.beginPath(); g.arc(w * 0.7, h * 0.2, 20, 0, TAU); g.fill();
  });
}
function skylineTexture() {
  return canvasTexture(2048, 256, (g, w, h) => {
    let x = 0;
    while (x < w) {
      const bw = 24 + Math.random() * 70, bh = 50 + Math.random() * 150;
      g.fillStyle = '#080a18'; g.fillRect(x, h - bh, bw, bh);
      g.fillStyle = '#ffd27a';
      for (let k = 0; k < 10; k++) if (Math.random() < 0.55) { g.globalAlpha = 0.4 + Math.random() * 0.6; g.fillRect(x + 4 + Math.random() * (bw - 10), h - bh + 8 + Math.random() * (bh - 16), 3, 4); }
      g.globalAlpha = 1;
      if (Math.random() < 0.2) { g.fillStyle = '#ff5a6a'; g.fillRect(x + bw / 2 - 1, h - bh - 8, 3, 8); }
      x += bw + 3;
    }
  });
}
const deckTexture = () => canvasTexture(512, 512, (g, w, h) => {
  const s = w / 2;
  for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) {
    g.fillStyle = (x + y) % 2 ? '#2b3037' : '#252a31'; g.fillRect(x * s, y * s, s, s);
    g.fillStyle = lin(g, x * s, y * s, x * s + s, y * s + s, [[0, 'rgba(255,255,255,0.05)'], [1, 'rgba(0,0,0,0.1)']]); g.fillRect(x * s, y * s, s, s);
  }
  g.strokeStyle = 'rgba(214,172,92,0.35)'; g.lineWidth = 3;
  g.strokeRect(1.5, 1.5, w - 3, h - 3); g.beginPath(); g.moveTo(s, 0); g.lineTo(s, h); g.moveTo(0, s); g.lineTo(w, s); g.stroke();
}, true);
const hedgeTexture = () => canvasTexture(256, 128, (g, w, h) => {
  g.fillStyle = '#0e2a1c'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 700; i++) { g.fillStyle = ['#17402a', '#1d5233', '#0b2318', '#276040'][i % 4]; g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 2 + Math.random() * 4, 0, TAU); g.fill(); }
}, true);
const carpetTexture = () => canvasTexture(128, 512, (g, w, h) => {
  g.fillStyle = '#8c1128'; g.fillRect(0, 0, w, h);
  g.fillStyle = lin(g, 0, 0, w, 0, [[0, 'rgba(0,0,0,0.25)'], [0.5, 'rgba(255,255,255,0.08)'], [1, 'rgba(0,0,0,0.25)']]); g.fillRect(0, 0, w, h);
  g.strokeStyle = '#d9b05a'; g.lineWidth = 6; g.strokeRect(5, 0, w - 10, h);
  g.lineWidth = 2; g.strokeRect(14, -2, w - 28, h + 4);
});
const waterTexture = () => canvasTexture(256, 256, (g, w, h) => {
  g.fillStyle = lin(g, 0, 0, 0, h, [[0, '#0a6a86'], [1, '#12a3a8']]); g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(255,225,170,0.12)'; for (let i = 0; i < 8; i++) g.fillRect(Math.random() * w, 0, 3, h);
}, true);
const causticTexture = () => canvasTexture(256, 256, (g, w, h) => {
  g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(190,255,250,0.55)'; g.lineWidth = 2;
  for (let i = 0; i < 46; i++) { const x = Math.random() * w, y = Math.random() * h; g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + 18, y - 16, x + 36, y + 16, x + 58, y); g.stroke(); }
}, true);
function glassTexture() {
  return canvasTexture(2048, 400, (g, w, h) => {
    g.fillStyle = lin(g, 0, 0, 0, h, [[0, '#3a2012'], [0.5, '#c98640'], [1, '#f5cf8a']]); g.fillRect(0, 0, w, h);
    for (let i = 0; i < 13; i++) {
      const x = 80 + i * 150;
      g.fillStyle = rad(g, x, 70, 0, 95, [[0, 'rgba(255,240,200,0.95)'], [1, 'rgba(255,200,120,0)']]); g.fillRect(x - 95, 0, 190, 170);
      g.fillStyle = 'rgba(255,245,215,1)'; for (let k = 0; k < 7; k++) { const a = (k / 7) * TAU; g.fillRect(x + Math.cos(a) * 26 - 2, 70 + Math.sin(a) * 26 - 2, 4, 4); }
      g.fillStyle = 'rgba(52,26,14,0.9)'; g.fillRect(x - 55, h - 90, 110, 12);
      for (let k = -1; k <= 1; k++) { g.fillRect(x + k * 38 - 4, h - 120, 8, 30); g.fillStyle = '#ffe9b8'; g.fillRect(x + k * 38 - 2, h - 126, 4, 6); g.fillStyle = 'rgba(52,26,14,0.9)'; }
    }
    g.fillStyle = '#0c0d12'; for (let i = 0; i <= 26; i++) g.fillRect(i * 78.8 - 4, 0, 8, h);
    g.fillRect(0, h * 0.5 - 4, w, 8);
  });
}
function neonTexture(text, color) {
  return canvasTexture(1024, 160, (g, w, h) => {
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = 'bold 104px Georgia, serif';
    g.shadowColor = color; g.shadowBlur = 30; g.fillStyle = '#fff3d6';
    g.fillText(text, w / 2, h / 2 + 4); g.shadowBlur = 14; g.fillText(text, w / 2, h / 2 + 4);
  });
}
function signTexture(text, color) {
  return canvasTexture(512, 96, (g, w, h) => {
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = 'bold 54px Georgia, serif';
    g.shadowColor = color || '#ffcf6a'; g.shadowBlur = 18; g.fillStyle = '#fff0c4'; g.fillText(text, w / 2, h / 2 + 2);
  });
}
function labelTexture(text) {
  return canvasTexture(384, 96, (g, w, h) => {
    g.fillStyle = 'rgba(20,10,24,0.78)'; g.beginPath(); g.moveTo(40, 8); g.arcTo(w - 8, 8, w - 8, h - 8, 36); g.arcTo(w - 8, h - 8, 8, h - 8, 36); g.arcTo(8, h - 8, 8, 8, 36); g.arcTo(8, 8, w - 8, 8, 36); g.closePath(); g.fill();
    g.strokeStyle = '#e3b765'; g.lineWidth = 4; g.stroke();
    g.fillStyle = '#ffe7b0'; g.font = 'bold 40px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2 + 2);
  });
}
function shelfTexture() {
  return canvasTexture(256, 128, (g, w, h) => {
    g.fillStyle = lin(g, 0, 0, 0, h, [[0, '#4a2810'], [1, '#f1b765']]); g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(25,12,6,0.85)';
    for (const y of [40, 84]) { g.fillRect(0, y, w, 4); for (let i = 0; i < 14; i++) { const bh = 20 + (i * 7) % 10; g.fillRect(8 + i * 17, y - bh, 9, bh); g.fillRect(10 + i * 17, y - bh - 7, 5, 7); } }
  });
}
function workshopTexture() {
  return canvasTexture(128, 128, (g, w, h) => {
    g.fillStyle = lin(g, 0, 0, 0, h, [[0, '#3a2412'], [1, '#e0a65a']]); g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(30,16,8,0.7)'; g.fillRect(10, 50, 108, 5); g.fillRect(10, 92, 108, 5);
    for (const [x, y, rw, rh] of [[16, 28, 12, 22], [38, 32, 18, 18], [70, 26, 12, 24], [92, 30, 16, 20], [20, 70, 18, 22], [60, 72, 16, 20]]) g.fillRect(x, y, rw, rh);
  });
}
function slatsTexture() {
  return canvasTexture(128, 128, (g, w, h) => { g.fillStyle = '#2a2220'; g.fillRect(0, 0, w, h); for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? '#3a2e29' : '#31262a'; g.fillRect(i * 8, 0, 6, h); } }, true);
}
function rugTexture() {
  return canvasTexture(256, 192, (g, w, h) => {
    g.fillStyle = '#1b2230'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(214,172,92,0.8)'; g.lineWidth = 4; g.strokeRect(8, 8, w - 16, h - 16);
    g.lineWidth = 2; g.strokeRect(20, 20, w - 40, h - 40);
    g.strokeStyle = 'rgba(214,172,92,0.4)'; for (let i = 0; i < 8; i++) { g.beginPath(); g.arc(w / 2, h / 2, 14 + i * 9, 0, TAU); g.stroke(); }
  });
}

// ---------- how each conversation is arranged (local frame: +z points at the viewer, the focus is the table) ----------
const LAYOUTS = {
  bar: { pts: [[0, -1.5], [-0.62, -0.32], [0.55, -0.26]], focus: [0, -0.7] },                  // bartender behind, two at the counter
  lounge: { pts: [[-0.72, 0.0], [0, -0.34], [0.72, 0.0]], focus: [0, -0.1] },
  stage: { pts: [[-0.95, 0.0], [0, -0.14], [0.95, 0.0]], focus: [0, -0.1] },
  bistro: { pts: [[-0.54, -0.08], [0.54, -0.08]], focus: [0, -0.08] },
  tall: { pts: [[-0.86, -0.42], [-0.32, -0.95], [0.32, -0.95], [0.86, -0.42]], focus: [0, -0.3] }, // an arc behind the table
  door: { pts: [[-0.38, 0.0], [0.38, 0.1]], focus: [0, 0.05] },
};

export class GalaSystem extends createSystem({}) {
  init() {
    this.root = new Group();
    this.root.visible = false;
    this.addToScene(this.root);
    this.cx = 0; this.cz = 0; this.floorY = 0; this.theta = 0; this.cos = 1; this.sin = 0;
    this.last = performance.now();
    this.key = '';
    this.tex = {}; this.failed = new Set(); this.loading = new Set(); this.loader = new TextureLoader();
    this.actors = []; this.glows = []; this.finalists = []; this.host = null; this.markers = []; this.motes = []; this.bobs = [];
    this.waterA = null; this.waterB = null; this.doorHinge = null; this.trophy = null; this.fire = null; this.led = null;
    this.open = 0; this.lastCelebrate = 0; this.wasRevealed = false;
    this.glide = null; this.interior = null; this.finaleSpot = null; this.hostPath = null; this.hostT = 0; this.idc = 0; this.cool = 0; this.vig = null; this.avoid = []; this.cache = new Map(); this.ledT = 0; this.warnedRig = false;

    this.glowMap = glowTexture();
    this.softMap = softTexture();
    this.beamMap = beamTexture();
    this.shadowMat = new MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false, side: DoubleSide });
    this.bulbGeo = new SphereGeometry(0.035, 8, 6);
  }

  addToScene(obj) {
    const w = this.world;
    if (w && w.scene && w.scene.add) w.scene.add(obj);
    else w.createTransformEntity(obj);
  }

  // ---------- small building blocks (materials are shared by colour) ----------

  mat(color, o) {
    const k = 'm' + color + JSON.stringify(o || {});
    if (!this.cache.has(k)) this.cache.set(k, new MeshBasicMaterial({ color, ...(o || {}) }));
    return this.cache.get(k);
  }
  tmat(map, o) { return new MeshBasicMaterial({ map, ...(o || {}) }); }
  gmat(c0, c1) {
    const k = 'g' + c0 + c1;
    if (!this.cache.has(k)) this.cache.set(k, new MeshBasicMaterial({ map: vGrad(c0, c1) }));
    return this.cache.get(k);
  }
  addMat(color, opacity, map) {
    if (map && !map.__gid) map.__gid = ++this.idc;
    const k = 'a' + color + '|' + opacity + '|' + (map ? map.__gid : 0);
    if (!this.cache.has(k)) this.cache.set(k, new MeshBasicMaterial({ map: map || null, color, transparent: true, opacity, blending: AdditiveBlending, depthWrite: false, side: DoubleSide }));
    return this.cache.get(k);
  }
  box(w, h, d, m, x, y, z, parent) {
    const me = new Mesh(new BoxGeometry(w, h, d), typeof m === 'number' ? this.mat(m) : m);
    me.position.set(x, y, z); (parent || this.root).add(me); return me;
  }
  cyl(rt, rb, h, m, x, y, z, parent, seg) {
    const me = new Mesh(new CylinderGeometry(rt, rb, h, seg || 16), typeof m === 'number' ? this.mat(m) : m);
    me.position.set(x, y, z); (parent || this.root).add(me); return me;
  }
  plane(w, h, m, x, y, z, parent, rx, ry) {
    const me = new Mesh(new PlaneGeometry(w, h), m);
    me.position.set(x, y, z); if (rx) me.rotation.x = rx; if (ry) me.rotation.y = ry; (parent || this.root).add(me); return me;
  }
  // A soft glowing sprite that always faces you.
  glow(x, y, z, size, parent, color, opacity) {
    const m = new Mesh(new PlaneGeometry(size, size), this.addMat(color || 0xffb866, opacity === undefined ? 0.8 : opacity, this.glowMap));
    m.position.set(x, y, z); (parent || this.root).add(m); this.glows.push(m); return m;
  }
  // A pool of light on the floor.
  decal(x, z, size, color, opacity, parent) {
    return this.plane(size, size, this.addMat(color, opacity, this.softMap), x, 0.022, z, parent, -Math.PI / 2);
  }
  // A cone of light (stage lamps, the plinth spot).
  cone(x, y, z, rTop, rBot, h, color, op, parent, tx, tz) {
    const c = new Mesh(new CylinderGeometry(rTop, rBot, h, 18, 1, true), this.addMat(color, op, this.beamMap));
    c.position.set(x, y, z); if (tx) c.rotation.z = tx; if (tz) c.rotation.x = tz; (parent || this.root).add(c); return c;
  }
  toWorld(lx, lz) { return [this.cx + lx * this.cos + lz * this.sin, this.cz - lx * this.sin + lz * this.cos]; }

  // ---------- pictures ----------

  imageList(cs) { return cs.images.map((k) => [k, (cs.art || '') + k + '.png']); }
  ensureImages(list) {
    for (const [k, url] of list) {
      if (this.tex[k] || this.loading.has(k)) continue;
      this.loading.add(k);
      this.loader.load(url, (t) => { t.colorSpace = SRGBColorSpace; this.tex[k] = t; }, undefined,
        () => { this.failed.add(k); console.warn('Earshot: could not load ' + url); });
    }
  }
  aspect(tex) { return tex && tex.image && tex.image.height ? tex.image.width / tex.image.height : 0.34; }

  makeFigure(name, x, z, h, lift, face, turn) {
    const closed = this.tex[name];
    if (!closed) return null;
    const real = (window.earshotCase && window.earshotCase.heights && window.earshotCase.heights[name]) || 1.72;
    h = h * real / 1.72;                                   // tall people look tall
    const talk = this.tex[name + '-talk'] || closed;
    const geom = new PlaneGeometry(1, 1);
    geom.translate(0, 0.5, 0);
    const material = new MeshBasicMaterial({ map: closed, color: 0xd9ccbb, transparent: true, alphaTest: 0.02, side: DoubleSide });
    const mesh = new Mesh(geom, material);
    mesh.renderOrder = 2;
    const a = this.aspect(closed);
    mesh.scale.set(h * a, h, 1);
    const shadow = new Mesh(new PlaneGeometry(1, 1), this.shadowMat);
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.012; shadow.scale.set(Math.max(0.7, h * a * 1.5), 0.5, 1); shadow.renderOrder = 1;
    const g = new Group();
    g.add(shadow, mesh);
    g.position.set(x, lift || 0, z);
    this.root.add(g);
    return { name, g, mesh, material, closed, talk, h, lift: lift || 0, phase: Math.random() * 6.28, vis: 1, face: face || null, turn: turn === undefined ? 1.05 : turn, walk: false };
  }

  // Each guest turns toward the person they are talking with, but never so far that the flat picture goes edge-on to you.
  animate(f, t, lx, lz, speaking, level) {
    const amp = Math.min(0.7, level * 8);
    const yv = Math.atan2(lx - f.g.position.x, lz - f.g.position.z);
    let yaw = yv;
    if (f.face) {
      const d = Math.max(-f.turn, Math.min(f.turn, wrapPI(Math.atan2(f.face[0], f.face[1]) - yv)));
      yaw = yv + d;
    }
    f.g.rotation.y = yaw;
    f.g.rotation.z = Math.sin(t * 2.2 + f.phase) * 0.012 + (speaking ? Math.sin(t * 5 + f.phase) * 0.025 * amp : 0);
    f.g.position.y = f.lift + (f.walk ? Math.abs(Math.sin(t * 7)) * 0.03 : 0) + (speaking ? Math.abs(Math.sin(t * 6 + f.phase)) * 0.012 * amp : 0);
    const open = speaking && level > 0.04 && Math.sin(t * 16 + f.phase) > -0.1;
    const tx = open ? f.talk : f.closed;
    if (f.material.map !== tx) f.material.map = tx;
    f.material.color.setHex(speaking ? 0xffffff : 0xd9ccbb);
  }

  clear() {
    while (this.root.children.length) this.root.remove(this.root.children[0]);
    this.actors = []; this.glows = []; this.finalists = []; this.host = null; this.markers = []; this.motes = []; this.bobs = [];
    this.waterA = null; this.waterB = null; this.doorHinge = null; this.trophy = null; this.fire = null; this.led = null;
    this.open = 0; this.avoid = []; this.glide = null; this.interior = null; this.finaleSpot = null; this.hostPath = null; this.hostT = 0;
  }

  // ---------- the world ----------

  build(cs, layout) {
    this.clear();
    const fwd = window.earshotForward;
    if (!fwd || !layout || !layout.length) return;
    const fl = Math.hypot(fwd[0], fwd[1]) || 1;
    this.theta = Math.atan2(-fwd[0] / fl, -fwd[1] / fl);
    this.cos = Math.cos(this.theta); this.sin = Math.sin(this.theta);
    // Pin the scenery to the sound: group 0 must sit exactly where its audio was placed.
    const a0 = cs.groups[0].at;
    this.cx = layout[0].x - (a0[0] * this.cos + a0[1] * this.sin);
    this.cz = layout[0].z - (-a0[0] * this.sin + a0[1] * this.cos);
    this.root.rotation.y = this.theta;
    this.root.position.set(this.cx, this.floorY, this.cz);

    this.buildSky();
    this.buildCourtyard();
    this.buildPavilion();
    this.buildPool();
    this.buildLights();
    this.addPlinth(3.8, -12.0);
    this.addPoolHouse(9.6, -10.4);
    this.avoid.push([3.8, -12.0, 1.0], [9.6, -10.4, 2.0]);

    cs.groups.forEach((gr, i) => this.buildGroup(cs, gr, i));
    if (cs.host && cs.hostAt) this.host = this.makeFigure(cs.host, cs.hostAt[0], cs.hostAt[1], FIG_H, 0, null, 0.2);
    for (const a of (cs.finale && cs.finale.appear) || []) {
      const f = this.makeFigure(a.name, a.x, a.z, FIG_H, 0, null, 0.2);
      if (f) { f.vis = 0; f.g.visible = false; f.material.opacity = 0; this.finalists.push(f); }
    }
    const fin = cs.finale || {};
    this.hostPath = this.host && fin.hostPath ? [cs.hostAt, ...fin.hostPath] : null;
    this.hostT = 0;
    if (fin.appear && fin.appear[0]) {
      const a = fin.appear[0];
      const sp = new Group(); sp.position.set(a.x, 0, a.z); sp.visible = false; this.root.add(sp);
      this.cone(0, 2.9, 0, 0.1, 0.95, 5.8, 0xfff2d0, 0.5, sp);
      this.decal(0, 0, 2.8, 0xfff2d0, 0.6, sp);
      this.glow(0, 1.0, 0, 1.6, sp, 0xffe6b0, 0.45);
      this.finaleSpot = sp;
    }
    this.buildMarkers(cs);
    this.buildMotes();
    window.earshotBuilt = cs.id;
  }

  buildSky() {
    const R = this.root;
    const sky = new Mesh(new SphereGeometry(70, 32, 16), new MeshBasicMaterial({ map: skyTexture(), side: BackSide, depthWrite: false }));
    sky.renderOrder = -20; R.add(sky);
    const sk = new Mesh(new CylinderGeometry(48, 48, 12, 48, 1, true), new MeshBasicMaterial({ map: skylineTexture(), transparent: true, side: BackSide, depthWrite: false }));
    sk.position.y = 4.5; sk.renderOrder = -19; R.add(sk);
  }

  buildCourtyard() {
    const R = this.root;
    const deck = new Mesh(new PlaneGeometry(26.4, 24.4), this.tmat(deckTexture()));
    deck.material.map.repeat.set(13, 12);
    deck.rotation.x = -Math.PI / 2; deck.position.set(0, 0, -4.9); R.add(deck);

    // Red carpet from your feet to the pool, with gold posts and rope.
    const carpet = this.plane(2.3, 5.6, this.tmat(carpetTexture()), 0, 0.012, -0.7, R, -Math.PI / 2);
    void carpet;
    for (const s of [-1, 1]) for (let k = 0; k < 4; k++) {
      const z = 1.8 - k * 1.6;
      this.cyl(0.035, 0.05, 0.9, this.mat(0xd9b05a), s * 1.45, 0.45, z, R, 10);
      this.glow(s * 1.45, 0.95, z, 0.28, R, 0xffd98a, 0.7);
      if (k < 3) this.box(0.03, 0.03, 1.6, this.mat(0x7d1126), s * 1.45, 0.78, z - 0.8, R);
    }

    // Hedge walls, with warm uplights at their feet, and trees behind them.
    const hedge = (w, d, x, z) => {
      const m = this.tmat(hedgeTexture()); m.map.repeat.set(Math.max(1, Math.round(w / 3)), 1);
      this.box(w, 1.9, d, m, x, 0.95, z, R);
    };
    hedge(0.9, 24.4, -13.2, -4.9); hedge(0.9, 24.4, 13.2, -4.9); hedge(26.4, 0.9, 0, 7.2);
    for (let k = 0; k < 9; k++) {
      const z = -15 + k * 2.6;
      this.glow(-12.6, 0.3, z, 1.3, R, 0xffb866, 0.45); this.glow(12.6, 0.3, z, 1.3, R, 0xffb866, 0.45);
      if (k % 2 === 0) { this.tree(-14.8, z + 0.6); this.tree(14.8, z + 0.6); }
    }
    for (let k = 0; k < 5; k++) this.tree(-11 + k * 5.5, 8.4);
    // The gate behind you.
    for (const s of [-1, 1]) { this.box(0.5, 3.4, 0.5, this.gmat('#1b1d24', '#4a4036'), s * 1.9, 1.7, 7.0, R); this.glow(s * 1.9, 3.5, 6.7, 1.1, R, 0xffd98a, 0.8); }
    this.box(4.3, 0.3, 0.5, this.mat(0x1b1d24), 0, 3.55, 7.0, R);
    this.plane(3.4, 0.64, this.tmat(signTexture('WELCOME', '#ffcf6a'), { transparent: true }), 0, 3.15, 6.7, R, 0, Math.PI);
  }

  tree(x, z) {
    const R = this.root;
    this.cyl(0.12, 0.2, 2.6, this.mat(0x1b130d), x, 1.3, z, R, 8);
    const leaf = this.mat(0x143d27);
    for (const [dx, dy, dz, r] of [[0, 3.1, 0, 1.25], [0.7, 2.6, 0.3, 0.95], [-0.7, 2.7, -0.2, 1.0], [0.1, 3.8, 0.1, 0.8]]) {
      const s = new Mesh(new SphereGeometry(r, 10, 8), leaf); s.position.set(x + dx, dy, z + dz); R.add(s);
    }
    this.glow(x, 0.5, z + 0.5, 1.6, R, 0xffa850, 0.4);
  }

  buildPavilion() {
    const R = this.root;
    // Glowing glass ground floor, a dark upper storey, slim bronze columns and a lit canopy.
    this.plane(26, 5.0, this.tmat(glassTexture()), 0, 2.5, -16.9, R);
    this.box(26, 4.2, 0.6, this.gmat('#0e0f15', '#1b1d27'), 0, 7.5, -17.3, R);
    this.plane(26, 3.4, this.addMat(0x6fb6ff, 0.16), 0, 7.4, -16.95, R);
    for (let i = -6; i <= 6; i++) {
      this.cyl(0.14, 0.16, 5.0, this.gmat('#2b2118', '#a37840'), i * 2.0, 2.5, -16.0, R, 12);
      this.box(0.34, 0.08, 0.34, this.mat(0xd9b05a), i * 2.0, 0.5, -16.0, R);
    }
    this.box(26.4, 0.4, 3.0, this.mat(0x15171e), 0, 5.2, -15.5, R);
    this.plane(26, 0.2, this.addMat(0xffc27a, 0.85), 0, 4.98, -14.1, R, Math.PI / 2);   // warm light strip under the canopy
    this.glow(0, 4.8, -14.5, 9, R, 0xffb866, 0.28);
    this.box(26.4, 0.08, 0.1, this.mat(0xff5fa8), 0, 5.42, -14.0, R);                   // pink edge
    // Neon sign and the waveform emblem.
    this.plane(11, 1.72, this.tmat(neonTexture('LUMEN AWARDS', '#ff5fa8'), { transparent: true, depthWrite: false }), 0, 7.6, -16.9, R);
    this.glow(0, 7.6, -16.7, 13, R, 0xff5fa8, 0.2);
    for (let i = 0; i < 17; i++) {
      const hgt = 0.25 + Math.abs(Math.sin(i * 0.9)) * 0.9 + (i === 8 ? 0.7 : 0);
      this.box(0.1, hgt, 0.06, this.mat(0xffd27a), -2.4 + i * 0.3, 6.2, -16.85, R);
    }
    // Interior chandelier glows behind the glass.
    for (let i = -5; i <= 5; i += 2) this.glow(i * 2.2, 3.7, -16.7, 2.2, R, 0xffd9a0, 0.5);
    // Warm light spilling onto the deck, and the building reflected in the water.
    this.decal(0, -13.5, 24, 0xffa850, 0.2, R);
    // Stage lights and speaker stacks are built with the stage group.
  }

  buildPool() {
    const R = this.root;
    const PX = 0, PZ = -7.5, W = 6.4, D = 6.2;
    const rim = this.mat(0xdde1e0);
    this.box(W + 0.9, 0.08, 0.45, rim, PX, 0.04, PZ + D / 2 + 0.22, R);
    this.box(W + 0.9, 0.08, 0.45, rim, PX, 0.04, PZ - D / 2 - 0.22, R);
    this.box(0.45, 0.08, D, rim, PX - W / 2 - 0.22, 0.04, PZ, R);
    this.box(0.45, 0.08, D, rim, PX + W / 2 + 0.22, 0.04, PZ, R);
    const base = this.tmat(waterTexture()); base.map.repeat.set(2, 2); this.waterA = base.map;
    this.plane(W, D, base, PX, 0.03, PZ, R, -Math.PI / 2);
    const cm = this.addMat(0xbdfff4, 0.5, causticTexture()); cm.map.repeat.set(2, 2); this.waterB = cm.map;
    this.plane(W, D, cm, PX, 0.04, PZ, R, -Math.PI / 2);
    // Underwater lights and a glowing edge.
    for (const [x, z] of [[-2.2, -5.5], [2.2, -5.5], [-2.2, -9.5], [2.2, -9.5], [0, -7.5]]) this.plane(2.6, 2.6, this.addMat(0x39e0d0, 0.55, this.glowMap), x, 0.05, z, R, -Math.PI / 2);
    this.plane(W, 0.14, this.addMat(0x6af0e4, 0.7), PX, 0.05, PZ + D / 2 - 0.07, R, -Math.PI / 2);
    this.plane(W, 0.14, this.addMat(0x6af0e4, 0.7), PX, 0.05, PZ - D / 2 + 0.07, R, -Math.PI / 2);
    // The lit building, reflected in the far end of the water.
    this.plane(W, 3.0, this.addMat(0xffb060, 0.2, this.beamMap), PX, 0.06, PZ - D / 2 + 1.6, R, -Math.PI / 2);
    // Floating candles.
    for (let i = 0; i < 14; i++) {
      const x = PX + (Math.random() - 0.5) * (W - 0.8), z = PZ + (Math.random() - 0.5) * (D - 0.8);
      const c = this.cyl(0.07, 0.07, 0.04, this.mat(0xfff1d0), x, 0.06, z, R, 10);
      const gl = this.glow(x, 0.16, z, 0.5, R, 0xffc878, 0.85);
      this.bobs.push({ a: c, b: gl, y: 0.06, ph: Math.random() * 6.28 });
    }
  }

  buildLights() {
    const R = this.root;
    // Three spans of string lights across the courtyard.
    for (const z of [-11.5, -5.5, 0.8]) {
      for (const s of [-1, 1]) this.cyl(0.03, 0.03, 3.7, this.mat(0x1a1a1a), s * 12.2, 1.85, z, R, 6);
      for (let k = 0; k < 24; k++) {
        const f = k / 23;
        const x = -12.2 + 24.4 * f, y = 3.6 - 0.55 * Math.sin(Math.PI * f);
        if (k % 2 === 0) { const b = new Mesh(this.bulbGeo, this.mat(0xffe2a8)); b.position.set(x, y, z); R.add(b); this.glow(x, y, z, 0.42, R, 0xffc878, 0.6); }
      }
    }
    // Lanterns along the walls.
    for (const s of [-1, 1]) for (let k = 0; k < 5; k++) {
      const z = -13 + k * 4.4;
      this.cyl(0.04, 0.04, 2.4, this.mat(0x1a1a1a), s * 12.5, 1.2, z, R, 6);
      this.box(0.22, 0.3, 0.22, this.mat(0xffe2a8), s * 12.5, 2.55, z, R);
      this.glow(s * 12.5, 2.55, z, 1.2, R, 0xffc070, 0.7);
    }
    // A few ambient tables with candles, away from the conversations.
    for (const [x, z] of [[-9.6, -3.2], [9.2, 0.6], [-9.8, -7.8], [8.6, -14.2], [-1.0, 3.8]]) this.cocktailTable(x, z, 0.9, R);
  }

  cocktailTable(x, z, s, parent) {
    const g = new Group(); g.position.set(x, 0, z); (parent || this.root).add(g);
    this.cyl(0.3 * s, 0.3 * s, 0.03, this.mat(0x15171c), 0, 0.02, 0, g, 18);
    this.cyl(0.035, 0.035, 1.0, this.gmat('#c9a24f', '#6d5528'), 0, 0.52, 0, g, 8);
    this.cyl(0.4 * s, 0.4 * s, 0.04, this.mat(0xf3eee2), 0, 1.04, 0, g, 22);
    this.cyl(0.4 * s, 0.4 * s, 0.015, this.mat(0xc9a24f), 0, 1.02, 0, g, 22);
    this.cyl(0.018, 0.018, 0.1, this.mat(0xfff1cf), 0, 1.11, 0, g, 8);
    this.glow(0, 1.2, 0, 0.7, g, 0xffc878, 0.8);
    for (const a of [0.8, 2.3, 4.0]) this.cyl(0.02, 0.014, 0.11, this.mat(0xe8f0f2, { transparent: true, opacity: 0.8 }), Math.cos(a) * 0.22, 1.1, Math.sin(a) * 0.22, g, 8);
    return g;
  }

  addPlinth(x, z) {
    const g = new Group(); g.position.set(x, 0, z); this.root.add(g);
    this.cyl(0.55, 0.6, 0.08, this.mat(0x23232b), 0, 0.04, 0, g, 24);
    this.box(0.5, 1.0, 0.5, this.gmat('#f2eee6', '#a59f93'), 0, 0.58, 0, g);
    this.box(0.56, 0.05, 0.56, this.mat(0xd9b05a), 0, 1.1, 0, g);
    this.cyl(0.21, 0.21, 0.06, this.mat(0x7a1f2e), 0, 1.16, 0, g, 20);
    this.plane(0.4, 0.09, this.tmat(signTexture('ARTIST OF THE YEAR', '#ffcf6a'), { transparent: true }), 0, 0.62, 0.26, g);
    this.cone(0, 3.2, 0, 0.1, 0.85, 4.2, 0xfff0c8, 0.5, g);
    this.glow(0, 1.2, 0, 1.0, g, 0xffe6b0, 0.9);
    this.decal(0, 0, 3.0, 0xffe6b0, 0.55, g);
  }

  addPoolHouse(x, z) {
    const g = new Group(); g.position.set(x, 0, z); g.rotation.y = -Math.PI / 2; this.root.add(g);   // its front faces the pool
    const slats = this.tmat(slatsTexture()); slats.map.repeat.set(2, 1);
    this.box(2.8, 2.7, 2.3, slats, 0, 1.35, 0, g);
    this.box(3.3, 0.14, 2.9, this.mat(0x0f1115), 0, 2.78, 0.1, g);
    this.plane(3.3, 0.06, this.addMat(0xffc27a, 0.9), 0, 2.69, 1.56, g);
    this.box(3.4, 0.1, 1.0, this.mat(0x2b2f36), 0, 0.05, 1.6, g);                                   // deck in front
    this.plane(1.7, 1.7, this.tmat(workshopTexture()), -0.55, 1.35, 1.16, g);                          // lit workshop window
    this.box(1.8, 0.07, 0.07, this.mat(0x15171c), -0.55, 2.22, 1.17, g);
    this.interior = this.plane(0.85, 1.95, new MeshBasicMaterial({ color: 0xffc880, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, side: DoubleSide }), 0.78, 1.05, 1.13, g);
    const hinge = new Group(); hinge.position.set(0.35, 1.05, 1.18); g.add(hinge);
    const leafGeo = new PlaneGeometry(0.85, 2.0); leafGeo.translate(0.425, 0, 0);
    hinge.add(new Mesh(leafGeo, this.mat(0x3a4650, { side: DoubleSide })));
    this.doorHinge = hinge;
    this.plane(1.9, 0.36, this.tmat(signTexture('POOL HOUSE', '#6af0e4'), { transparent: true }), 0, 2.45, 1.18, g);
    this.glow(0, 1.2, 1.6, 3.0, g, 0xffb35a, 0.5);
    for (const s of [-1, 1]) { this.cyl(0.03, 0.03, 1.4, this.mat(0x1a1a1a), s * 2.7, 0.7, 1.7, g, 6); this.glow(s * 2.7, 1.45, 1.7, 0.7, g, 0xffc878, 0.8); }
    const tr = new Group(); tr.position.set(0.78, 1.05, 1.5);
    this.cyl(0.13, 0.15, 0.05, this.mat(0xc9a24f), 0, -0.22, 0, tr, 14);
    this.cyl(0.03, 0.04, 0.22, this.mat(0xd9b45a), 0, -0.08, 0, tr, 10);
    this.cyl(0.16, 0.05, 0.26, this.mat(0xf2c14e), 0, 0.1, 0, tr, 16);
    const gl = this.glow(0, 0.05, 0.1, 1.1, tr, 0xffe08a, 0.9); void gl;
    tr.visible = false; g.add(tr); this.trophy = tr;
  }

  // ---------- one conversation: a lit set, with its people arranged naturally ----------

  buildGroup(cs, gr, i) {
    const [gx, gz] = gr.at;
    const stop = (cs.stops || []).find((s) => s.group === i);
    const phi = gr.rot !== undefined ? gr.rot : stop ? Math.atan2(stop.at[0] - gx, stop.at[1] - gz) : 0;
    const lay = LAYOUTS[gr.setting] || LAYOUTS.bistro;
    const cp = Math.cos(phi), sp = Math.sin(phi);
    const lw = (lx, lz) => [gx + lx * cp + lz * sp, gz - lx * sp + lz * cp];

    const g = new Group(); g.position.set(gx, 0, gz); g.rotation.y = phi; this.root.add(g);
    this.decal(0, 0, gr.setting === 'stage' ? 7 : 4.6, 0xffd29a, 0.42, g);
    this.addProps(gr, g);
    this.avoid.push([gx, gz, gr.setting === 'stage' ? 2.4 : 1.7]);

    const focus = lw(lay.focus[0], lay.focus[1]);
    gr.members.forEach((name, j) => {
      const p = lay.pts[j] || [j * 0.7, 0.2];
      const [wx, wz] = lw(p[0], p[1]);
      let fx = focus[0] - wx, fz = focus[1] - wz;
      const fl = Math.hypot(fx, fz);
      const face = fl > 0.12 ? [fx / fl, fz / fl] : null;
      const f = this.makeFigure(name, wx, wz, FIG_H, gr.lift || 0, face);
      if (f) this.actors.push({ fig: f, gi: i, idx: j });
    });
  }

  armchair(parent, x, z, ry, c0, c1) {
    const a = new Group(); a.position.set(x, 0, z); a.rotation.y = ry; parent.add(a);
    const fab = this.gmat(c0, c1);
    this.box(0.8, 0.16, 0.76, fab, 0, 0.3, 0, a);
    this.box(0.62, 0.15, 0.6, this.gmat(c0, c1), 0, 0.46, 0.05, a);
    const back = this.box(0.8, 0.5, 0.15, fab, 0, 0.68, -0.34, a); back.rotation.x = -0.14;
    for (const s of [-1, 1]) this.box(0.13, 0.32, 0.72, fab, s * 0.4, 0.5, 0, a);
    for (const [lx, lz] of [[-0.32, -0.3], [0.32, -0.3], [-0.32, 0.3], [0.32, 0.3]]) this.cyl(0.02, 0.014, 0.22, this.mat(0xd9b05a), lx, 0.11, lz, a, 8);
    return a;
  }

  sofa(parent, x, z, w, c0, c1) {
    const a = new Group(); a.position.set(x, 0, z); parent.add(a);
    const fab = this.gmat(c0, c1);
    this.box(w, 0.2, 0.94, fab, 0, 0.3, 0, a);
    const n = 3, cw = (w - 0.5) / n;
    for (let k = 0; k < n; k++) {
      const cx = -((n - 1) / 2) * (cw + 0.02) + k * (cw + 0.02);
      this.box(cw, 0.17, 0.72, this.gmat(c0, c1), cx, 0.5, 0.06, a);
      const bk = this.box(cw, 0.5, 0.17, this.gmat(c0, c1), cx, 0.78, -0.38, a); bk.rotation.x = -0.14;
    }
    for (const s of [-1, 1]) this.box(0.24, 0.52, 0.94, fab, s * (w / 2 - 0.12), 0.5, 0, a);
    this.box(w, 0.025, 0.03, this.mat(0xd9b05a), 0, 0.2, 0.47, a);
    for (const [lx, c] of [[-0.8, 0xe3b04a], [0.85, 0xe8a5b0]]) { const p = this.box(0.34, 0.3, 0.1, this.mat(c), lx, 0.78, -0.2, a); p.rotation.z = lx < 0 ? 0.25 : -0.25; p.rotation.x = -0.2; }
    for (const lx of [-w / 2 + 0.1, w / 2 - 0.1]) for (const lz of [-0.4, 0.4]) this.cyl(0.02, 0.014, 0.2, this.mat(0xd9b05a), lx, 0.1, lz, a, 8);
    return a;
  }

  cafeChair(parent, x, z, ry) {
    const a = new Group(); a.position.set(x, 0, z); a.rotation.y = ry; parent.add(a);
    const wood = this.mat(0x4a3526);
    this.box(0.42, 0.04, 0.42, wood, 0, 0.46, 0, a);
    this.box(0.42, 0.46, 0.04, wood, 0, 0.7, -0.2, a);
    for (const [lx, lz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) this.cyl(0.015, 0.012, 0.46, this.mat(0x2a1f17), lx, 0.23, lz, a, 6);
    return a;
  }

  addProps(gr, g) {
    switch (gr.setting) {
      case 'bar': {
        const wood = this.tmat(slatsTexture()); wood.map.repeat.set(3, 1);
        this.box(3.6, 1.06, 0.6, wood, 0, 0.53, -0.95, g);
        this.box(3.7, 0.06, 0.78, this.mat(0xe3ddd0), 0, 1.09, -0.95, g);
        this.plane(3.5, 0.06, this.addMat(0xffb35a, 0.9), 0, 0.08, -0.64, g, -Math.PI / 2);
        // The drinks: a row of glasses, bottles, a shaker and a bowl of lemons.
        const glass = this.mat(0xe8f2f0, { transparent: true, opacity: 0.8 });
        for (let k = 0; k < 6; k++) this.cyl(0.032, 0.026, 0.12, glass, -1.35 + k * 0.17, 1.18, -0.82, g, 10);
        for (const [x, c] of [[0.7, 0x2c7a4a], [0.86, 0xb5651d], [1.02, 0x8a1f2e], [1.18, 0x2c7a4a]]) { this.cyl(0.04, 0.045, 0.26, this.mat(c), x, 1.25, -1.1, g, 10); this.cyl(0.017, 0.02, 0.1, this.mat(c), x, 1.43, -1.1, g, 8); }
        this.cyl(0.045, 0.05, 0.2, this.mat(0xc9ced6), -0.35, 1.2, -1.05, g, 10);
        this.cyl(0.14, 0.1, 0.07, this.mat(0xf3eee2), 0.25, 1.15, -0.9, g, 14);
        for (const [x, z] of [[0.2, -0.9], [0.3, -0.88], [0.25, -0.82]]) { const l = new Mesh(new SphereGeometry(0.035, 8, 6), this.mat(0xffd23a)); l.position.set(x, 1.2, z); g.add(l); }
        this.box(3.6, 2.2, 0.3, this.mat(0x14161b), 0, 1.1, -2.2, g);
        this.plane(3.3, 1.65, this.tmat(shelfTexture()), 0, 1.35, -2.04, g);
        this.glow(0, 1.4, -1.9, 3.6, g, 0xffb35a, 0.4);
        // A little pergola with three hanging lamps.
        for (const s of [-1, 1]) this.cyl(0.03, 0.03, 2.6, this.mat(0x1a1a1a), s * 1.9, 1.3, -0.95, g, 6);
        this.box(3.9, 0.07, 0.1, this.mat(0x1a1a1a), 0, 2.6, -0.95, g);
        for (const x of [-1.0, 0, 1.0]) {
          this.cyl(0.006, 0.006, 0.55, this.mat(0x222222), x, 2.32, -0.95, g, 4);
          this.cyl(0.04, 0.17, 0.2, this.mat(0xd9b05a), x, 1.95, -0.95, g, 14);
          this.glow(x, 1.85, -0.95, 0.9, g, 0xffd9a0, 0.85);
        }
        for (const x of [-2.1, 2.1]) { this.cyl(0.03, 0.03, 0.75, this.mat(0xc9a24f), x, 0.4, -0.2, g, 8); this.cyl(0.2, 0.2, 0.06, this.mat(0x7a1f2e), x, 0.78, -0.2, g, 14); }
        break;
      }
      case 'lounge': {
        this.plane(3.8, 2.8, this.tmat(rugTexture()), 0, 0.02, 0, g, -Math.PI / 2);
        this.sofa(g, 0, -1.25, 3.0, '#3a8590', '#1b4650');
        this.armchair(g, 2.05, -0.15, -Math.PI / 2, '#c27688', '#7a3a4a');
        this.armchair(g, -2.05, -0.15, Math.PI / 2, '#c27688', '#7a3a4a');
        this.cyl(0.5, 0.5, 0.34, this.mat(0x1d1d22), 0, 0.19, 0.55, g, 24);
        this.cyl(0.54, 0.54, 0.03, this.mat(0xc9a24f), 0, 0.38, 0.55, g, 24);
        this.cyl(0.03, 0.03, 0.12, this.mat(0xe8f0f2, { transparent: true, opacity: 0.85 }), 0.1, 0.45, 0.5, g, 8);
        this.glow(0, 0.55, 0.55, 0.7, g, 0xffc878, 0.7);
        // (The floor lamp was removed: the host walks through here at the finale. The warm light now comes from the table.)
        this.glow(0, 0.9, -0.4, 2.6, g, 0xffd9a0, 0.35);
        this.cyl(0.2, 0.15, 0.4, this.mat(0x2b2f36), 2.4, 0.2, -1.6, g, 12);
        for (const [dx, dy, r] of [[0, 0.7, 0.35], [0.2, 0.55, 0.25], [-0.2, 0.6, 0.26]]) { const s = new Mesh(new SphereGeometry(r, 8, 6), this.mat(0x1d5233)); s.position.set(2.4 + dx, 0.5 + dy, -1.6); g.add(s); }
        break;
      }
      case 'stage': {
        this.box(6.8, 0.2, 2.8, this.gmat('#3a2a22', '#1e1511'), 0, 0.1, -0.35, g);
        this.box(6.8, 0.03, 0.05, this.mat(0xd9b05a), 0, 0.21, 1.03, g);
        this.plane(6.8, 0.08, this.addMat(0x6af0e4, 0.9), 0, 0.06, 1.06, g, -Math.PI / 2);
        // The LED wall: it moves with the voices.
        const cv = document.createElement('canvas'); cv.width = 512; cv.height = 256;
        const tex = new CanvasTexture(cv); tex.colorSpace = SRGBColorSpace;
        this.led = { ctx: cv.getContext('2d'), tex };
        this.box(5.8, 3.3, 0.12, this.mat(0x0b0c10), 0, 2.2, -1.78, g);
        this.plane(5.5, 3.0, new MeshBasicMaterial({ map: tex }), 0, 2.2, -1.7, g);
        this.glow(0, 2.2, -1.2, 8, g, 0xc77dff, 0.16);
        // Truss, stage lamps and their beams.
        this.box(6.9, 0.12, 0.12, this.mat(0x20232b), 0, 4.95, 0.3, g);
        for (const s of [-1, 1]) this.box(0.1, 4.95, 0.1, this.mat(0x20232b), s * 3.45, 2.5, 0.3, g);
        const cols = [0xff5fa8, 0xffd27a, 0x6af0e4, 0xffd27a, 0xff5fa8];
        for (let k = 0; k < 5; k++) {
          const x = -2.6 + k * 1.3;
          this.cyl(0.12, 0.16, 0.3, this.mat(0x111216), x, 4.8, 0.3, g, 10);
          this.cone(x, 2.5, 0.5, 0.08, 0.65, 4.7, cols[k], 0.32, g);
          this.glow(x, 4.65, 0.3, 0.6, g, cols[k], 0.9);
        }
        for (const s of [-1, 1]) { this.box(0.7, 1.5, 0.6, this.mat(0x101114), s * 3.6, 0.75, -0.4, g); this.cyl(0.22, 0.22, 0.04, this.mat(0x2a2c33), s * 3.6, 0.95, -0.09, g, 16).rotation.x = Math.PI / 2; }
        for (const x of [-0.95, 0, 0.95]) { this.cyl(0.012, 0.012, 0.95, this.mat(0x222222), x - 0.5, 0.7, 0.35, g, 5); this.box(0.34, 0.24, 0.02, this.mat(0xf4efe2), x - 0.5, 1.25, 0.35, g); }
        break;
      }
      case 'bistro': {
        this.cyl(0.46, 0.46, 0.04, this.mat(0xf1ece0), 0, 0.77, -0.08, g, 24);
        this.cyl(0.04, 0.04, 0.74, this.mat(0x222222), 0, 0.38, -0.08, g, 8);
        this.cyl(0.26, 0.26, 0.03, this.mat(0x222222), 0, 0.02, -0.08, g, 16);
        for (const a of [0.8, 2.6]) this.cyl(0.026, 0.018, 0.14, this.mat(0xe8f0f2, { transparent: true, opacity: 0.85 }), Math.cos(a) * 0.2, 0.86, -0.08 + Math.sin(a) * 0.2, g, 8);
        this.cyl(0.02, 0.02, 0.09, this.mat(0xfff1cf), 0, 0.84, -0.08, g, 8);
        this.glow(0, 0.98, -0.08, 0.8, g, 0xffc878, 0.85);
        this.cafeChair(g, -0.5, -1.0, 0); this.cafeChair(g, 0.5, -1.0, 0);
        for (let k = 0; k < 12; k += 2) { const a = (k / 12) * TAU; const x = Math.cos(a) * 1.4, z = -0.08 + Math.sin(a) * 1.4; const b = new Mesh(this.bulbGeo, this.mat(0xffe2a8)); b.position.set(x, 2.4, z); g.add(b); this.glow(x, 2.4, z, 0.4, g, 0xffc878, 0.7); }
        break;
      }
      case 'tall': {
        this.cocktailTable(0, -0.3, 1.0, g);
        break;
      }
      case 'door': {
        // A small, calm doorway: a dark wall, a teal-green light panel and soft neon edges.
        this.box(3.4, 3.0, 0.22, this.gmat('#252f31', '#141a1c'), 0, 1.5, -1.4, g);
        this.box(1.5, 2.5, 0.1, this.mat(0x0c0d11), 0, 1.25, -1.27, g);
        this.plane(1.25, 2.35, this.gmat('#1f7a55', '#0b3a29'), 0, 1.22, -1.21, g);
        this.plane(1.4, 2.5, this.addMat(0x68e8a0, 0.14, this.softMap), 0, 1.25, -1.19, g);
        for (const s of [-1, 1]) this.plane(0.05, 2.5, this.addMat(0x68e8a0, 0.55), s * 0.7, 1.25, -1.2, g);
        this.plane(1.7, 0.3, this.tmat(signTexture('GREEN ROOM', '#68e8a0'), { transparent: true }), 0, 2.7, -1.27, g);
        this.decal(0, -0.4, 2.8, 0x68e8a0, 0.16, g);
        for (const s of [-1, 1]) this.cyl(0.035, 0.05, 0.9, this.mat(0xd9b05a), s * 0.85, 0.45, -0.6, g, 10);
        this.box(1.7, 0.03, 0.03, this.mat(0x7d1126), 0, 0.8, -0.6, g);
        for (const [x, z, w] of [[1.7, -1.0, 0.8], [1.95, -0.4, 0.55]]) {
          this.box(w, 0.55, 0.45, this.mat(0x16181d), x, 0.28, z, g);
          this.box(w + 0.02, 0.03, 0.47, this.mat(0x8a8f99), x, 0.56, z, g); this.box(w + 0.02, 0.03, 0.47, this.mat(0x8a8f99), x, 0.02, z, g);
          this.box(0.04, 0.56, 0.47, this.mat(0xc9a24f), x - w * 0.3, 0.28, z, g);
        }
        break;
      }
      default: break;
    }
  }

  // ---------- the walking markers ----------

  buildMarkers(cs) {
    const beamMat = this.addMat(0xffd77a, 0.5, this.beamMap);
    (cs.stops || []).forEach((s) => {
      const g = new Group(); g.position.set(s.at[0], 0, s.at[1]); g.visible = false; this.root.add(g);
      const ring = new Mesh(new RingGeometry(0.34, 0.48, 48), this.addMat(0xffd77a, 0.95)); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.04;
      const disc = this.plane(1.6, 1.6, this.addMat(0xffc861, 0.5, this.glowMap), 0, 0.035, 0, g, -Math.PI / 2);
      const fill = this.plane(1.5, 1.5, this.addMat(0xffffff, 0.9, this.glowMap), 0, 0.05, 0, g, -Math.PI / 2); fill.scale.setScalar(0.01);
      const beam = new Mesh(new CylinderGeometry(0.03, 0.14, 2.0, 16, 1, true), beamMat); beam.position.y = 1.0;
      const label = new Mesh(new PlaneGeometry(0.95, 0.24), this.tmat(labelTexture(s.name), { transparent: true, depthTest: false })); label.position.y = 2.15; label.renderOrder = 25;
      g.add(ring, beam, label); this.glows.push(label);
      this.markers.push({ stop: s, g, ring, disc, fill, beam, label, dwell: 0, wx: 0, wz: 0, here: false });
    });
  }

  buildMotes() {
    for (let i = 0; i < 46; i++) {
      const m = this.glow(0, 0, 0, 0.1 + Math.random() * 0.12, this.root, 0xffd9a0, 0.5);
      this.motes.push({ m, x: (Math.random() - 0.5) * 24, y: 0.4 + Math.random() * 3.8, z: -15 + Math.random() * 21, sp: 0.04 + Math.random() * 0.08, ph: Math.random() * 6.28 });
    }
  }

  // ---------- moving through the party ----------

  ensureVignette() {
    if (this.vig || !this.player || !this.player.head) return;
    const tex = canvasTexture(256, 256, (g, w, h) => { g.fillStyle = rad(g, w / 2, h / 2, w * 0.17, w * 0.5, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.92)']]); g.fillRect(0, 0, w, h); });
    const m = new Mesh(new PlaneGeometry(1.6, 1.6), new MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthTest: false, depthWrite: false }));
    m.renderOrder = 60; m.position.set(0, 0, -0.35); m.visible = false;
    this.player.head.add(m);
    this.vig = m;
  }

  rigOk() {
    const r = this.player;
    const ok = !!(r && r.position && r.rotation && r.head);
    if (!ok && !this.warnedRig) { console.warn('Earshot: cannot move the player rig, walking is disabled'); this.warnedRig = true; }
    return ok;
  }

  // Walk to a station: a smooth, eased glide along a curve that steers around the other guests, turning you toward the group.
  startGlide(stop, dur) {
    if (!this.rigOk()) return;
    const head = this.player.head;
    head.updateWorldMatrix(true, false);
    const m = head.matrixWorld.elements;
    const from = [m[12], m[14]];
    const to = this.toWorld(stop.at[0], stop.at[1]);
    const a0 = Math.atan2(m[8], m[10]);                       // where the head faces, as a yaw (forward = -sin, -cos)
    let dyaw = 0;
    if (stop.look) {
      const lk = this.toWorld(stop.look[0], stop.look[1]);
      dyaw = wrapPI(Math.atan2(-(lk[0] - to[0]), -(lk[1] - to[1])) - a0);   // turn so the group is straight ahead
    }
    // A curved path that keeps clear of the groups it is not heading to.
    const A = from, B = to, mid = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2];
    const len = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1;
    const perp = [-(B[1] - A[1]) / len, (B[0] - A[0]) / len];
    const obs = this.avoid.map(([x, z, r]) => { const w = this.toWorld(x, z); return [w[0], w[1], r]; })
      .filter(([x, z]) => Math.hypot(x - A[0], z - A[1]) > 2.6 && Math.hypot(x - B[0], z - B[1]) > 2.6);
    let ctrl = mid;
    for (const off of [0, 2.0, -2.0, 3.6, -3.6]) {
      const c = [mid[0] + perp[0] * off, mid[1] + perp[1] * off];
      let ok = true;
      for (let k = 1; k < 24 && ok; k++) {
        const u = k / 24, a = (1 - u) * (1 - u), b = 2 * (1 - u) * u, d = u * u;
        const px = a * A[0] + b * c[0] + d * B[0], pz = a * A[1] + b * c[1] + d * B[1];
        for (const [x, z, r] of obs) if (Math.hypot(px - x, pz - z) < r) { ok = false; break; }
      }
      if (ok) { ctrl = c; break; }
    }
    this.glide = { t: 0, dur: dur || Math.min(3.4, Math.max(1.9, 1.3 + len * 0.17)), A, B, C: ctrl, yaw0: this.player.rotation.y, dyaw };
    window.earshotState.moving = true;
    if (window.earshotFx) window.earshotFx('move');
  }

  stepGlide(dt) {
    const G = this.glide;
    if (!G) return;
    G.t += dt;
    const p = clamp01(G.t / G.dur), u = ease(p);
    const a = (1 - u) * (1 - u), b = 2 * (1 - u) * u, d = u * u;
    const tx = a * G.A[0] + b * G.C[0] + d * G.B[0], tz = a * G.A[1] + b * G.C[1] + d * G.B[1];
    const rig = this.player;
    rig.rotation.y = G.yaw0 + G.dyaw * u;
    rig.updateMatrixWorld(true);
    const head = rig.head;
    head.updateWorldMatrix(true, false);
    const m = head.matrixWorld.elements;
    rig.position.x += tx - m[12];
    rig.position.z += tz - m[14];
    this.setVignette(Math.sin(Math.PI * p) * 0.9);
    if (p >= 1) { this.glide = null; this.cool = 0.7; window.earshotState.moving = false; this.setVignette(0); }
  }

  setVignette(v) {
    this.ensureVignette();
    if (!this.vig) return;
    this.vig.visible = v > 0.01;
    this.vig.material.opacity = v;
  }

  // Aim at a marker (with your gaze or a pointing hand) and hold to walk there.
  updateMarkers(dt, t, st, hx, hy, hz, fx, fy, fz, rays) {
    const showing = st.phase === 'play' && !this.glide;
    const targets = [{ o: [hx, hy, hz], d: [fx, fy, fz] }, ...rays];
    let hover = null, best = HOVER_COS;
    this.markers.forEach((mk, i) => {
      const w = this.toWorld(mk.stop.at[0], mk.stop.at[1]);
      mk.wx = w[0]; mk.wz = w[1];
      mk.here = Math.hypot(w[0] - hx, w[1] - hz) < 1.3;
      const vis = showing && !mk.here;
      mk.g.visible = vis;
      if (!vis) { mk.dwell = 0; return; }
      mk.ring.scale.setScalar(1 + 0.07 * Math.sin(t * 3 + i));
      mk.beam.material.opacity = 0.5;
      const ty = this.floorY + 1.0;
      for (const r of targets) {
        const vx = w[0] - r.o[0], vy = ty - r.o[1], vz = w[1] - r.o[2];
        const l = Math.hypot(vx, vy, vz) || 1;
        const c = (vx * r.d[0] + vy * r.d[1] + vz * r.d[2]) / l;
        if (c > best) { best = c; hover = mk; }
      }
    });
    for (const mk of this.markers) {
      if (!mk.g.visible) continue;
      mk.dwell = mk === hover && this.cool <= 0 ? Math.min(DWELL, mk.dwell + dt) : Math.max(0, mk.dwell - dt * 1.6);
      const f = mk.dwell / DWELL;
      mk.fill.scale.setScalar(Math.max(0.01, f * 1.0));
      mk.disc.material.opacity = 0.5;
      mk.label.scale.setScalar(1 + 0.25 * f);
      if (mk.dwell >= DWELL) { mk.dwell = 0; this.startGlide(mk.stop); break; }
    }
  }

  // ---------- the LED wall ----------

  drawLed(t, lv) {
    const g = this.led.ctx, w = 512, h = 256;
    g.fillStyle = lin(g, 0, 0, w, h, [[0, '#2a0f4a'], [0.5, '#6a1f6e'], [1, '#c24a6a']]); g.fillRect(0, 0, w, h);
    g.fillStyle = rad(g, w / 2, h * 0.55, 10, 230, [[0, 'rgba(255,214,140,0.5)'], [1, 'rgba(255,214,140,0)']]); g.fillRect(0, 0, w, h);
    const n = 44;
    for (let i = 0; i < n; i++) {
      const x = 14 + i * ((w - 28) / (n - 1));
      const env = Math.exp(-Math.pow((i - n / 2) / (n * 0.28), 2));
      const amp = (0.12 + 0.88 * (Math.sin(t * 2.1 + i * 0.5) * 0.5 + 0.5)) * (0.25 + lv * 7) * env;
      const bh = 6 + amp * 120;
      g.fillStyle = i % 2 ? '#ffd27a' : '#ffb347'; g.fillRect(x - 3, h * 0.55 - bh, 6, bh * 2);
    }
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#fff0cf'; g.font = 'bold 34px Georgia, serif'; g.fillText('LUMEN AWARDS', w / 2, 34);
    g.fillStyle = 'rgba(255,240,207,0.75)'; g.font = 'italic 17px Georgia, serif'; g.fillText('THE GOLDEN WAVEFORM  ·  ARTIST OF THE YEAR', w / 2, h - 22);
    this.led.tex.needsUpdate = true;
  }

  // A point part-way along a path, by distance walked (u runs 0 to 1).
  pathAt(path, u) {
    let total = 0; const seg = [];
    for (let i = 1; i < path.length; i++) { const l = Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]); seg.push(l); total += l; }
    let d = u * total;
    for (let i = 0; i < seg.length; i++) {
      if (d <= seg[i] || i === seg.length - 1) { const f = seg[i] ? Math.min(1, d / seg[i]) : 1; return [path[i][0] + (path[i + 1][0] - path[i][0]) * f, path[i][1] + (path[i + 1][1] - path[i][1]) * f]; }
      d -= seg[i];
    }
    return path[0];
  }

  // ---------- fireworks ----------

  launchFireworks() {
    if (!this.fire) {
      const mats = [0xffd34d, 0xff6fae, 0x6fd6ff, 0xa6ff8a, 0xffffff].map((c) => this.addMat(c, 1, this.glowMap));
      const geo = new PlaneGeometry(0.5, 0.5);
      this.fire = [];
      for (let b = 0; b < 7; b++) for (let j = 0; j < 30; j++) {
        const m = new Mesh(geo, mats[b % mats.length]); m.visible = false; this.root.add(m);
        this.fire.push({ m, b, vx: 0, vy: 0, vz: 0, t: 0, life: 1, delay: 0, on: false });
      }
    }
    const centers = [];
    for (let b = 0; b < 7; b++) centers.push([(Math.random() - 0.5) * 18, 9 + Math.random() * 5, -6 - Math.random() * 11]);
    for (const p of this.fire) {
      const c = centers[p.b];
      const u = Math.random() * 2 - 1, a = Math.random() * TAU, r = Math.sqrt(1 - u * u), sp = 3.0 + Math.random() * 1.6;
      p.vx = r * Math.cos(a) * sp; p.vy = u * sp; p.vz = r * Math.sin(a) * sp;
      p.t = 0; p.life = 2.2 + Math.random() * 0.7; p.delay = 0.3 + p.b * 0.55; p.on = true;
      p.m.position.set(c[0], c[1], c[2]); p.m.visible = false;
    }
  }

  stepFireworks(dt, hx, hy, hz) {
    if (!this.fire) return;
    for (const p of this.fire) {
      if (!p.on) continue;
      p.t += dt;
      if (p.t < p.delay) continue;
      const a = p.t - p.delay;
      if (a > p.life) { p.m.visible = false; p.on = false; continue; }
      p.m.visible = true;
      p.vy -= 2.2 * dt;
      p.m.position.x += p.vx * dt; p.m.position.y += p.vy * dt; p.m.position.z += p.vz * dt;
      const k = a / p.life;
      p.m.scale.setScalar(Math.max(0.05, 1 - k * k) * (0.85 + Math.sin(a * 30 + p.b) * 0.15));
      p.m.lookAt(hx, hy, hz);
    }
  }

  // ---------- per frame ----------

  getPose(entity) {
    const obj = entity && entity.object3D;
    if (!obj) return null;
    obj.updateWorldMatrix(true, false);
    const e = obj.matrixWorld.elements;
    return { p: [e[12], e[13], e[14]], d: [-e[8], -e[9], -e[10]] };
  }

  update() {
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    const t = now / 1000;

    const cs = window.earshotCase;
    const on = !!(cs && cs.theme === 'gala');
    if (!on) {
      this.root.visible = false;
      if (this.key) { this.clear(); this.key = ''; }
      if (this.vig) this.vig.visible = false;
      return;
    }

    const head = this.player.head;
    head.updateWorldMatrix(true, false);
    const m = head.matrixWorld.elements;
    const hx = m[12], hy = m[13], hz = m[14];
    const fx = -m[8], fy = -m[9], fz = -m[10];
    const baseY = hy > 0.5 ? hy : 1.4;

    const layout = window.earshotLayout;
    if (layout) {
      const list = this.imageList(cs);
      this.ensureImages(list);
      if (list.every(([k]) => this.tex[k] || this.failed.has(k))) {
        const key = cs.id + '|' + layout.map((p) => p.x.toFixed(2) + ',' + p.z.toFixed(2)).join('|');
        if (key !== this.key) { this.key = key; this.floorY = baseY - EYE; this.build(cs, layout); }
      }
    }
    if (!this.key) return;
    this.root.visible = true;

    for (const gl of this.glows) gl.lookAt(hx, hy, hz);
    if (this.waterA) { this.waterA.offset.x = (t * 0.015) % 1; this.waterA.offset.y = (t * 0.01) % 1; }
    if (this.waterB) { this.waterB.offset.x = (-t * 0.03) % 1; this.waterB.offset.y = (t * 0.022) % 1; }
    for (const b of this.bobs) { const y = b.y + Math.sin(t * 1.6 + b.ph) * 0.012; b.a.position.y = y; b.b.position.y = y + 0.1; }
    for (const o of this.motes) {
      o.y += o.sp * dt; if (o.y > 4.4) o.y = 0.4;
      o.m.position.set(o.x + Math.sin(t * 0.4 + o.ph) * 0.4, o.y, o.z + Math.cos(t * 0.3 + o.ph) * 0.4);
    }

    const st = window.earshotState;
    if (!st) return;

    if (this.led && now - this.ledT > 90) {
      this.ledT = now;
      let lv = 0; for (const c of st.convos) lv = Math.max(lv, c.level || 0);
      this.drawLed(t, lv);
    }

    // Walking: hand rays (when a hand is held out from your head) and your gaze both aim at markers.
    const pse = this.world && this.world.playerSpaceEntities;
    const rsp = pse && pse.raySpaces;
    const rays = [];
    if (rsp) for (const side of ['left', 'right']) { const p = this.getPose(rsp[side]); if (p && Math.hypot(p.p[0] - hx, p.p[1] - hy, p.p[2] - hz) > 0.3) rays.push({ o: p.p, d: p.d }); }
    if (this.cool > 0) this.cool -= dt;
    this.updateMarkers(dt, t, st, hx, hy, hz, fx, fy, fz, rays);
    if (this.glide) this.stepGlide(dt);

    // When the case is solved, the camera walks over to watch the finale from the pool.
    const solved = !!st.revealed;
    if (solved && !this.wasRevealed && !this.glide && this.rigOk()) {
      const fin = cs.finale && cs.finale.stop;
      if (fin) this.startGlide(fin, 3.6);
    }
    this.wasRevealed = solved;

    const dx = hx - this.cx, dz = hz - this.cz;
    const lx = dx * this.cos - dz * this.sin, lz = dx * this.sin + dz * this.cos;   // you, in the party's own coordinates

    for (const a of this.actors) {
      const cv = st.convos[a.gi];
      if (!cv) continue;
      this.animate(a.fig, t, lx, lz, cv.speaker === a.idx && cv.level > 0.02, cv.level);
    }
    if (this.host && this.hostPath) {
      // At the reveal Jules walks over to stand beside Tess, so you can see them both while he speaks.
      this.hostT = Math.max(0, Math.min(1, this.hostT + dt * (solved ? 1 / 5.0 : -1 / 1.2)));
      const hp = this.pathAt(this.hostPath, ease(this.hostT));
      this.host.g.position.x = hp[0]; this.host.g.position.z = hp[1];
      this.host.walk = this.hostT > 0.001 && this.hostT < 0.999;
    }
    if (this.host) this.animate(this.host, t, lx, lz, st.helenLevel > 0.02, st.helenLevel);
    if (this.finaleSpot) this.finaleSpot.visible = solved && this.open > 0.05;

    for (const f of this.finalists) {
      f.vis = solved ? Math.min(1, f.vis + dt * 0.8) : 0;
      f.g.visible = f.vis > 0; f.material.opacity = f.vis;
      if (f.g.visible) this.animate(f, t, lx, lz, false, 0);
    }
    this.open = solved ? Math.min(1, this.open + dt * 0.5) : Math.max(0, this.open - dt * 2);
    if (this.doorHinge) this.doorHinge.rotation.y = -this.open * 1.5;
    if (this.interior) this.interior.material.opacity = Math.min(1, this.open * 1.3) * 0.95;
    if (this.trophy) {
      this.trophy.visible = this.open > 0.3;
      this.trophy.rotation.y = t * 1.2;
      this.trophy.scale.setScalar(Math.max(0.01, Math.min(1, this.open * 1.4)));
    }

    if (st.celebrate !== this.lastCelebrate) {
      this.lastCelebrate = st.celebrate;
      if (st.celebrate > 0) this.launchFireworks();
    }
    this.stepFireworks(dt, hx, hy, hz);
  }
}