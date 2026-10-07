import {
  createSystem,
  Group,
  Mesh,
  BoxGeometry,
  PlaneGeometry,
  SphereGeometry,
  CylinderGeometry,
  MeshBasicMaterial,
  DoubleSide,
  AdditiveBlending,
  TextureLoader,
  CanvasTexture,
  SRGBColorSpace,
} from '@iwsdk/core';

const HIDE_IDS = ['environment', 'plant-sansevieria', 'robot', 'webxr-banner', 'banner', 'welcome-panel'];
const FIG_H = 1.55; // guest height in metres
const ROOM = 7;
const WALL_H = 3;
const DOOR_X = 1.9; // kitchen door sits on the right of the back wall, clear of the front table
const ENTRANCE_X = 1.2; // main entrance, on the wall behind you
const PAIR_TURN = 0.5; // radians: how far each guest turns toward their conversation partner
const mat = (color, extra) => new MeshBasicMaterial({ color, ...extra });

// Repeat a texture. 1000 = RepeatWrapping.
const tile = (t, rx, ry) => { t.wrapS = t.wrapT = 1000; t.repeat.set(rx, ry); return t; };

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

// Four inward-facing wall strips (no top/bottom faces, so nothing blocks your view).
function wallRing(size, y0, y1, inset, material) {
  const g = new Group();
  const h = y1 - y0, half = size / 2 - inset;
  const strip = (x, z, ry) => {
    const m = new Mesh(new PlaneGeometry(size, h), material);
    m.position.set(x, y0 + h / 2, z);
    m.rotation.y = ry;
    g.add(m);
  };
  strip(0, -half, 0);
  strip(0, half, Math.PI);
  strip(-half, 0, Math.PI / 2);
  strip(half, 0, -Math.PI / 2);
  return g;
}

function glowTexture() {
  return canvasTexture(128, 128, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,214,150,1)');
    gr.addColorStop(0.35, 'rgba(255,170,90,0.45)');
    gr.addColorStop(1, 'rgba(255,140,60,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
  });
}

function shadowTexture() {
  return canvasTexture(128, 128, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, 'rgba(0,0,0,0.55)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
  });
}

function skyTexture() {
  return canvasTexture(256, 192, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#0b1233');
    gr.addColorStop(1, '#2a3566');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffffff';
    for (let i = 0; i < 40; i++) {
      g.globalAlpha = 0.4 + Math.random() * 0.6;
      g.fillRect(Math.random() * w, Math.random() * h * 0.6, 1.5, 1.5);
    }
    g.globalAlpha = 1;
    g.fillStyle = '#fff3c9';
    g.beginPath();
    g.arc(w * 0.72, h * 0.28, 13, 0, Math.PI * 2);
    g.fill();
    let x = 0;
    while (x < w) {
      const bw = 14 + Math.random() * 22;
      const bh = 20 + Math.random() * 50;
      g.fillStyle = '#0d1228';
      g.fillRect(x, h - bh, bw, bh);
      g.fillStyle = '#ffd27a';
      for (let k = 0; k < 3; k++) {
        if (Math.random() < 0.5) g.fillRect(x + 3 + Math.random() * (bw - 8), h - bh + 6 + Math.random() * (bh - 14), 3, 3);
      }
      x += bw + 2;
    }
  });
}

function bannerTexture(text) {
  return canvasTexture(1024, 220, (g, w, h) => {
    g.fillStyle = '#f6ead3';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#b98a4a';
    g.lineWidth = 10;
    g.strokeRect(10, 10, w - 20, h - 20);
    g.fillStyle = '#5b2432';
    g.font = 'bold 62px Georgia, serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + 4, w - 80);
  });
}

function labelTexture(text) {
  return canvasTexture(256, 160, (g, w, h) => {
    g.fillStyle = '#fff7e6';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#b98a4a';
    g.lineWidth = 6;
    g.strokeRect(6, 6, w - 12, h - 12);
    g.fillStyle = '#5b2432';
    g.font = 'italic 40px Georgia, serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2, w - 24);
  });
}

function wallpaperTexture() {
  return canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#5a2a35';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(185,138,74,0.35)';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(w / 2, 0); g.lineTo(w, h / 2); g.lineTo(w / 2, h); g.lineTo(0, h / 2);
    g.closePath();
    g.stroke();
    for (const [cx, cy] of [[w / 2, h / 2], [0, 0], [w, 0], [0, h], [w, h]]) {
      g.fillStyle = 'rgba(120,52,68,0.9)';
      g.beginPath(); g.ellipse(cx, cy, 22, 38, 0, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(cx, cy, 38, 14, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(185,138,74,0.55)';
      g.beginPath(); g.arc(cx, cy, 5, 0, Math.PI * 2); g.fill();
    }
  });
}

function parquetTexture() {
  return canvasTexture(256, 256, (g, w) => {
    const cols = ['#5a3a26', '#4b3021', '#6a4630', '#523421'];
    const n = 4, s = w / n;
    for (let by = 0; by < n; by++) {
      for (let bx = 0; bx < n; bx++) {
        const horiz = (bx + by) % 2 === 0;
        for (let k = 0; k < 4; k++) {
          g.fillStyle = cols[(bx * 3 + by * 5 + k) % 4];
          const x = horiz ? bx * s : bx * s + (k * s) / 4;
          const y = horiz ? by * s + (k * s) / 4 : by * s;
          const rw = horiz ? s : s / 4, rh = horiz ? s / 4 : s;
          g.fillRect(x, y, rw, rh);
          g.strokeStyle = 'rgba(0,0,0,0.35)';
          g.strokeRect(x, y, rw, rh);
        }
      }
    }
  });
}

function panelTexture() {
  return canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#3b2417';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#2a1810';
    g.fillRect(24, 24, w - 48, h - 48);
    g.strokeStyle = '#7a5236';
    g.lineWidth = 4;
    g.strokeRect(24, 24, w - 48, h - 48);
    g.strokeStyle = 'rgba(0,0,0,0.45)';
    g.lineWidth = 2;
    g.strokeRect(36, 36, w - 72, h - 72);
  });
}

function paintingTexture(variant) {
  return canvasTexture(240, 180, (g, w, h) => {
    const sky = g.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, variant ? '#e8b36a' : '#9fb7c9');
    sky.addColorStop(1, variant ? '#f3d9a4' : '#e9dcc0');
    g.fillStyle = sky;
    g.fillRect(0, 0, w, h);
    g.fillStyle = variant ? '#fff0c4' : '#fffaf0';
    g.beginPath(); g.arc(w * 0.7, h * 0.3, 16, 0, Math.PI * 2); g.fill();
    g.fillStyle = variant ? '#7a5a3a' : '#5d7a5a';
    g.beginPath(); g.moveTo(0, h); g.lineTo(0, h * 0.62);
    g.quadraticCurveTo(w * 0.3, h * 0.4, w * 0.6, h * 0.65);
    g.quadraticCurveTo(w * 0.85, h * 0.78, w, h * 0.6);
    g.lineTo(w, h); g.fill();
    g.fillStyle = variant ? '#4a3524' : '#3d5a3d';
    g.beginPath(); g.moveTo(0, h); g.lineTo(0, h * 0.85);
    g.quadraticCurveTo(w * 0.5, h * 0.7, w, h * 0.88);
    g.lineTo(w, h); g.fill();
  });
}

// What you glimpse through the half-open kitchen door: a dim, warm room with shelves.
function kitchenTexture() {
  return canvasTexture(128, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#3a2012');
    gr.addColorStop(0.5, '#8a5a2c');
    gr.addColorStop(1, '#d99a4e');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(30,16,8,0.7)';
    g.fillRect(10, 70, 108, 5);
    g.fillRect(10, 130, 108, 5);
    for (const [x, y, rw, rh] of [[18, 48, 14, 22], [40, 52, 18, 18], [70, 46, 12, 24], [92, 50, 16, 20], [22, 108, 20, 22], [60, 112, 16, 18], [88, 106, 18, 24]]) {
      g.fillRect(x, y, rw, rh);
    }
  });
}

function kitchenSignTexture(text) {
  return canvasTexture(256, 64, (g, w, h) => {
    g.fillStyle = '#b98a4a';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#2b1a10';
    g.fillRect(5, 5, w - 10, h - 10);
    g.fillStyle = '#f6ead3';
    g.font = 'bold 34px Georgia, serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + 2, w - 24);
  });
}

// Each case picks one of these settings with "theme" in cases.js.
const THEMES = {
  parlor: { chair: 0xc9a24f, cushion: 0x7a2a3a, flowers: [0xe9a8b6, 0xf7efe2, 0xd94f5c], cloth: 0xf1e4cb, top: 0xfff7e6, runner: 0x8a2a3a, balloons: [0xd94f5c, 0xf2c14e, 0xf7efe2, 0x3a8f85], doorSign: 'KITCHEN', hall: false, lantern: false },
  conservatory: { chair: 0xd8b86a, cushion: 0xf4ecd6, flowers: [0xf7efe2, 0xe8c36a, 0xe9a8b6], cloth: 0x7a2a3a, top: 0xfff8e0, runner: 0xc9a24f, balloons: [0xe8c36a, 0xf7efe2, 0x9bb59a, 0xd9b45a], doorSign: 'HOUSE', hall: true, lantern: true },
};

// A moonlit garden seen through the conservatory glass.
function nightGardenTexture() {
  return canvasTexture(512, 256, (g, w, h) => {
    const sky = g.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#0a1330');
    sky.addColorStop(0.55, '#1c2f4f');
    sky.addColorStop(1, '#16301f');
    g.fillStyle = sky;
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffffff';
    for (let i = 0; i < 70; i++) {
      g.globalAlpha = 0.35 + Math.random() * 0.65;
      g.fillRect(Math.random() * w, Math.random() * h * 0.5, 1.5, 1.5);
    }
    g.globalAlpha = 1;
    g.fillStyle = '#fff3c9';
    g.beginPath(); g.arc(w * 0.2, h * 0.22, 16, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#14283a';
    g.beginPath(); g.moveTo(0, h * 0.62);
    g.quadraticCurveTo(w * 0.25, h * 0.45, w * 0.5, h * 0.6);
    g.quadraticCurveTo(w * 0.75, h * 0.72, w, h * 0.55);
    g.lineTo(w, h); g.lineTo(0, h); g.fill();
    for (let i = 0; i < 9; i++) {
      const x = (i + 0.5) * (w / 9) + (Math.random() - 0.5) * 20;
      const r = 26 + Math.random() * 22;
      g.fillStyle = i % 2 ? '#10281b' : '#0d2217';
      g.beginPath(); g.arc(x, h * 0.72, r, 0, Math.PI * 2); g.fill();
      g.fillRect(x - 4, h * 0.72, 8, h * 0.2);
    }
    g.fillStyle = '#0b1d13';
    g.fillRect(0, h * 0.88, w, h * 0.12);
    g.fillStyle = '#ffd27a';
    for (let i = 0; i < 26; i++) {
      g.globalAlpha = 0.5 + Math.random() * 0.5;
      g.beginPath(); g.arc(Math.random() * w, h * 0.5 + Math.random() * h * 0.4, 1.8, 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 1;
  });
}

function tileTexture() {
  return canvasTexture(256, 256, (g, w) => {
    const s = w / 2;
    for (let y = 0; y < 2; y++) {
      for (let x = 0; x < 2; x++) {
        g.fillStyle = (x + y) % 2 ? '#7f9477' : '#d9cfb2';
        g.fillRect(x * s, y * s, s, s);
        g.strokeStyle = 'rgba(60,60,40,0.55)';
        g.lineWidth = 4;
        g.strokeRect(x * s, y * s, s, s);
      }
    }
  });
}

// A palm-like potted plant (drawn with a transparent background).
function plantTexture() {
  return canvasTexture(256, 256, (g, w, h) => {
    g.lineCap = 'round';
    const bx = w / 2, by = h - 6;
    for (let i = 0; i < 9; i++) {
      const a = ((-70 + i * 17.5) * Math.PI) / 180;
      const len = 170 + (i % 3) * 25;
      const tx = bx + Math.sin(a) * len, ty = by - Math.cos(a) * len * 0.95;
      const cx = bx + Math.sin(a) * len * 0.35, cy = by - Math.cos(a) * len - 30;
      g.strokeStyle = '#25502f';
      g.lineWidth = 4;
      g.beginPath(); g.moveTo(bx, by); g.quadraticCurveTo(cx, cy, tx, ty); g.stroke();
      for (let k = 1; k <= 12; k++) {
        const t = k / 13, u = 1 - t;
        const x = u * u * bx + 2 * u * t * cx + t * t * tx;
        const y = u * u * by + 2 * u * t * cy + t * t * ty;
        const dx = 2 * u * (cx - bx) + 2 * t * (tx - cx);
        const dy = 2 * u * (cy - by) + 2 * t * (ty - cy);
        const m = Math.hypot(dx, dy) || 1;
        const nx = -dy / m, ny = dx / m;
        const L = 26 * (1 - t * 0.5);
        g.strokeStyle = k % 2 ? '#2f6b3a' : '#3b8247';
        g.lineWidth = 5;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + nx * L + (dx / m) * 8, y + ny * L + (dy / m) * 8); g.stroke();
        g.beginPath(); g.moveTo(x, y); g.lineTo(x - nx * L + (dx / m) * 8, y - ny * L + (dy / m) * 8); g.stroke();
      }
    }
  });
}

// A warm hallway glimpsed through the house door.
function hallTexture() {
  return canvasTexture(128, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#6a4a30');
    gr.addColorStop(0.5, '#e0b878');
    gr.addColorStop(1, '#f3dca0');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(60,36,20,0.75)';
    g.fillRect(16, 50, 34, 46);
    g.fillRect(70, 60, 40, 52);
    g.fillStyle = 'rgba(255,230,170,0.5)';
    g.fillRect(20, 54, 26, 38);
    g.fillRect(74, 64, 32, 44);
  });
}

export class RoomSystem extends createSystem({}) {
  init() {
    this.hidden = {};
    this.settleUntil = performance.now() + 3000;
    this.layoutKey = '';
    this.cx = undefined;
    this.cz = 0;
    this.floorY = 0;
    this.theta = 0;
    this.last = performance.now();
    this.guests = [];
    this.finalists = [];
    this.helen = null;
    this.panel = null;
    this.built = [];
    this.furn = null;
    this.locket = null;
    this.pianoLid = null;
    this.glows = [];
    this.confetti = null;
    this.lastCelebrate = 0;

    // Character pictures are loaded per case (see cases.js), the first time a case needs them.
    this.tex = {};
    this.failed = new Set();
    this.loading = new Set();
    this.loader = new TextureLoader();

    // Shared materials for the decor.
    const glowMap = glowTexture();
    this.glowMat = new MeshBasicMaterial({ map: glowMap, transparent: true, blending: AdditiveBlending, depthWrite: false, side: DoubleSide });
    this.poolMat = new MeshBasicMaterial({ map: glowMap, transparent: true, opacity: 0.55, blending: AdditiveBlending, depthWrite: false, side: DoubleSide });
    this.doorGlowMat = new MeshBasicMaterial({ map: glowMap, transparent: true, opacity: 0.4, blending: AdditiveBlending, depthWrite: false, side: DoubleSide });
    this.doorPoolMat = new MeshBasicMaterial({ map: glowMap, transparent: true, opacity: 0.3, blending: AdditiveBlending, depthWrite: false, side: DoubleSide });
    this.shadowMat = new MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false, side: DoubleSide });
    this.skyMat = new MeshBasicMaterial({ map: skyTexture() });
    this.bannerMat = new MeshBasicMaterial({ map: bannerTexture('Earshot'), side: DoubleSide });
    this.bulbGeo = new SphereGeometry(0.035, 8, 6);
    this.bulbMat = mat(0xffe2a8);

    this.party = new Group();
    this.themeName = null;
    this.shell = null;
    this.setTheme('parlor');
    this.addToScene(this.party);
    this.unifyLabels();

    // Re-centre the room when the session changes.
    const vs = this.world.visibilityState;
    if (vs && vs.subscribe) {
      this.cleanupFuncs.push(
        vs.subscribe(() => {
          this.settleUntil = performance.now() + 3000;
        })
      );
    }
  }

  addToScene(obj) {
    const w = this.world;
    if (w && w.scene && w.scene.add) w.scene.add(obj);
    else w.createTransformEntity(obj);
  }

  // Glow cards that always turn to face the player (a flat glow looks like an oval from the side).
  billboard(mesh) {
    this.glows.push(mesh);
    return mesh;
  }

  // The pictures a case needs: [name, url]. "shared" pictures (Helen) always come from characters/.
  imageList(cs) {
    const out = [];
    for (const k of cs.images) out.push([k, (cs.art || 'characters/') + k + '.png']);
    for (const k of cs.shared || []) out.push([k, 'characters/' + k + '.png']);
    return out;
  }

  ensureImages(list) {
    for (const [k, url] of list) {
      if (this.tex[k] || this.loading.has(k)) continue;
      this.loading.add(k);
      this.loader.load(
        url,
        (t) => { t.colorSpace = SRGBColorSpace; this.tex[k] = t; },
        undefined,
        () => { this.failed.add(k); console.warn('Earshot: could not load ' + url); }
      );
    }
  }

  // Each case has its own setting (see "theme" in cases.js). Switching rebuilds walls, floor and ceiling.
  setTheme(name) {
    if (this.themeName === name) return;
    this.themeName = name;
    this.theme = THEMES[name] || THEMES.parlor;
    if (this.shell && this.shell.parent) this.shell.parent.remove(this.shell);
    this.shell = new Group();
    this.party.add(this.shell);
    if (name === 'conservatory') this.buildConservatoryShell();
    else this.buildParlorShell();
  }

  // Setting 1: the classic dining room (wallpaper, panelling, trim, parquet floor, ceiling and rug).
  // Walls are built from thin strips (not closed boxes) so nothing blocks the view.
  buildParlorShell() {
    const gold = mat(0xb98a4a);
    const wallMat = mat(0xffffff, { map: tile(wallpaperTexture(), ROOM, WALL_H) });
    const panelMat = mat(0xffffff, { map: tile(panelTexture(), ROOM, 1) });
    const floorMat = mat(0xffffff, { map: tile(parquetTexture(), ROOM, ROOM) });

    const walls = wallRing(ROOM, 0, WALL_H, 0, wallMat);
    const wainscot = wallRing(ROOM, 0, 1.0, 0.01, panelMat);
    const chairRail = wallRing(ROOM, 1.0, 1.07, 0.02, gold);
    const baseboard = wallRing(ROOM, 0, 0.14, 0.02, mat(0x2a1810));
    const crown = wallRing(ROOM, 2.8, WALL_H, 0.02, mat(0x8a6a3a));
    const crownLine = wallRing(ROOM, 2.78, 2.8, 0.03, gold);

    const floor = new Mesh(new PlaneGeometry(ROOM, ROOM), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.01;
    const ceiling = new Mesh(new PlaneGeometry(ROOM, ROOM), mat(0x24121a, { side: DoubleSide }));
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = WALL_H - 0.01;

    const rugEdge = new Mesh(new CylinderGeometry(2.4, 2.4, 0.01, 40), gold);
    rugEdge.position.y = 0.014;
    const rug = new Mesh(new CylinderGeometry(2.3, 2.3, 0.01, 40), mat(0x5b2432));
    rug.position.y = 0.02;
    const rugRing = new Mesh(new CylinderGeometry(1.9, 1.9, 0.01, 40), gold);
    rugRing.position.y = 0.024;
    const rugInner = new Mesh(new CylinderGeometry(1.85, 1.85, 0.01, 40), mat(0x6e2a3a));
    rugInner.position.y = 0.028;

    this.shell.add(walls, wainscot, chairRail, baseboard, crown, crownLine, floor, ceiling, rugEdge, rug, rugRing, rugInner);
  }

  // Setting 2: a moonlit garden conservatory: glass walls in iron frames, tiled floor, glass roof.
  buildConservatoryShell() {
    const sh = this.shell;
    const iron = mat(0x16221f);
    const brass = mat(0xc9a24f);
    const glass = mat(0xffffff, { map: nightGardenTexture() });
    sh.add(
      wallRing(ROOM, 0.9, 2.85, 0, glass),
      wallRing(ROOM, 0, 0.9, 0.01, mat(0x2c4a3f)),
      wallRing(ROOM, 0.9, 0.96, 0.02, brass),
      wallRing(ROOM, 0, 0.12, 0.02, mat(0x1b2e27)),
      wallRing(ROOM, 2.85, WALL_H, 0.02, iron)
    );

    // Iron frames over the glass.
    for (const [wx, wz, ry] of [[0, -3.46, 0], [0, 3.46, Math.PI], [-3.46, 0, Math.PI / 2], [3.46, 0, -Math.PI / 2]]) {
      const w = new Group();
      w.position.set(wx, 0, wz);
      w.rotation.y = ry;
      for (const o of [-2.8, -1.4, 0, 1.4, 2.8]) {
        const b = new Mesh(new PlaneGeometry(0.07, 1.95), iron);
        b.position.set(o, 1.875, 0);
        w.add(b);
      }
      const bar = new Mesh(new PlaneGeometry(ROOM, 0.06), iron);
      bar.position.set(0, 1.9, 0);
      w.add(bar);
      sh.add(w);
    }

    const floor = new Mesh(new PlaneGeometry(ROOM, ROOM), mat(0xffffff, { map: tile(tileTexture(), ROOM, ROOM) }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.01;
    const roof = new Mesh(new PlaneGeometry(ROOM, ROOM), mat(0x0c1824, { side: DoubleSide }));
    roof.rotation.x = Math.PI / 2;
    roof.position.y = WALL_H - 0.01;
    sh.add(floor, roof);
    for (const v of [-2.3, 0, 2.3]) {
      const a = new Mesh(new BoxGeometry(ROOM, 0.07, 0.09), iron);
      a.position.set(0, WALL_H - 0.05, v);
      const b = new Mesh(new BoxGeometry(0.09, 0.07, ROOM), iron);
      b.position.set(v, WALL_H - 0.05, 0);
      sh.add(a, b);
    }

    // An octagonal gold-and-green medallion instead of a round rug.
    const rings = [[2.4, brass, 0.014], [2.28, mat(0x24463a), 0.02], [1.8, brass, 0.024], [1.74, mat(0x1b362d), 0.028]];
    for (const [r, m, y] of rings) {
      const o = new Mesh(new CylinderGeometry(r, r, 0.01, 8), m);
      o.position.y = y;
      o.rotation.y = Math.PI / 8;
      sh.add(o);
    }
  }

  aspect(tex) {
    return tex && tex.image && tex.image.height ? tex.image.width / tex.image.height : 0.4;
  }

  makeFigure(name, x, z, h) {
    const closed = this.tex[name];
    if (!closed) return null;
    const talk = this.tex[name + '-talk'] || closed;
    const geom = new PlaneGeometry(1, 1);
    geom.translate(0, 0.5, 0); // feet at the origin
    const material = new MeshBasicMaterial({ map: closed, color: 0xf0e2d0, transparent: true, alphaTest: 0.02, side: DoubleSide });
    const mesh = new Mesh(geom, material);
    mesh.renderOrder = 2;
    const aC = this.aspect(closed);
    mesh.scale.set(h * aC, h, 1); // size stays fixed while talking, so figures never pop
    const shadow = new Mesh(new PlaneGeometry(1, 1), this.shadowMat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.012;
    shadow.scale.set(Math.max(0.6, h * aC * 1.3), 0.45, 1);
    shadow.renderOrder = 1;
    const g = new Group();
    g.add(shadow, mesh);
    g.position.set(x, this.floorY, z);
    this.addToScene(g);
    this.built.push(g);
    return { name, g, mesh, material, closed, talk, h, phase: Math.random() * 6.28, vis: 1 };
  }

  clearBuilt() {
    for (const g of this.built) if (g.parent) g.parent.remove(g);
    this.built = [];
    this.guests = [];
    this.finalists = [];
    this.helen = null;
    this.panel = null;
    this.locket = null;
    this.pianoLid = null;
    this.glows = [];
    if (this.furn && this.furn.parent) this.furn.parent.remove(this.furn);
    this.furn = new Group();
    this.party.add(this.furn);
  }

  buildScene(layout, cs) {
    this.clearBuilt();
    this.setTheme(cs.theme || 'parlor');
    const cx = this.cx, cz = this.cz;
    const fwd = window.earshotForward;
    if (!fwd) return;

    // This case's banner.
    const oldBanner = this.bannerMat.map;
    this.bannerMat.map = bannerTexture(cs.banner);
    this.bannerMat.needsUpdate = true;
    if (oldBanner) oldBanner.dispose();

    // Turn the whole room so the back wall is straight ahead of where you started facing.
    const fl = Math.hypot(fwd[0], fwd[1]) || 1;
    const fx = fwd[0] / fl, fz = fwd[1] / fl;
    this.theta = Math.atan2(-fx, -fz);
    this.party.rotation.y = this.theta;
    this.party.position.set(cx, this.floorY, cz);
    const cos = Math.cos(this.theta), sin = Math.sin(this.theta);
    const toWorld = (lx, lz) => [cx + lx * cos + lz * sin, cz - lx * sin + lz * cos];
    const toLocal = (x, z) => {
      const dx = x - cx, dz = z - cz;
      return [dx * cos - dz * sin, dx * sin + dz * cos];
    };

    // Each pair stands just behind its orb, side by side, with a candlelit table behind them.
    const tablePos = [];
    layout.forEach((p, i) => {
      const grp = cs.groups[i];
      if (!grp) return;
      let dx = p.x - cx, dz = p.z - cz;
      const len = Math.hypot(dx, dz) || 1;
      dx /= len; dz /= len;
      const sx = -dz, sz = dx;
      const bx = p.x + dx * 0.55, bz = p.z + dz * 0.55;
      grp.pair.forEach((name, j) => {
        const k = j === 0 ? -1 : 1;
        const f = this.makeFigure(name, bx + sx * 0.36 * k, bz + sz * 0.36 * k, FIG_H);
        if (f) {
          f.partner = [-sx * k, -sz * k]; // direction toward the other person of the pair
          this.guests.push({ fig: f, pair: i, idx: j });
        }
      });
      const l = toLocal(p.x, p.z);
      const ll = Math.hypot(l[0], l[1]) || 1;
      const tx = (l[0] / ll) * 2.7, tz = (l[1] / ll) * 2.7;
      tablePos.push([tx, tz]);
      this.addTable(tx, tz, false);
    });

    // The gift table (nearly empty), or the piano in the anniversary case.
    if (cs.prop === 'piano') this.addPiano();
    else this.addTable(-2.55, -2.95, true, cs.giftLabel || 'For you');
    this.addChairs(tablePos, cs.prop === 'piano');

    this.addDoor();
    this.addBanner();
    this.addStringLights();
    this.addBalloons();
    this.addBuffet();
    if (this.themeName === 'conservatory') {
      this.addGardenDoors();
      this.addPlants();
    } else {
      this.addEntrance();
      this.addWindows();
      this.addChandelier();
      this.addPaintings();
    }

    // Helen waits where you can see her. A case can choose her spot with "host": [x, z] in cases.js
    // (she must not stand behind a pair of guests as seen from the middle of the room).
    const host = cs.host || [DOOR_X + 1.05, -2.8];
    const hw = toWorld(host[0], host[1]);
    this.helen = this.makeFigure('helen', hw[0], hw[1], FIG_H);

    // People who step into view when the case is solved.
    for (const a of cs.finale.appear || []) {
      const w = toWorld(a.x, a.z);
      const f = this.makeFigure(a.name, w[0], w[1], FIG_H);
      if (f) {
        f.vis = 0;
        f.g.visible = false;
        f.material.opacity = 0;
        this.finalists.push(f);
      }
    }

    // The ending illustration, shown above the door once the mystery is solved.
    const pt = this.tex[cs.finale.picture];
    if (pt) {
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
    window.earshotBuilt = cs.id; // tells the game this case's room is ready
  }

  addTable(tx, tz, gift, label) {
    const r = gift ? 0.42 : 0.52;
    const g = new Group();
    g.position.set(tx, 0, tz);
    const cloth = new Mesh(new CylinderGeometry(r, r * 1.1, 0.76, 24), mat(this.theme.cloth));
    cloth.position.y = 0.38;
    const top = new Mesh(new CylinderGeometry(r * 1.02, r * 1.02, 0.025, 24), mat(this.theme.top));
    top.position.y = 0.77;
    const hem = new Mesh(new CylinderGeometry(r * 1.097, r * 1.1, 0.04, 24), mat(0xc9a24f));
    hem.position.y = 0.04;
    g.add(cloth, top, hem);
    const face = Math.atan2(-tx, -tz); // turn glows toward the middle of the room

    if (gift) {
      const rb1 = new Mesh(new BoxGeometry(0.28, 0.006, 0.035), mat(0xd9a24f));
      rb1.position.y = 0.792;
      const rb2 = new Mesh(new BoxGeometry(0.035, 0.006, 0.28), mat(0xd9a24f));
      rb2.position.y = 0.792;
      const card = new Mesh(new PlaneGeometry(0.34, 0.21), new MeshBasicMaterial({ map: labelTexture(label), side: DoubleSide }));
      card.position.set(0, 0.92, 0);
      card.rotation.y = face;
      g.add(rb1, rb2, card);
    } else {
      const runner = new Mesh(new BoxGeometry(0.14, 0.006, 1.0), mat(this.theme.runner));
      runner.position.y = 0.786;
      g.add(runner);
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2 + Math.PI / 4;
        const plate = new Mesh(new CylinderGeometry(0.11, 0.11, 0.012, 16), mat(0xffffff));
        plate.position.set(Math.cos(a) * 0.32, 0.795, Math.sin(a) * 0.32);
        const glass = new Mesh(new CylinderGeometry(0.025, 0.02, 0.14, 8), mat(0xb23a4a));
        glass.position.set(Math.cos(a + 0.35) * 0.25, 0.86, Math.sin(a + 0.35) * 0.25);
        g.add(plate, glass);
      }
      const candle = new Mesh(new CylinderGeometry(0.025, 0.025, 0.16, 8), mat(0xfff1cf));
      candle.position.y = 0.86;
      const flame = new Mesh(new SphereGeometry(0.022, 8, 6), mat(0xffc15a));
      flame.position.y = 0.97;
      const glow = this.billboard(new Mesh(new PlaneGeometry(0.8, 0.8), this.glowMat));
      glow.position.y = 0.98;
      g.add(candle, flame, glow);

      // A small flower arrangement in a glass vase.
      const vase = new Mesh(new CylinderGeometry(0.035, 0.028, 0.14, 10), mat(0x9bb59a));
      vase.position.set(0, 0.86, -0.28);
      g.add(vase);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const fl = new Mesh(new SphereGeometry(0.045, 8, 6), mat(this.theme.flowers[i % 3]));
        fl.position.set(Math.cos(a) * 0.045, 0.96 + (i % 2) * 0.03, -0.28 + Math.sin(a) * 0.045);
        g.add(fl);
      }

      // Pendant lamp (a glass lantern in the conservatory) with a pool of warm light on the floor.
      const cord = new Mesh(new CylinderGeometry(0.008, 0.008, 0.8, 4), mat(0x1a1a1a));
      cord.position.y = 2.6;
      let shade;
      if (this.theme.lantern) {
        shade = new Group();
        const bulb = new Mesh(new SphereGeometry(0.13, 16, 12), mat(0xffd98a));
        bulb.scale.y = 1.3;
        const cap = new Mesh(new CylinderGeometry(0.05, 0.1, 0.06, 12), mat(0xc9a24f));
        cap.position.y = 0.2;
        shade.add(bulb, cap);
      } else {
        shade = new Mesh(new CylinderGeometry(0.1, 0.26, 0.22, 20, 1, true), mat(0xd9a24f, { side: DoubleSide }));
      }
      shade.position.y = 2.1;
      const lampGlow = this.billboard(new Mesh(new PlaneGeometry(1.6, 1.6), this.glowMat));
      lampGlow.position.y = 1.95;
      const pool = new Mesh(new PlaneGeometry(3.2, 3.2), this.poolMat);
      pool.rotation.x = -Math.PI / 2;
      pool.position.y = 0.03;
      if (!this.theme.lantern) g.add(pool); // the conservatory floor is already bright
      g.add(cord, shade, lampGlow);
    }
    this.furn.add(g);
  }

  // A grand piano in the back-left corner (the anniversary case's hiding place).
  addPiano() {
    const g = new Group();
    g.position.set(-2.65, 0, -2.95);
    const body = new Mesh(new BoxGeometry(1.3, 0.3, 0.9), mat(0x17110f));
    body.position.y = 0.82;
    g.add(body);
    for (const [lx, lz] of [[-0.55, -0.35], [0.55, -0.35], [0, 0.35]]) {
      const leg = new Mesh(new CylinderGeometry(0.04, 0.035, 0.68, 8), mat(0x17110f));
      leg.position.set(lx, 0.34, lz);
      g.add(leg);
    }
    // The lid stays shut until the case is solved, then swings open (see update).
    const lidHinge = new Group();
    lidHinge.position.set(0, 0.97, -0.45);
    const lidGeo = new BoxGeometry(1.3, 0.03, 0.85);
    lidGeo.translate(0, 0, 0.425);
    lidHinge.add(new Mesh(lidGeo, mat(0x241a16)));
    lidHinge.rotation.x = 0;
    g.add(lidHinge);
    this.pianoLid = lidHinge;
    const keys = new Mesh(new BoxGeometry(1.1, 0.035, 0.2), mat(0xf6ead3));
    keys.position.set(0, 0.9, 0.52);
    const keyShelf = new Mesh(new BoxGeometry(1.2, 0.05, 0.12), mat(0x17110f));
    keyShelf.position.set(0, 0.86, 0.48);
    g.add(keyShelf, keys);
    const glow = this.billboard(new Mesh(new PlaneGeometry(1.4, 1.4), this.glowMat));
    glow.position.set(0, 1.3, 0.1);
    g.add(glow);

    // Beatrice's locket: appears on the piano once the case is solved.
    const lk = new Group();
    lk.position.set(0, 1.06, -0.05);
    const lbody = new Mesh(new SphereGeometry(0.07, 14, 10), mat(0xf2c14e));
    lbody.scale.set(1, 1.15, 0.45);
    const lchain = new Mesh(new CylinderGeometry(0.005, 0.005, 0.28, 4), mat(0xd9a24f));
    lchain.position.y = 0.17;
    const lglow = this.billboard(new Mesh(new PlaneGeometry(1.0, 1.0), this.glowMat));
    lglow.position.z = 0.06;
    lk.add(lbody, lchain, lglow);
    lk.visible = false;
    g.add(lk);
    this.locket = { grp: lk, glow: lglow, vis: 0 };
    this.furn.add(g);
  }

  // The kitchen door: dark frame, half-open leaf, a dim glimpse of shelves, a soft glow.
  addDoor() {
    const g = new Group();
    g.position.set(DOOR_X, 1.05, -3.44);
    const frame = new Mesh(new PlaneGeometry(1.3, 2.2), mat(0x2b1a10));
    const inside = new Mesh(new PlaneGeometry(0.98, 2.0), new MeshBasicMaterial({ map: this.theme.hall ? hallTexture() : kitchenTexture() }));
    inside.position.z = 0.01;
    const spill = new Mesh(new PlaneGeometry(1.7, 1.7), this.doorGlowMat);
    spill.position.set(0, -0.35, 0.03);
    g.add(frame, inside, spill);

    // The door leaf, hinged on the left and swung into the room.
    const hinge = new Group();
    hinge.position.set(-0.49, 0, 0.02);
    const leafGeo = new PlaneGeometry(0.5, 2.0);
    leafGeo.translate(0.25, 0, 0);
    hinge.add(new Mesh(leafGeo, mat(0x4a2e1c, { side: DoubleSide })));
    const knob = new Mesh(new SphereGeometry(0.025, 8, 6), mat(0xd9a24f));
    knob.position.set(0.44, -0.05, 0.01);
    hinge.add(knob);
    hinge.rotation.y = -1.0;
    g.add(hinge);

    const sign = new Mesh(new PlaneGeometry(0.9, 0.225), new MeshBasicMaterial({ map: kitchenSignTexture(this.theme.doorSign) }));
    sign.position.set(0, 1.3, 0.01);
    g.add(sign);
    this.furn.add(g);

    const floorSpill = new Mesh(new PlaneGeometry(2.0, 2.0), this.doorPoolMat);
    floorSpill.rotation.x = -Math.PI / 2;
    floorSpill.position.set(DOOR_X, 0.03, -2.9);
    this.furn.add(floorSpill);
  }

  // The main entrance, on the wall behind you: closed double doors, brass handles, lit sconces, a mat.
  addEntrance() {
    const g = new Group();
    g.position.set(ENTRANCE_X, 0, 3.43);
    g.rotation.y = Math.PI; // faces into the room

    const frame = new Mesh(new PlaneGeometry(1.95, 2.45), mat(0x2b1a10));
    frame.position.y = 1.225;
    g.add(frame);
    for (const s of [-1, 1]) {
      const leaf = new Mesh(new PlaneGeometry(0.88, 2.3), mat(0x4a2e1c));
      leaf.position.set(s * 0.45, 1.15, 0.01);
      const up = new Mesh(new PlaneGeometry(0.6, 0.85), mat(0x3b2315));
      up.position.set(s * 0.45, 1.65, 0.015);
      const low = new Mesh(new PlaneGeometry(0.6, 0.85), mat(0x3b2315));
      low.position.set(s * 0.45, 0.65, 0.015);
      const handle = new Mesh(new SphereGeometry(0.035, 8, 6), mat(0xd9a24f));
      handle.position.set(s * 0.12, 1.05, 0.04);
      g.add(leaf, up, low, handle);
    }
    const seam = new Mesh(new PlaneGeometry(0.02, 2.3), mat(0x1c110a));
    seam.position.set(0, 1.15, 0.02);
    g.add(seam);

    // Wall sconces either side of the door.
    for (const s of [-1.3, 1.3]) {
      const lamp = new Mesh(new BoxGeometry(0.08, 0.2, 0.06), mat(0xd9a24f));
      lamp.position.set(s, 1.9, 0.04);
      const sconceGlow = this.billboard(new Mesh(new PlaneGeometry(0.9, 0.9), this.glowMat));
      sconceGlow.position.set(s, 1.9, 0.08);
      g.add(lamp, sconceGlow);
    }

    // A welcome mat just inside.
    const matRug = new Mesh(new PlaneGeometry(1.4, 0.7), mat(0x6e2a3a, { side: DoubleSide }));
    matRug.rotation.x = -Math.PI / 2;
    matRug.position.set(0, 0.03, 0.5);
    const matEdge = new Mesh(new PlaneGeometry(1.5, 0.8), mat(0xb98a4a, { side: DoubleSide }));
    matEdge.rotation.x = -Math.PI / 2;
    matEdge.position.set(0, 0.026, 0.5);
    g.add(matEdge, matRug);
    this.furn.add(g);
  }

  addWindows() {
    for (const side of [-1, 1]) {
      const g = new Group();
      g.position.set(side * 3.46, 1.75, -0.3);
      g.rotation.y = -side * Math.PI / 2;
      const frame = new Mesh(new PlaneGeometry(1.95, 1.45), mat(0x2b1a10, { side: DoubleSide }));
      const win = new Mesh(new PlaneGeometry(1.8, 1.3), this.skyMat);
      win.position.z = 0.01;
      const bar1 = new Mesh(new PlaneGeometry(0.05, 1.3), mat(0x2b1a10));
      bar1.position.z = 0.02;
      const bar2 = new Mesh(new PlaneGeometry(1.8, 0.05), mat(0x2b1a10));
      bar2.position.z = 0.02;
      const curtainGeo = new PlaneGeometry(0.34, 1.7);
      const curtainMat = mat(0x7a2a3a, { side: DoubleSide });
      const cl = new Mesh(curtainGeo, curtainMat);
      cl.position.set(-1.1, 0, 0.03);
      const cr = new Mesh(curtainGeo, curtainMat);
      cr.position.set(1.1, 0, 0.03);
      g.add(frame, win, bar1, bar2, cl, cr);
      this.furn.add(g);
    }
  }

  // A cake and champagne flutes on a side table beside the entrance, so turning around is rewarded.
  addBuffet() {
    const g = new Group();
    g.position.set(-1.3, 0, 3.0);
    const body = new Mesh(new BoxGeometry(1.8, 0.76, 0.55), mat(this.theme.cloth));
    body.position.y = 0.38;
    const top = new Mesh(new BoxGeometry(1.84, 0.025, 0.59), mat(this.theme.top));
    top.position.y = 0.77;
    const hem = new Mesh(new BoxGeometry(1.82, 0.04, 0.57), mat(0xc9a24f));
    hem.position.y = 0.04;
    const t1 = new Mesh(new CylinderGeometry(0.2, 0.2, 0.12, 24), mat(0xf6d7de));
    t1.position.y = 0.84;
    const t2 = new Mesh(new CylinderGeometry(0.14, 0.14, 0.11, 24), mat(0xe9a8b6));
    t2.position.y = 0.955;
    g.add(body, top, hem, t1, t2);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const c = new Mesh(new CylinderGeometry(0.008, 0.008, 0.07, 6), mat(0xfff1cf));
      c.position.set(Math.cos(a) * 0.07, 1.04, Math.sin(a) * 0.07);
      const f = new Mesh(new SphereGeometry(0.012, 6, 5), mat(0xffc15a));
      f.position.set(Math.cos(a) * 0.07, 1.085, Math.sin(a) * 0.07);
      g.add(c, f);
    }
    for (const i of [-3, -2, 2, 3]) {
      const p = new Mesh(new CylinderGeometry(0.08, 0.08, 0.012, 14), mat(0xffffff));
      p.position.set(i * 0.24, 0.795, 0);
      g.add(p);
    }
    for (const x of [0.42, 0.52, 0.62, -0.42, -0.52]) {
      const fl = new Mesh(new CylinderGeometry(0.018, 0.012, 0.13, 8), mat(0xe8f0f2));
      fl.position.set(x, 0.86, 0.14);
      g.add(fl);
    }
    const glow = this.billboard(new Mesh(new PlaneGeometry(0.9, 0.9), this.glowMat));
    glow.position.y = 1.08;
    g.add(glow);
    this.furn.add(g);
  }

  addBanner() {
    const b = new Mesh(new PlaneGeometry(2.3, 0.5), this.bannerMat);
    b.position.set(-0.45, 2.4, -3.44);
    this.furn.add(b);
  }

  addChandelier() {
    const g = new Group();
    g.position.set(0, 2.45, 0);
    const chain = new Mesh(new CylinderGeometry(0.01, 0.01, 0.55, 4), mat(0x1a1a1a));
    chain.position.y = 0.28;
    const ring = new Mesh(new CylinderGeometry(0.4, 0.4, 0.03, 32, 1, true), mat(0xb98a4a, { side: DoubleSide }));
    g.add(chain, ring);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const candle = new Mesh(new CylinderGeometry(0.015, 0.015, 0.1, 6), mat(0xfff1cf));
      candle.position.set(Math.cos(a) * 0.4, 0.06, Math.sin(a) * 0.4);
      const bulb = new Mesh(this.bulbGeo, this.bulbMat);
      bulb.position.set(Math.cos(a) * 0.4, 0.13, Math.sin(a) * 0.4);
      g.add(candle, bulb);
    }
    const down = new Mesh(new PlaneGeometry(1.8, 1.8), this.glowMat);
    down.rotation.x = Math.PI / 2;
    down.position.y = -0.05;
    const halo = this.billboard(new Mesh(new PlaneGeometry(1.5, 1.5), this.glowMat));
    halo.position.y = 0.1;
    g.add(down, halo);
    this.furn.add(g);
  }

  addPainting(x, y, z, ry, variant) {
    const w = 0.9, h = 0.68;
    const g = new Group();
    g.position.set(x, y, z);
    g.rotation.y = ry;
    const outer = new Mesh(new PlaneGeometry(w + 0.16, h + 0.16), mat(0xb98a4a));
    const inner = new Mesh(new PlaneGeometry(w + 0.05, h + 0.05), mat(0x2b1a10));
    inner.position.z = 0.005;
    const pic = new Mesh(new PlaneGeometry(w, h), new MeshBasicMaterial({ map: paintingTexture(variant) }));
    pic.position.z = 0.01;
    g.add(outer, inner, pic);
    this.furn.add(g);
  }

  addPaintings() {
    this.addPainting(-2.3, 1.95, -3.43, 0, 0);            // back wall, above the gift table / piano
    this.addPainting(-3.43, 1.95, 1.9, Math.PI / 2, 1);   // left wall
    this.addPainting(3.43, 1.95, 1.9, -Math.PI / 2, 0);   // right wall
    this.addPainting(-1.6, 1.95, 3.43, Math.PI, 1);       // wall behind you, above the cake table
  }

  addStringLights() {
    const runs = [
      [-3.4, -3.45, 3.4, -3.45],
      [-3.45, -3.4, -3.45, 3.4],
      [3.45, -3.4, 3.45, 3.4],
    ];
    for (const r of runs) {
      const n = 20;
      for (let s = 0; s < n; s++) {
        const t = s / (n - 1);
        const x = r[0] + (r[2] - r[0]) * t;
        const z = r[1] + (r[3] - r[1]) * t;
        const swag = (t * 3) % 1;
        const b = new Mesh(this.bulbGeo, this.bulbMat);
        b.position.set(x, 2.88 - 0.2 * Math.sin(Math.PI * swag), z);
        this.furn.add(b);
      }
    }
  }

  // Balloons tied to little gold weights on the floor.
  addBalloons() {
    const colors = this.theme.balloons;
    const spots = [[-3.0, -2.4], [3.0, -2.4], [-3.0, 1.8], [3.0, 1.8]];
    spots.forEach((sp, k) => {
      for (let i = 0; i < 3; i++) {
        const b = new Mesh(new SphereGeometry(1, 12, 10), mat(colors[(k + i) % 4]));
        b.scale.set(0.17, 0.21, 0.17);
        b.position.set(sp[0] + (i - 1) * 0.18, 2.35 + ((i + k) % 2) * 0.18, sp[1] + (i % 2) * 0.1);
        this.furn.add(b);
        const len = b.position.y - 0.1;
        const s = new Mesh(new CylinderGeometry(0.004, 0.004, len, 4), mat(0xeeeeee));
        s.position.set(b.position.x, 0.1 + len / 2, b.position.z);
        const wt = new Mesh(new CylinderGeometry(0.025, 0.03, 0.06, 8), mat(0xc9a24f));
        wt.position.set(b.position.x, 0.04, b.position.z);
        this.furn.add(s, wt);
      }
    });
  }

  // Confetti that rains down when a case is solved.
  startConfetti() {
    if (!this.confetti) {
      const cols = [0xf2c14e, 0xf7efe2, 0xd94f5c, 0x3a8f85, 0xe9a8b6].map((c) => new MeshBasicMaterial({ color: c, side: DoubleSide }));
      const geo = new PlaneGeometry(0.05, 0.08);
      this.confetti = { pieces: [], active: false };
      for (let i = 0; i < 90; i++) {
        const m = new Mesh(geo, cols[i % cols.length]);
        m.visible = false;
        this.addToScene(m);
        this.confetti.pieces.push({ m, vy: 0, sp: 0, ph: 0 });
      }
    }
    const C = this.confetti;
    C.active = true;
    for (const p of C.pieces) {
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 2.8;
      p.m.position.set(this.cx + Math.cos(a) * r, this.floorY + 2.4 + Math.random() * 0.5, this.cz + Math.sin(a) * r);
      p.vy = -(0.45 + Math.random() * 0.5);
      p.sp = 1 + Math.random() * 3;
      p.ph = Math.random() * 6.28;
      p.m.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      p.m.visible = true;
    }
  }

  stepConfetti(dt, t) {
    const C = this.confetti;
    if (!C || !C.active) return;
    let any = false;
    for (const p of C.pieces) {
      if (!p.m.visible) continue;
      p.m.position.y += p.vy * dt;
      p.m.position.x += Math.sin(t * p.sp + p.ph) * 0.25 * dt;
      p.m.rotation.x += dt * p.sp;
      p.m.rotation.z += dt * 1.3;
      if (p.m.position.y <= this.floorY + 0.03) p.m.visible = false;
      else any = true;
    }
    if (!any) C.active = false;
  }

  // Gold Chiavari-style chairs pulled up to each guest table (on the sides, so the pairs stay visible in front).
  addChairs(tables, hasPiano) {
    const frame = mat(this.theme.chair);
    const cush = mat(this.theme.cushion);
    for (const [tx, tz] of tables) {
      const len = Math.hypot(tx, tz) || 1;
      const ox = tx / len, oz = tz / len;   // outward from the middle of the room
      const sx = -oz, sz = ox;              // sideways
      for (const side of [-1, 1]) {
        const cx = tx + sx * side * 0.88 + ox * 0.12;
        const cz = tz + sz * side * 0.88 + oz * 0.12;
        if (Math.abs(cx) > 3.15 || Math.abs(cz) > 3.15) continue;           // outside the room
        if (hasPiano && cx < -1.75 && cz < -2.2) continue;                  // would sit inside the piano
        const c = new Group();
        c.position.set(cx, 0, cz);
        c.rotation.y = Math.atan2(tx - cx, tz - cz); // front of the chair faces its table
        const seat = new Mesh(new BoxGeometry(0.4, 0.03, 0.4), frame);
        seat.position.y = 0.43;
        const pad = new Mesh(new BoxGeometry(0.35, 0.05, 0.35), cush);
        pad.position.y = 0.47;
        c.add(seat, pad);
        for (const [lx, lz] of [[-0.17, -0.17], [0.17, -0.17], [-0.17, 0.17], [0.17, 0.17]]) {
          const leg = new Mesh(new CylinderGeometry(0.014, 0.011, 0.42, 8), frame);
          leg.position.set(lx, 0.21, lz);
          c.add(leg);
        }
        for (const lx of [-0.17, 0.17]) {
          const post = new Mesh(new CylinderGeometry(0.012, 0.012, 0.5, 8), frame);
          post.position.set(lx, 0.67, -0.17);
          c.add(post);
        }
        const topRail = new Mesh(new BoxGeometry(0.38, 0.035, 0.03), frame);
        topRail.position.set(0, 0.93, -0.17);
        c.add(topRail);
        for (const y of [0.62, 0.78]) {
          const rung = new Mesh(new BoxGeometry(0.34, 0.016, 0.016), frame);
          rung.position.set(0, y, -0.17);
          c.add(rung);
        }
        this.furn.add(c);
      }
    }
  }

  // One label everywhere: the SDK's own button says "Enter XR", but the title screen says "Enter VR".
  unifyLabels() {
    const re = /\b(Enter|Exit) XR\b/g;
    const fix = (root) => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = walker.nextNode())) {
        if (n.nodeValue && re.test(n.nodeValue)) { re.lastIndex = 0; n.nodeValue = n.nodeValue.replace(re, '$1 VR'); }
        re.lastIndex = 0;
      }
      for (const el of root.querySelectorAll('*')) {
        if (el.shadowRoot) fix(el.shadowRoot);
        for (const attr of ['aria-label', 'title']) {
          const v = el.getAttribute && el.getAttribute(attr);
          if (v && /(Enter|Exit) XR/.test(v)) el.setAttribute(attr, v.replace(re, '$1 VR'));
          re.lastIndex = 0;
        }
      }
    };
    const run = () => { try { fix(document.body); } catch (e) { /* ignore */ } };
    run();
    const id = setInterval(run, 1000);
    this.cleanupFuncs.push(() => clearInterval(id));
  }

  // The conservatory's garden doors, on the wall behind you: iron-framed glass onto the night garden.
  addGardenDoors() {
    const g = new Group();
    g.position.set(ENTRANCE_X, 0, 3.43);
    g.rotation.y = Math.PI; // faces into the room
    const iron = mat(0x16221f);
    const frame = new Mesh(new PlaneGeometry(1.95, 2.45), iron);
    frame.position.y = 1.225;
    const tex = nightGardenTexture();
    tex.repeat.set(0.45, 1);
    tex.offset.set(0.3, 0);
    const pane = new Mesh(new PlaneGeometry(1.75, 2.3), new MeshBasicMaterial({ map: tex }));
    pane.position.set(0, 1.15, 0.01);
    g.add(frame, pane);
    for (const [bw, bh, by] of [[0.05, 2.3, 1.15], [1.75, 0.04, 0.8], [1.75, 0.04, 1.5]]) {
      const b = new Mesh(new PlaneGeometry(bw, bh), iron);
      b.position.set(0, by, 0.02);
      g.add(b);
    }
    for (const s of [-1, 1]) {
      const handle = new Mesh(new SphereGeometry(0.03, 8, 6), mat(0xc9a24f));
      handle.position.set(s * 0.1, 1.05, 0.05);
      g.add(handle);
    }
    for (const s of [-1.3, 1.3]) {
      const lamp = new Mesh(new BoxGeometry(0.08, 0.2, 0.06), mat(0xc9a24f));
      lamp.position.set(s, 1.9, 0.04);
      const sconceGlow = this.billboard(new Mesh(new PlaneGeometry(0.9, 0.9), this.glowMat));
      sconceGlow.position.set(s, 1.9, 0.08);
      g.add(lamp, sconceGlow);
    }
    this.furn.add(g);
  }

  // Potted palms around the edges of the conservatory.
  addPlants() {
    const leafMat = new MeshBasicMaterial({ map: plantTexture(), transparent: true, alphaTest: 0.3, side: DoubleSide });
    const spots = [[3.2, -3.15, 0.9], [-3.15, -1.6, 0.9], [3.15, -1.9, 1.0], [3.1, 3.0, 1.0], [-3.15, 3.1, 1.1]];
    spots.forEach(([x, z, s], k) => {
      const g = new Group();
      g.position.set(x, 0, z);
      const pot = new Mesh(new CylinderGeometry(0.2 * s, 0.15 * s, 0.4 * s, 14), mat(0xb5653a));
      pot.position.y = 0.2 * s;
      const rim = new Mesh(new CylinderGeometry(0.22 * s, 0.22 * s, 0.05, 14), mat(0xc4764a));
      rim.position.y = 0.42 * s;
      g.add(pot, rim);
      for (let i = 0; i < 3; i++) {
        const p = new Mesh(new PlaneGeometry(1.5 * s, 1.5 * s), leafMat);
        p.position.y = 0.4 * s + 0.75 * s;
        p.rotation.y = (i * Math.PI) / 3 + k;
        g.add(p);
      }
      this.furn.add(g);
    });
  }

  setMouth(f, open) {
    const tx = open ? f.talk : f.closed;
    if (f.material.map !== tx) f.material.map = tx;
  }

  animate(f, t, hx, hz, speaking, level) {
    const amp = Math.min(0.7, level * 8);
    // Face the player, turned a little toward the conversation partner so pairs look like they are talking.
    let dx = hx - f.g.position.x, dz = hz - f.g.position.z;
    const dl = Math.hypot(dx, dz) || 1;
    dx /= dl; dz /= dl;
    if (f.partner) {
      const c = Math.cos(PAIR_TURN), sn = Math.sin(PAIR_TURN);
      const nx = dx * c + f.partner[0] * sn, nz = dz * c + f.partner[1] * sn;
      dx = nx; dz = nz;
    }
    f.g.rotation.y = Math.atan2(dx, dz);
    f.g.rotation.z = Math.sin(t * 2.2 + f.phase) * 0.01 + (speaking ? Math.sin(t * 5 + f.phase) * 0.02 * amp : 0);
    f.g.position.y = this.floorY + (speaking ? Math.abs(Math.sin(t * 6 + f.phase)) * 0.01 * amp : 0);
    this.setMouth(f, speaking && level > 0.04 && Math.sin(t * 16 + f.phase) > -0.1);
  }

  update() {
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    const t = now / 1000;

    // Hide Meta's starter props. The welcome panel is kept hidden and moved far away every frame,
    // because the UI toolkit keeps bringing it back in the flat preview.
    for (const id of HIDE_IDS) {
      if (this.hidden[id] && id !== 'welcome-panel') continue;
      let o = null;
      try { o = this.world.getSceneObject(id); } catch (e) { o = null; }
      if (o) {
        o.visible = false;
        if (id === 'welcome-panel') {
          o.position.set(0, -50, 0);
          o.scale.setScalar(0.001);
        }
        this.hidden[id] = true;
      }
    }

    // Keep the room centred on the player while the session is settling.
    const head = this.player.head;
    head.updateWorldMatrix(true, false);
    const m = head.matrixWorld.elements;
    const hx = m[12], hz = m[14];
    const baseY = m[13] > 0.5 ? m[13] : 1.4;
    if (now < this.settleUntil || this.cx === undefined) {
      this.cx = hx;
      this.cz = hz;
      this.floorY = baseY - 1.25;
      this.party.position.set(this.cx, this.floorY, this.cz);
    }

    // Build the guests and decor once this case's pictures are loaded and the layout is known.
    const cs = window.earshotCase;
    const layout = window.earshotLayout;
    if (cs && layout) {
      const list = this.imageList(cs);
      this.ensureImages(list);
      const done = list.every(([k]) => this.tex[k] || this.failed.has(k));
      if (done) {
        const key = cs.id + '|' + layout.map((p) => p.x.toFixed(2) + ',' + p.z.toFixed(2)).join('|') + '@' + this.floorY.toFixed(2);
        if (key !== this.layoutKey) {
          this.layoutKey = key;
          this.buildScene(layout, cs);
        }
      }
    }

    // Warm glows always face the player (a flat glow looks like an oval from the side).
    for (const gl of this.glows) gl.lookAt(hx, m[13], hz);

    const st = window.earshotState;
    if (!st) return;

    // Confetti when a case is solved.
    if (st.celebrate !== this.lastCelebrate) {
      this.lastCelebrate = st.celebrate;
      if (st.celebrate > 0) this.startConfetti();
    }
    this.stepConfetti(dt, t);

    // Guests: the speaker's mouth moves and body nods with their voice.
    for (const gst of this.guests) {
      const cv = st.convos[gst.pair];
      if (!cv) continue;
      this.animate(gst.fig, t, hx, hz, cv.speaker === gst.idx && cv.level > 0.02, cv.level);
    }

    // Helen speaks the intro, the question and the reveal.
    if (this.helen) {
      this.animate(this.helen, t, hx, hz, st.helenLevel > 0.02, st.helenLevel);
    }

    // The people and the picture from the ending appear once the case is solved.
    const solved = !!st.revealed;
    for (const f of this.finalists) {
      f.vis = solved ? Math.min(1, f.vis + dt * 0.8) : 0;
      f.g.visible = f.vis > 0;
      f.material.opacity = f.vis;
      if (f.g.visible) this.animate(f, t, hx, hz, false, 0);
    }
    if (this.locket) {
      this.locket.vis = solved ? Math.min(1, this.locket.vis + dt * 0.8) : 0;
      this.locket.grp.visible = this.locket.vis > 0;
      this.locket.grp.scale.setScalar(0.2 + 0.8 * this.locket.vis);
      this.locket.glow.scale.setScalar(1 + 0.15 * Math.sin(t * 3));
    }
    if (this.pianoLid) this.pianoLid.rotation.x = -0.75 * (this.locket ? this.locket.vis : 0);
    if (this.panel) {
      this.panel.vis = solved ? Math.min(1, this.panel.vis + dt * 0.5) : 0;
      this.panel.grp.visible = this.panel.vis > 0;
      this.panel.pic.material.opacity = this.panel.vis;
    }
  }
}