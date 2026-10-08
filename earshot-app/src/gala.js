// The Lumen Awards: a night-time party with a modern building, a lit pool, a stage and six conversation spots.
import {
  createSystem, Group, Mesh, BoxGeometry, PlaneGeometry, SphereGeometry, CylinderGeometry,
  MeshBasicMaterial, DoubleSide, BackSide, AdditiveBlending, TextureLoader, CanvasTexture, SRGBColorSpace,
} from '@iwsdk/core';

const FIG_H = 1.55;
const TAU = Math.PI * 2;
const mat = (color, extra) => new MeshBasicMaterial({ color, ...extra });
const tile = (t, rx, ry) => { t.wrapS = t.wrapT = 1000; t.repeat.set(rx, ry); return t; };

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}
function glowTexture() {
  return canvasTexture(128, 128, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,230,180,1)'); gr.addColorStop(0.35, 'rgba(255,190,110,0.45)'); gr.addColorStop(1, 'rgba(255,150,70,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
}
function shadowTexture() {
  return canvasTexture(128, 128, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
}
function deckTexture() {
  return canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#20252b'; g.fillRect(0, 0, w, h);
    const s = w / 2;
    for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) { g.fillStyle = (x + y) % 2 ? '#30363e' : '#292e35'; g.fillRect(x * s + 3, y * s + 3, s - 6, s - 6); }
    g.strokeStyle = 'rgba(201,162,79,0.3)'; g.lineWidth = 2; g.strokeRect(2, 2, w - 4, h - 4);
  });
}
function waterTexture() {
  return canvasTexture(256, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#0e7a8c'); gr.addColorStop(1, '#16a8a6');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(210,255,250,0.35)'; g.lineWidth = 2;
    for (let i = 0; i < 24; i++) { const x = Math.random() * w, y = Math.random() * h; g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + 20, y - 14, x + 40, y + 14, x + 62, y); g.stroke(); }
    g.fillStyle = 'rgba(255,225,170,0.16)';
    for (let i = 0; i < 8; i++) g.fillRect(Math.random() * w, 0, 3, h);
  });
}
function facadeTexture() {
  return canvasTexture(1024, 448, (g, w, h) => {
    g.fillStyle = '#12141a'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 7; i++) {
      const x = 14 + i * 144;
      const gr = g.createLinearGradient(0, 40, 0, h - 20); gr.addColorStop(0, '#3a2418'); gr.addColorStop(0.5, '#d9964a'); gr.addColorStop(1, '#f3c77a');
      g.fillStyle = gr; g.fillRect(x, 40, 128, h - 70);
      g.fillStyle = 'rgba(255,236,190,0.85)'; g.beginPath(); g.arc(x + 64, 110, 14, 0, TAU); g.fill();
      g.fillStyle = 'rgba(40,20,14,0.85)';
      for (let k = 0; k < 3; k++) { const px = x + 20 + k * 40 + Math.random() * 8; g.fillRect(px, h - 130, 14, 60); g.beginPath(); g.arc(px + 7, h - 140, 8, 0, TAU); g.fill(); }
      g.fillRect(x + 10, h - 76, 108, 6);
      g.strokeStyle = '#0a0b0f'; g.lineWidth = 6; g.strokeRect(x, 40, 128, h - 70);
      g.beginPath(); g.moveTo(x, h / 2); g.lineTo(x + 128, h / 2); g.stroke();
    }
    g.fillStyle = '#ff5fa8'; g.fillRect(0, 16, w, 8); g.globalAlpha = 0.3; g.fillRect(0, 8, w, 24); g.globalAlpha = 1;
  });
}
function signTexture(text) {
  return canvasTexture(512, 96, (g, w, h) => {
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = 'bold 56px Georgia, serif';
    g.shadowColor = '#ffcf6a'; g.shadowBlur = 18; g.fillStyle = '#ffe3a0'; g.fillText(text, w / 2, h / 2 + 2);
  });
}
function skyTexture() {
  return canvasTexture(512, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#04061a'); gr.addColorStop(0.55, '#14204a'); gr.addColorStop(1, '#3a2a55');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = '#fff';
    for (let i = 0; i < 170; i++) { g.globalAlpha = 0.3 + Math.random() * 0.7; g.fillRect(Math.random() * w, Math.random() * h * 0.7, 1.5, 1.5); }
    g.globalAlpha = 1; g.fillStyle = '#fff3c9'; g.beginPath(); g.arc(w * 0.62, h * 0.22, 14, 0, TAU); g.fill();
  });
}
function skylineTexture() {
  return canvasTexture(1024, 128, (g, w, h) => {
    let x = 0;
    while (x < w) {
      const bw = 18 + Math.random() * 40, bh = 30 + Math.random() * 80;
      g.fillStyle = '#0b0d1c'; g.fillRect(x, h - bh, bw, bh);
      g.fillStyle = '#ffd27a';
      for (let k = 0; k < 6; k++) if (Math.random() < 0.5) g.fillRect(x + 4 + Math.random() * (bw - 10), h - bh + 6 + Math.random() * (bh - 14), 3, 3);
      x += bw + 2;
    }
  });
}
function personTexture() {
  return canvasTexture(64, 128, (g, w) => {
    g.fillStyle = '#0a0a10'; g.beginPath(); g.arc(w / 2, 20, 12, 0, TAU); g.fill();
    g.beginPath(); g.moveTo(w / 2 - 18, 126); g.lineTo(w / 2 - 14, 44); g.quadraticCurveTo(w / 2, 34, w / 2 + 14, 44); g.lineTo(w / 2 + 18, 126); g.closePath(); g.fill();
  });
}
function beamTexture() {
  return canvasTexture(64, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,240,200,0.6)'); gr.addColorStop(1, 'rgba(255,240,200,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
}
function workshopTexture() {
  return canvasTexture(128, 128, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#3a2412'); gr.addColorStop(1, '#e0a65a');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(30,16,8,0.7)'; g.fillRect(10, 50, 108, 5); g.fillRect(10, 92, 108, 5);
    for (const [x, y, rw, rh] of [[16, 28, 12, 22], [38, 32, 18, 18], [70, 26, 12, 24], [92, 30, 16, 20], [20, 70, 18, 22], [60, 72, 16, 20]]) g.fillRect(x, y, rw, rh);
    g.fillStyle = 'rgba(255,240,200,0.5)'; g.beginPath(); g.arc(w / 2, 14, 7, 0, TAU); g.fill();
  });
}

export class GalaSystem extends createSystem({}) {
  init() {
    this.root = new Group();
    this.root.visible = false;
    this.addToScene(this.root);
    this.settleUntil = performance.now() + 3000;
    this.cx = undefined; this.cz = 0; this.floorY = 0; this.theta = 0; this.cos = 1; this.sin = 0;
    this.last = performance.now();
    this.key = '';
    this.tex = {}; this.failed = new Set(); this.loading = new Set(); this.loader = new TextureLoader();
    this.actors = []; this.glows = []; this.finalists = []; this.host = null;
    this.waterMap = null; this.doorHinge = null; this.trophy = null; this.fire = null;
    this.open = 0; this.lastCelebrate = 0;

    this.glowMap = glowTexture();
    this.glowMat = new MeshBasicMaterial({ map: this.glowMap, transparent: true, blending: AdditiveBlending, depthWrite: false, side: DoubleSide });
    this.tealMat = new MeshBasicMaterial({ map: this.glowMap, color: 0x3fe0d0, transparent: true, blending: AdditiveBlending, depthWrite: false, side: DoubleSide });
    this.shadowMat = new MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false, side: DoubleSide });
    this.bulbGeo = new SphereGeometry(0.035, 8, 6);
    this.bulbMat = mat(0xffe2a8);

    const vs = this.world.visibilityState;
    if (vs && vs.subscribe) this.cleanupFuncs.push(vs.subscribe(() => { this.settleUntil = performance.now() + 3000; }));
  }

  addToScene(obj) {
    const w = this.world;
    if (w && w.scene && w.scene.add) w.scene.add(obj);
    else w.createTransformEntity(obj);
  }

  billboard(m) { this.glows.push(m); return m; }
  glow(x, y, z, size, parent, material) {
    const m = this.billboard(new Mesh(new PlaneGeometry(size, size), material || this.glowMat));
    m.position.set(x, y, z);
    (parent || this.root).add(m);
    return m;
  }

  imageList(cs) { return cs.images.map((k) => [k, (cs.art || '') + k + '.png']); }
  ensureImages(list) {
    for (const [k, url] of list) {
      if (this.tex[k] || this.loading.has(k)) continue;
      this.loading.add(k);
      this.loader.load(url, (t) => { t.colorSpace = SRGBColorSpace; this.tex[k] = t; }, undefined,
        () => { this.failed.add(k); console.warn('Earshot: could not load ' + url); });
    }
  }

  clear() {
    while (this.root.children.length) this.root.remove(this.root.children[0]);
    this.actors = []; this.glows = []; this.finalists = []; this.host = null;
    this.waterMap = null; this.doorHinge = null; this.trophy = null; this.fire = null; this.open = 0;
  }

  aspect(tex) { return tex && tex.image && tex.image.height ? tex.image.width / tex.image.height : 0.4; }

  makeFigure(name, x, z, h, lift) {
    const closed = this.tex[name];
    if (!closed) return null;
    const talk = this.tex[name + '-talk'] || closed;
    const geom = new PlaneGeometry(1, 1);
    geom.translate(0, 0.5, 0);
    const material = new MeshBasicMaterial({ map: closed, color: 0xd9ccbb, transparent: true, alphaTest: 0.02, side: DoubleSide });
    const mesh = new Mesh(geom, material);
    mesh.renderOrder = 2;
    const a = this.aspect(closed);
    mesh.scale.set(h * a, h, 1);
    const shadow = new Mesh(new PlaneGeometry(1, 1), this.shadowMat);
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.012; shadow.scale.set(Math.max(0.6, h * a * 1.3), 0.45, 1); shadow.renderOrder = 1;
    const g = new Group();
    g.add(shadow, mesh);
    g.position.set(x, lift || 0, z);
    this.root.add(g);
    return { name, g, mesh, material, closed, talk, h, lift: lift || 0, phase: Math.random() * 6.28, vis: 1, partner: null, turn: 0.75 };
  }

  animate(f, t, lx, lz, speaking, level) {
    const amp = Math.min(0.7, level * 8);
    let dx = lx - f.g.position.x, dz = lz - f.g.position.z;
    const dl = Math.hypot(dx, dz) || 1; dx /= dl; dz /= dl;
    if (f.partner) {
      const c = Math.cos(f.turn), s = Math.sin(f.turn);
      dx = dx * c + f.partner[0] * s; dz = dz * c + f.partner[1] * s;
    }
    f.g.rotation.y = Math.atan2(dx, dz);
    f.g.rotation.z = Math.sin(t * 2.2 + f.phase) * 0.01 + (speaking ? Math.sin(t * 5 + f.phase) * 0.02 * amp : 0);
    f.g.position.y = f.lift + (speaking ? Math.abs(Math.sin(t * 6 + f.phase)) * 0.01 * amp : 0);
    const open = speaking && level > 0.04 && Math.sin(t * 16 + f.phase) > -0.1;
    const tx = open ? f.talk : f.closed;
    if (f.material.map !== tx) f.material.map = tx;
    f.material.color.setHex(speaking ? 0xffffff : 0xd9ccbb);
  }

  // ---------- the world ----------

  build(cs) {
    this.clear();
    const fwd = window.earshotForward;
    if (!fwd) return;
    const fl = Math.hypot(fwd[0], fwd[1]) || 1;
    this.theta = Math.atan2(-fwd[0] / fl, -fwd[1] / fl);
    this.cos = Math.cos(this.theta); this.sin = Math.sin(this.theta);
    this.root.rotation.y = this.theta;
    this.root.position.set(this.cx, this.floorY, this.cz);

    this.buildScenery();
    cs.groups.forEach((gr, i) => this.buildGroup(gr, i));
    if (cs.host && cs.hostAt) {
      this.host = this.makeFigure(cs.host, cs.hostAt[0], cs.hostAt[1], FIG_H, 0);
      if (this.host) this.host.turn = 0.1;
    }
    for (const a of (cs.finale && cs.finale.appear) || []) {
      const f = this.makeFigure(a.name, a.x, a.z, FIG_H, 0);
      if (f) { f.vis = 0; f.g.visible = false; f.material.opacity = 0; this.finalists.push(f); }
    }
    window.earshotBuilt = cs.id;
  }

  buildScenery() {
    const R = this.root;
    R.add(new Mesh(new SphereGeometry(40, 24, 14), new MeshBasicMaterial({ map: skyTexture(), side: BackSide, depthWrite: false })));
    const skyline = new Mesh(new CylinderGeometry(26, 26, 6, 40, 1, true), new MeshBasicMaterial({ map: skylineTexture(), transparent: true, side: BackSide, depthWrite: false }));
    skyline.position.y = 1.2; R.add(skyline);

    const deck = new Mesh(new PlaneGeometry(14, 11.4), new MeshBasicMaterial({ map: tile(deckTexture(), 12, 10) }));
    deck.rotation.x = -Math.PI / 2; deck.position.set(0, 0.005, -1.2); R.add(deck);

    // The pool: a light stone rim, moving water, and teal underwater lights.
    const rim = new Mesh(new PlaneGeometry(4.0, 3.5), mat(0xd7dde0));
    rim.rotation.x = -Math.PI / 2; rim.position.set(0, 0.012, -2.45); R.add(rim);
    this.waterMap = tile(waterTexture(), 2, 2);
    const water = new Mesh(new PlaneGeometry(3.4, 2.9), new MeshBasicMaterial({ map: this.waterMap }));
    water.rotation.x = -Math.PI / 2; water.position.set(0, 0.02, -2.45); R.add(water);
    for (const [x, z] of [[-1.0, -1.7], [1.0, -1.7], [-1.0, -3.3], [1.0, -3.3]]) {
      const l = new Mesh(new PlaneGeometry(1.5, 1.5), this.tealMat);
      l.rotation.x = -Math.PI / 2; l.position.set(x, 0.03, z); R.add(l);
    }

    // The building: glowing glass, concrete columns, a canopy and the sign.
    const facade = new Mesh(new PlaneGeometry(14, 6), new MeshBasicMaterial({ map: facadeTexture() }));
    facade.position.set(0, 3, -6.5); R.add(facade);
    for (let i = -3; i <= 3; i++) { const col = new Mesh(new CylinderGeometry(0.22, 0.22, 5.4, 12), mat(0x707078)); col.position.set(i * 2.1, 2.7, -6.2); R.add(col); }
    const canopy = new Mesh(new BoxGeometry(14.4, 0.35, 2.4), mat(0x1b1d24)); canopy.position.set(0, 5.5, -5.4); R.add(canopy);
    const sign = new Mesh(new PlaneGeometry(4.2, 0.77), new MeshBasicMaterial({ map: signTexture('LUMEN AWARDS'), transparent: true }));
    sign.position.set(0, 5.0, -6.45); R.add(sign);

    const bal = new Mesh(new PlaneGeometry(13.6, 0.9), new MeshBasicMaterial({ color: 0x9fd8e0, transparent: true, opacity: 0.18, side: DoubleSide }));
    bal.position.set(0, 0.5, 4.35); R.add(bal);
    const rail = new Mesh(new BoxGeometry(13.6, 0.04, 0.06), mat(0xc9a24f)); rail.position.set(0, 0.96, 4.35); R.add(rail);

    for (const s of [-1, 1]) for (let k = 0; k < 6; k++) {
      const z = -5 + k * 1.75;
      const hd = new Mesh(new BoxGeometry(0.7, 1.3, 1.4), mat(0x1c3a2a)); hd.position.set(s * 6.6, 0.65, z); R.add(hd);
      this.glow(s * 6.1, 0.5, z, 1.5);
    }
    for (const [x, z] of [[-5.6, -4.4], [-5.6, 3.0], [5.6, 3.0], [-1.0, 4.0]]) {
      const pl = new Mesh(new CylinderGeometry(0.28, 0.22, 0.5, 14), mat(0x2b2f36)); pl.position.set(x, 0.25, z);
      const ball = new Mesh(new SphereGeometry(0.4, 14, 10), mat(0x1f4a30)); ball.position.set(x, 0.85, z);
      R.add(pl, ball);
    }

    // Distant guests on the terrace, as warm-rimmed silhouettes.
    const pm = new MeshBasicMaterial({ map: personTexture(), transparent: true, alphaTest: 0.3, side: DoubleSide, color: 0x4a4050 });
    const pg = new PlaneGeometry(0.55, 1.7); pg.translate(0, 0.85, 0);
    for (let i = 0; i < 16; i++) {
      const m = new Mesh(pg, pm);
      const x = -5.6 + i * 0.74 + (i % 3) * 0.1;
      m.position.set(x, 0, -5.9 + (i % 2) * 0.25); m.scale.setScalar(0.85 + ((i * 37) % 20) / 100);
      R.add(m);
    }

    // String lights on poles.
    for (const [x, z] of [[-6.2, -5.6], [6.2, -5.6], [-6.2, -1.2], [6.2, -1.2], [-6.2, 3.8], [6.2, 3.8]]) {
      const p = new Mesh(new CylinderGeometry(0.03, 0.03, 3.2, 6), mat(0x222222)); p.position.set(x, 1.6, z); R.add(p);
    }
    for (const z of [-5.6, -1.2, 3.8]) {
      for (let s = 0; s < 16; s++) {
        const f = s / 15;
        const b = new Mesh(this.bulbGeo, this.bulbMat);
        b.position.set(-6.2 + 12.4 * f, 3.1 - 0.3 * Math.sin(Math.PI * ((f * 3) % 1)), z);
        R.add(b);
      }
    }

    // Candle tables around the deck, just for atmosphere.
    for (const [x, z] of [[-5.2, -0.6], [5.4, 2.6], [-4.8, 3.2], [1.8, 3.4]]) this.addTall(x, z, true);

    // The empty plinth in its spotlight, and the pool house where the trophy ends up.
    this.addPlinth(2.5, -4.8);
    this.addPoolHouse(5.2, -3.9);
  }

  addTall(x, z, ambient) {
    const g = new Group(); g.position.set(x, 0, z);
    const cloth = new Mesh(new CylinderGeometry(0.34, 0.5, 1.05, 20), mat(0xf1ece0)); cloth.position.y = 0.525;
    const top = new Mesh(new CylinderGeometry(0.4, 0.4, 0.03, 20), mat(0xfff8ea)); top.position.y = 1.06;
    const hem = new Mesh(new CylinderGeometry(0.505, 0.51, 0.04, 20), mat(0xc9a24f)); hem.position.y = 0.04;
    const candle = new Mesh(new CylinderGeometry(0.02, 0.02, 0.1, 8), mat(0xfff1cf)); candle.position.y = 1.12;
    g.add(cloth, top, hem, candle);
    for (let i = 0; i < 3; i++) { const a = (i / 3) * TAU; const gl = new Mesh(new CylinderGeometry(0.022, 0.016, 0.12, 8), mat(0xe8f0f2)); gl.position.set(Math.cos(a) * 0.22, 1.14, Math.sin(a) * 0.22); g.add(gl); }
    this.glow(0, 1.2, 0, 0.7, g);
    this.root.add(g);
    return g;
  }

  addPlinth(x, z) {
    const g = new Group(); g.position.set(x, 0, z);
    const base = new Mesh(new CylinderGeometry(0.5, 0.5, 0.06, 20), mat(0x2a2a33)); base.position.y = 0.03;
    const col = new Mesh(new BoxGeometry(0.34, 0.95, 0.34), mat(0xe9e4da)); col.position.y = 0.53;
    const cushion = new Mesh(new CylinderGeometry(0.2, 0.2, 0.05, 18), mat(0x7a1f2e)); cushion.position.y = 1.03;
    const beam = new Mesh(new CylinderGeometry(0.12, 0.8, 3.6, 20, 1, true), new MeshBasicMaterial({ map: beamTexture(), transparent: true, blending: AdditiveBlending, depthWrite: false, side: DoubleSide }));
    beam.position.y = 1.9;
    g.add(base, col, cushion, beam);
    this.glow(0, 1.1, 0, 0.8, g);
    this.root.add(g);
  }

  addPoolHouse(x, z) {
    const g = new Group(); g.position.set(x, 0, z);
    const body = new Mesh(new BoxGeometry(2.0, 2.5, 2.4), mat(0x20262c)); body.position.y = 1.25;
    const roof = new Mesh(new BoxGeometry(2.3, 0.14, 2.7), mat(0x14171c)); roof.position.y = 2.57;
    const win = new Mesh(new PlaneGeometry(1.1, 1.5), new MeshBasicMaterial({ map: workshopTexture() }));
    win.rotation.y = -Math.PI / 2; win.position.set(-1.02, 1.3, -0.45);
    const hinge = new Group(); hinge.position.set(-1.03, 1.05, 1.0); hinge.rotation.y = -Math.PI / 2;
    const leafGeo = new PlaneGeometry(0.8, 2.0); leafGeo.translate(-0.4, 0, 0);
    hinge.add(new Mesh(leafGeo, mat(0x3a4650, { side: DoubleSide })));
    const sign = new Mesh(new PlaneGeometry(1.6, 0.3), new MeshBasicMaterial({ map: signTexture('POOL HOUSE'), transparent: true }));
    sign.rotation.y = -Math.PI / 2; sign.position.set(-1.03, 2.25, 0);
    g.add(body, roof, win, hinge, sign);
    this.doorHinge = hinge;
    this.glow(-1.4, 1.2, -0.4, 2.0, g);

    const tr = new Group(); tr.position.set(-1.35, 1.1, 0.6);
    const base = new Mesh(new CylinderGeometry(0.12, 0.14, 0.05, 14), mat(0xc9a24f)); base.position.y = -0.2;
    const stem = new Mesh(new CylinderGeometry(0.03, 0.04, 0.2, 10), mat(0xd9b45a)); stem.position.y = -0.07;
    const cup = new Mesh(new CylinderGeometry(0.15, 0.05, 0.24, 16), mat(0xf2c14e)); cup.position.y = 0.1;
    tr.add(base, stem, cup);
    tr.visible = false;
    g.add(tr);
    this.trophy = tr;
    this.glow(-1.35, 1.1, 0.6, 1.2, g);
    this.root.add(g);
  }

  buildGroup(gr, i) {
    const [gx, gz] = gr.at;
    this.addProps(gr, gx, gz);
    gr.members.forEach((name, j) => {
      const off = (gr.offsets && gr.offsets[j]) || [0, 0];
      const f = this.makeFigure(name, gx + off[0], gz + off[1], FIG_H, gr.lift || 0);
      if (!f) return;
      const l = Math.hypot(off[0], off[1]) || 1;
      f.partner = [-off[0] / l, -off[1] / l];
      this.actors.push({ fig: f, gi: i, idx: j });
    });
  }

  addProps(gr, gx, gz) {
    const g = new Group(); g.position.set(gx, 0, gz); this.root.add(g);
    switch (gr.setting) {
      case 'bar': {
        const counter = new Mesh(new BoxGeometry(0.55, 1.05, 2.0), mat(0x1b1d24)); counter.position.set(-0.5, 0.525, 0);
        const top = new Mesh(new BoxGeometry(0.7, 0.06, 2.15), mat(0xd9d2c4)); top.position.set(-0.5, 1.08, 0);
        const shelf = new Mesh(new BoxGeometry(0.18, 1.7, 2.0), mat(0x14161b)); shelf.position.set(-1.5, 0.85, 0);
        g.add(counter, top, shelf);
        for (const y of [1.15, 1.45]) for (let k = 0; k < 5; k++) {
          const b = new Mesh(new CylinderGeometry(0.035, 0.04, 0.26, 8), mat(k % 2 ? 0xb5651d : 0x2c7a6f));
          b.position.set(-1.38, y, -0.8 + k * 0.4); g.add(b);
        }
        this.glow(-1.2, 1.3, 0, 1.6, g);
        break;
      }
      case 'lounge': {
        const sofa = new Mesh(new BoxGeometry(0.8, 0.45, 2.0), mat(0x2f3a46)); sofa.position.set(0.95, 0.225, 0);
        const back = new Mesh(new BoxGeometry(0.2, 0.55, 2.0), mat(0x28323d)); back.position.set(1.3, 0.7, 0);
        const table = new Mesh(new CylinderGeometry(0.4, 0.4, 0.4, 20), mat(0x1d1d22)); table.position.set(0, 0.2, 0);
        const tt = new Mesh(new CylinderGeometry(0.42, 0.42, 0.03, 20), mat(0xc9a24f)); tt.position.set(0, 0.41, 0);
        g.add(sofa, back, table, tt);
        this.glow(0, 0.55, 0, 0.7, g);
        break;
      }
      case 'stage': {
        const pf = new Mesh(new BoxGeometry(2.8, 0.16, 1.3), mat(0x2b1f1a)); pf.position.set(0, 0.08, 0);
        const edge = new Mesh(new BoxGeometry(2.84, 0.03, 1.34), mat(0xc9a24f)); edge.position.set(0, 0.17, 0);
        g.add(pf, edge);
        for (const o of gr.offsets || []) {
          const pole = new Mesh(new CylinderGeometry(0.012, 0.012, 0.85, 6), mat(0x222222)); pole.position.set(o[0], 0.6, o[1] + 0.4);
          const sheet = new Mesh(new BoxGeometry(0.34, 0.24, 0.02), mat(0xf4efe2)); sheet.position.set(o[0], 1.05, o[1] + 0.4);
          g.add(pole, sheet);
        }
        this.glow(0, 1.4, 0.3, 2.2, g);
        break;
      }
      case 'bistro': {
        const top = new Mesh(new CylinderGeometry(0.4, 0.4, 0.04, 20), mat(0xf1ece0)); top.position.y = 0.76;
        const stem = new Mesh(new CylinderGeometry(0.04, 0.04, 0.74, 8), mat(0x222222)); stem.position.y = 0.38;
        const foot = new Mesh(new CylinderGeometry(0.25, 0.25, 0.03, 16), mat(0x222222)); foot.position.y = 0.02;
        g.add(top, stem, foot);
        for (const a of [0.8, 2.6]) { const gl = new Mesh(new CylinderGeometry(0.025, 0.018, 0.13, 8), mat(0xb23a4a)); gl.position.set(Math.cos(a) * 0.2, 0.84, Math.sin(a) * 0.2); g.add(gl); }
        this.glow(0, 0.95, 0, 0.7, g);
        break;
      }
      case 'tall': {
        const tg = this.addTall(gx, gz, false);
        void tg;
        break;
      }
      case 'door': {
        const flat = new Mesh(new BoxGeometry(0.12, 2.5, 1.7), mat(0x1d2026)); flat.position.set(-0.95, 1.25, 0);
        const lit = new Mesh(new PlaneGeometry(1.3, 2.1), mat(0xffc880)); lit.rotation.y = Math.PI / 2; lit.position.set(-0.88, 1.1, 0);
        const sign = new Mesh(new PlaneGeometry(1.5, 0.27), new MeshBasicMaterial({ map: signTexture('GREEN ROOM'), transparent: true }));
        sign.rotation.y = Math.PI / 2; sign.position.set(-0.87, 2.4, 0);
        g.add(flat, lit, sign);
        for (const [dz, dy] of [[0.9, 0.25], [1.0, 0.7], [-1.0, 0.25]]) { const c = new Mesh(new BoxGeometry(0.5, 0.45, 0.4), mat(0x121317)); c.position.set(-0.4, dy, dz + 0.7 * Math.sign(dz)); g.add(c); }
        this.glow(-0.6, 1.2, 0, 1.8, g);
        break;
      }
      default: break;
    }
  }

  // ---------- fireworks ----------

  launchFireworks() {
    if (!this.fire) {
      const mats = [0xffd34d, 0xff6fae, 0x6fd6ff, 0xa6ff8a, 0xffffff].map((c) => new MeshBasicMaterial({ map: this.glowMap, color: c, transparent: true, blending: AdditiveBlending, depthWrite: false, side: DoubleSide }));
      const geo = new PlaneGeometry(0.3, 0.3);
      this.fire = [];
      for (let b = 0; b < 6; b++) for (let j = 0; j < 26; j++) {
        const m = new Mesh(geo, mats[b % mats.length]); m.visible = false; this.root.add(m);
        this.fire.push({ m, b, vx: 0, vy: 0, vz: 0, t: 0, life: 1, delay: 0, on: false });
      }
    }
    const centers = [];
    for (let b = 0; b < 6; b++) centers.push([(Math.random() - 0.5) * 9, 5.5 + Math.random() * 2.5, -2.5 - Math.random() * 4]);
    for (const p of this.fire) {
      const c = centers[p.b];
      const u = Math.random() * 2 - 1, a = Math.random() * TAU, r = Math.sqrt(1 - u * u), sp = 2.0 + Math.random() * 1.2;
      p.vx = r * Math.cos(a) * sp; p.vy = u * sp; p.vz = r * Math.sin(a) * sp;
      p.t = 0; p.life = 1.7 + Math.random() * 0.5; p.delay = 0.2 + p.b * 0.6; p.on = true;
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
      p.vy -= 1.5 * dt;
      p.m.position.x += p.vx * dt; p.m.position.y += p.vy * dt; p.m.position.z += p.vz * dt;
      const k = a / p.life;
      p.m.scale.setScalar(Math.max(0.05, 1 - k * k) * (0.85 + Math.sin(a * 30 + p.b) * 0.15));
      p.m.lookAt(hx, hy, hz);
    }
  }

  // ---------- per frame ----------

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
      return;
    }

    const head = this.player.head;
    head.updateWorldMatrix(true, false);
    const m = head.matrixWorld.elements;
    const hx = m[12], hy = m[13], hz = m[14];
    const baseY = hy > 0.5 ? hy : 1.4;
    if (now < this.settleUntil || this.cx === undefined) {
      this.cx = hx; this.cz = hz; this.floorY = baseY - 1.25;
      this.root.position.set(this.cx, this.floorY, this.cz);
    }
    this.root.visible = true;

    const layout = window.earshotLayout;
    if (layout) {
      const list = this.imageList(cs);
      this.ensureImages(list);
      if (list.every(([k]) => this.tex[k] || this.failed.has(k))) {
        const key = cs.id + '|' + layout.map((p) => p.x.toFixed(2) + ',' + p.z.toFixed(2)).join('|') + '@' + this.floorY.toFixed(2);
        if (key !== this.key) { this.key = key; this.build(cs); }
      }
    }
    if (!this.key) return;

    if (this.waterMap) { this.waterMap.offset.x = (t * 0.02) % 1; this.waterMap.offset.y = (t * 0.013) % 1; }
    for (const gl of this.glows) gl.lookAt(hx, hy, hz);

    const dx = hx - this.cx, dz = hz - this.cz;
    const lx = dx * this.cos - dz * this.sin, lz = dx * this.sin + dz * this.cos; // you, in the party's own coordinates

    const st = window.earshotState;
    if (!st) return;
    for (const a of this.actors) {
      const cv = st.convos[a.gi];
      if (!cv) continue;
      this.animate(a.fig, t, lx, lz, cv.speaker === a.idx && cv.level > 0.02, cv.level);
    }
    if (this.host) this.animate(this.host, t, lx, lz, st.helenLevel > 0.02, st.helenLevel);

    const solved = !!st.revealed;
    for (const f of this.finalists) {
      f.vis = solved ? Math.min(1, f.vis + dt * 0.8) : 0;
      f.g.visible = f.vis > 0; f.material.opacity = f.vis;
      if (f.g.visible) this.animate(f, t, lx, lz, false, 0);
    }
    this.open = solved ? Math.min(1, this.open + dt * 0.6) : Math.max(0, this.open - dt * 2);
    if (this.doorHinge) this.doorHinge.rotation.y = -Math.PI / 2 + this.open * 1.5;
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