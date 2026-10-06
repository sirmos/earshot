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
const PAIRS = [['tom', 'priya'], ['luca', 'sam'], ['nora', 'jim']]; // left, right, front
const IMAGES = [
  'tom', 'tom-talk', 'priya', 'priya-talk', 'luca', 'luca-talk',
  'sam', 'sam-talk', 'nora', 'nora-talk', 'jim', 'jim-talk',
  'helen', 'helen-talk', 'victor', 'victor-talk', 'victor-pantry',
];
const FIG_H = 1.55; // guest height in metres
const ROOM = 7;
const WALL_H = 3;
const DOOR_X = 1.9; // kitchen door sits on the right of the back wall, clear of the front table
const ENTRANCE_X = 1.2; // main entrance, on the wall behind you
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

function bannerTexture() {
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
    g.fillText('Happy Retirement, Margaret!', w / 2, h / 2 + 4);
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
    g.fillText(text, w / 2, h / 2);
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

function kitchenSignTexture() {
  return canvasTexture(256, 64, (g, w, h) => {
    g.fillStyle = '#b98a4a';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#2b1a10';
    g.fillRect(5, 5, w - 10, h - 10);
    g.fillStyle = '#f6ead3';
    g.font = 'bold 34px Georgia, serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('KITCHEN', w / 2, h / 2 + 2);
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
    this.helen = null;
    this.victor = null;
    this.panel = null;
    this.built = [];
    this.furn = null;

    // Load the character pictures.
    this.tex = {};
    this.failed = 0;
    const loader = new TextureLoader();
    for (const n of IMAGES) {
      loader.load(
        'characters/' + n + '.png',
        (t) => { t.colorSpace = SRGBColorSpace; this.tex[n] = t; },
        undefined,
        () => { this.failed++; console.warn('Earshot: could not load characters/' + n + '.png'); }
      );
    }

    // Shared materials for the decor.
    const glowMap = glowTexture();
    this.glowMat = new MeshBasicMaterial({ map: glowMap, transparent: true, blending: AdditiveBlending, depthWrite: false, side: DoubleSide });
    this.poolMat = new MeshBasicMaterial({ map: glowMap, transparent: true, opacity: 0.55, blending: AdditiveBlending, depthWrite: false, side: DoubleSide });
    this.doorGlowMat = new MeshBasicMaterial({ map: glowMap, transparent: true, opacity: 0.4, blending: AdditiveBlending, depthWrite: false, side: DoubleSide });
    this.doorPoolMat = new MeshBasicMaterial({ map: glowMap, transparent: true, opacity: 0.3, blending: AdditiveBlending, depthWrite: false, side: DoubleSide });
    this.shadowMat = new MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false, side: DoubleSide });
    this.skyMat = new MeshBasicMaterial({ map: skyTexture() });
    this.bannerMat = new MeshBasicMaterial({ map: bannerTexture(), side: DoubleSide });
    this.bulbGeo = new SphereGeometry(0.035, 8, 6);
    this.bulbMat = mat(0xffe2a8);

    this.party = new Group();
    this.buildShell();
    this.addToScene(this.party);

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

  // The room itself: wallpaper, panelling, trim, parquet floor, ceiling and rug.
  // Walls are built from thin strips (not closed boxes) so nothing blocks the view.
  buildShell() {
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

    this.party.add(walls, wainscot, chairRail, baseboard, crown, crownLine, floor, ceiling, rugEdge, rug, rugRing, rugInner);
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
    this.helen = null;
    this.victor = null;
    this.panel = null;
    if (this.furn && this.furn.parent) this.furn.parent.remove(this.furn);
    this.furn = new Group();
    this.party.add(this.furn);
  }

  buildScene(layout) {
    this.clearBuilt();
    const cx = this.cx, cz = this.cz;
    const front = layout[2];
    if (!front) return;

    // Turn the whole room so the back wall is straight ahead of where you started facing.
    let fx = front.x - cx, fz = front.z - cz;
    const fl = Math.hypot(fx, fz) || 1;
    fx /= fl; fz /= fl;
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
    layout.forEach((p, i) => {
      let dx = p.x - cx, dz = p.z - cz;
      const len = Math.hypot(dx, dz) || 1;
      dx /= len; dz /= len;
      const sx = -dz, sz = dx;
      const bx = p.x + dx * 0.55, bz = p.z + dz * 0.55;
      PAIRS[i].forEach((name, j) => {
        const k = j === 0 ? -1 : 1;
        const f = this.makeFigure(name, bx + sx * 0.4 * k, bz + sz * 0.4 * k, FIG_H);
        if (f) this.guests.push({ fig: f, pair: i, idx: j });
      });
      const l = toLocal(p.x, p.z);
      const ll = Math.hypot(l[0], l[1]) || 1;
      this.addTable((l[0] / ll) * 2.7, (l[1] / ll) * 2.7, false);
    });

    // The gift table, nearly empty: a ribbon and a card.
    this.addTable(-2.55, -2.95, true);

    this.addDoor();
    this.addEntrance();
    this.addWindows();
    this.addBanner();
    this.addChandelier();
    this.addPaintings();
    this.addStringLights();
    this.addBalloons();
    this.addBuffet();

    // Helen waits to the right of the kitchen door; Victor will be caught standing in the doorway.
    const hw = toWorld(DOOR_X + 1.05, -2.8);
    const vw = toWorld(DOOR_X - 0.15, -2.6);
    this.helen = this.makeFigure('helen', hw[0], hw[1], FIG_H);
    this.victor = this.makeFigure('victor', vw[0], vw[1], FIG_H);
    if (this.victor) {
      this.victor.vis = 0;
      this.victor.g.visible = false;
      this.victor.material.opacity = 0;
    }

    // The ending illustration, shown above the door once the mystery is solved.
    const pt = this.tex['victor-pantry'];
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
  }

  addTable(tx, tz, gift) {
    const r = gift ? 0.42 : 0.52;
    const g = new Group();
    g.position.set(tx, 0, tz);
    const cloth = new Mesh(new CylinderGeometry(r, r * 1.1, 0.76, 24), mat(0xf1e4cb));
    cloth.position.y = 0.38;
    const top = new Mesh(new CylinderGeometry(r * 1.02, r * 1.02, 0.025, 24), mat(0xfff7e6));
    top.position.y = 0.77;
    g.add(cloth, top);
    const face = Math.atan2(-tx, -tz); // turn glows toward the middle of the room

    if (gift) {
      const rb1 = new Mesh(new BoxGeometry(0.28, 0.006, 0.035), mat(0xd9a24f));
      rb1.position.y = 0.792;
      const rb2 = new Mesh(new BoxGeometry(0.035, 0.006, 0.28), mat(0xd9a24f));
      rb2.position.y = 0.792;
      const card = new Mesh(new PlaneGeometry(0.34, 0.21), new MeshBasicMaterial({ map: labelTexture('For Margaret'), side: DoubleSide }));
      card.position.set(0, 0.92, 0);
      card.rotation.y = face;
      g.add(rb1, rb2, card);
    } else {
      const runner = new Mesh(new BoxGeometry(0.14, 0.006, 1.0), mat(0x8a2a3a));
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
      const glow = new Mesh(new PlaneGeometry(0.8, 0.8), this.glowMat);
      glow.position.y = 0.98;
      glow.rotation.y = face;
      g.add(candle, flame, glow);

      // Pendant lamp with a pool of warm light on the floor.
      const cord = new Mesh(new CylinderGeometry(0.008, 0.008, 0.8, 4), mat(0x1a1a1a));
      cord.position.y = 2.6;
      const shade = new Mesh(new CylinderGeometry(0.1, 0.26, 0.22, 20, 1, true), mat(0xd9a24f, { side: DoubleSide }));
      shade.position.y = 2.1;
      const lampGlow = new Mesh(new PlaneGeometry(1.6, 1.6), this.glowMat);
      lampGlow.position.y = 1.95;
      lampGlow.rotation.y = face;
      const pool = new Mesh(new PlaneGeometry(3.2, 3.2), this.poolMat);
      pool.rotation.x = -Math.PI / 2;
      pool.position.y = 0.03;
      g.add(cord, shade, lampGlow, pool);
    }
    this.furn.add(g);
  }

  // The kitchen door: dark frame, half-open leaf, a dim glimpse of shelves, a soft glow.
  addDoor() {
    const g = new Group();
    g.position.set(DOOR_X, 1.05, -3.44);
    const frame = new Mesh(new PlaneGeometry(1.3, 2.2), mat(0x2b1a10));
    const inside = new Mesh(new PlaneGeometry(0.98, 2.0), new MeshBasicMaterial({ map: kitchenTexture() }));
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

    const sign = new Mesh(new PlaneGeometry(0.9, 0.225), new MeshBasicMaterial({ map: kitchenSignTexture() }));
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
      const sconceGlow = new Mesh(new PlaneGeometry(0.9, 0.9), this.glowMat);
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

  // A small cake and plates on a side table beside the entrance, so turning around is rewarded.
  addBuffet() {
    const g = new Group();
    g.position.set(-1.3, 0, 3.0);
    const body = new Mesh(new BoxGeometry(1.8, 0.76, 0.55), mat(0xf1e4cb));
    body.position.y = 0.38;
    const top = new Mesh(new BoxGeometry(1.84, 0.025, 0.59), mat(0xfff7e6));
    top.position.y = 0.77;
    const t1 = new Mesh(new CylinderGeometry(0.2, 0.2, 0.12, 24), mat(0xf6d7de));
    t1.position.y = 0.84;
    const t2 = new Mesh(new CylinderGeometry(0.14, 0.14, 0.11, 24), mat(0xe9a8b6));
    t2.position.y = 0.955;
    g.add(body, top, t1, t2);
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
    const glow = new Mesh(new PlaneGeometry(0.9, 0.9), this.glowMat);
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
    const cross1 = new Mesh(new PlaneGeometry(1.2, 1.2), this.glowMat);
    cross1.position.y = 0.1;
    const cross2 = new Mesh(new PlaneGeometry(1.2, 1.2), this.glowMat);
    cross2.position.y = 0.1;
    cross2.rotation.y = Math.PI / 2;
    g.add(down, cross1, cross2);
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
    this.addPainting(-2.3, 1.95, -3.43, 0, 0);            // back wall, above the gift table
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

  addBalloons() {
    const colors = [0xd94f5c, 0xf2c14e, 0xf7efe2, 0x3a8f85];
    const spots = [[-3.0, -2.4], [3.0, -2.4], [-3.0, 1.8], [3.0, 1.8]];
    spots.forEach((sp, k) => {
      for (let i = 0; i < 3; i++) {
        const b = new Mesh(new SphereGeometry(1, 12, 10), mat(colors[(k + i) % 4]));
        b.scale.set(0.17, 0.21, 0.17);
        b.position.set(sp[0] + (i - 1) * 0.18, 2.35 + ((i + k) % 2) * 0.18, sp[1] + (i % 2) * 0.1);
        this.furn.add(b);
        const s = new Mesh(new CylinderGeometry(0.004, 0.004, 1.3, 4), mat(0xeeeeee));
        s.position.set(b.position.x, b.position.y - 0.75, b.position.z);
        this.furn.add(s);
      }
    });
  }

  setMouth(f, open) {
    const tx = open ? f.talk : f.closed;
    if (f.material.map !== tx) f.material.map = tx;
  }

  animate(f, t, hx, hz, speaking, level) {
    const amp = Math.min(0.7, level * 8);
    f.g.rotation.y = Math.atan2(hx - f.g.position.x, hz - f.g.position.z); // face the player
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

    // Build the guests and decor once the pictures are loaded and the layout is known.
    const layout = window.earshotLayout;
    const loaded = Object.keys(this.tex).length + this.failed >= IMAGES.length;
    if (layout && loaded) {
      const key = layout.map((p) => p.x.toFixed(2) + ',' + p.z.toFixed(2)).join('|') + '@' + this.floorY.toFixed(2);
      if (key !== this.layoutKey) {
        this.layoutKey = key;
        this.buildScene(layout);
      }
    }

    const st = window.earshotState;
    if (!st) return;

    // Guests: the speaker's mouth moves and body nods with their voice.
    for (const gst of this.guests) {
      const cs = st.convos[gst.pair];
      this.animate(gst.fig, t, hx, hz, cs.speaker === gst.idx && cs.level > 0.02, cs.level);
    }

    // Helen speaks the intro.
    if (this.helen) {
      this.animate(this.helen, t, hx, hz, st.phase === 'intro' && st.introLevel > 0.02, st.introLevel);
    }

    // Victor and the pantry picture appear when the mystery is solved.
    const solved = st.phase === 'solved';
    if (this.victor) {
      this.victor.vis = solved ? Math.min(1, this.victor.vis + dt * 0.8) : 0;
      this.victor.g.visible = this.victor.vis > 0;
      this.victor.material.opacity = this.victor.vis;
      if (this.victor.g.visible) this.animate(this.victor, t, hx, hz, false, 0);
    }
    if (this.panel) {
      this.panel.vis = solved ? Math.min(1, this.panel.vis + dt * 0.5) : 0;
      this.panel.grp.visible = this.panel.vis > 0;
      this.panel.pic.material.opacity = this.panel.vis;
    }
  }
}