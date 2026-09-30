import { createSystem } from '@iwsdk/core';

// Temporary test sound. Later, put a voice clip in public/audio and change this.
const VOICE_URL = '/audio/chime.mp3';
// If hands aren't detected, try 'indexTipSpaces' here.
const HAND_SPACE = 'gripSpaces';

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smooth = (t) => t * t * (3 - 2 * t);

export class EarshotSystem extends createSystem({}) {
  init() {
    this.ready = false;
    this.sourceSet = false;
    this.warned = false;
    this.hud = document.createElement('div');
    this.hud.style.cssText = 'position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:99999;padding:8px 14px;background:rgba(0,0,0,.7);color:#fff;font:16px monospace;border-radius:8px;pointer-events:none';
    document.body.appendChild(this.hud);
    const start = () => {
      window.removeEventListener('pointerdown', start);
      window.removeEventListener('keydown', start);
      this.startAudio();
    };
    window.addEventListener('pointerdown', start);
    window.addEventListener('keydown', start);
  }

  async startAudio() {
    const ctx = new AudioContext();
    await ctx.resume();
    const response = await fetch(VOICE_URL);
    const buffer = await ctx.decodeAudioData(await response.arrayBuffer());

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 500;

    this.gain = ctx.createGain();
    this.gain.gain.value = 0.15;

    this.panner = new PannerNode(ctx, {
      panningModel: 'HRTF',
      distanceModel: 'inverse',
      refDistance: 1,
      rolloffFactor: 0.5,
    });

    source.connect(this.filter).connect(this.gain).connect(this.panner).connect(ctx.destination);
    source.start();
    this.ctx = ctx;
    this.ready = true;
  }

  getPos(entity) {
    const obj = entity && entity.object3D;
    if (!obj) return null;
    obj.updateWorldMatrix(true, false);
    const e = obj.matrixWorld.elements;
    return [e[12], e[13], e[14]];
  }

  update() {
    if (!this.ready) return;

    const head = this.player.head;
    head.updateWorldMatrix(true, false);
    const m = head.matrixWorld.elements;
    const px = m[12], py = m[13], pz = m[14];
    const fx = -m[8], fy = -m[9], fz = -m[10];
    const ux = m[4], uy = m[5], uz = m[6];

    // Place the voice once: 1.2 m to the left and 1 m ahead of where you start.
    if (!this.sourceSet) {
      const flat = Math.hypot(fx, fz) || 1;
      const ffx = fx / flat, ffz = fz / flat;
      const rx = -ffz, rz = ffx;
      this.sx = px - rx * 1.2 + ffx * 1.0;
      this.sy = py;
      this.sz = pz - rz * 1.2 + ffz * 1.0;
      this.panner.positionX.value = this.sx;
      this.panner.positionY.value = this.sy;
      this.panner.positionZ.value = this.sz;
      this.sourceSet = true;
    }

    const l = this.ctx.listener;
    l.positionX.value = px; l.positionY.value = py; l.positionZ.value = pz;
    l.forwardX.value = fx; l.forwardY.value = fy; l.forwardZ.value = fz;
    l.upX.value = ux; l.upY.value = uy; l.upZ.value = uz;

    // LOOK: how directly are you facing the voice?
    const dx = this.sx - px, dy = this.sy - py, dz = this.sz - pz;
    const len = Math.hypot(dx, dy, dz) || 1;
    const cos = (dx * fx + dy * fy + dz * fz) / len;
    const look = smooth(clamp01((cos - 0.5) / (0.95 - 0.5)));

    // CUP: is a hand raised near your head, on the side of the voice?
    let minHd = 9;
    let cup = 0;
    const spaces =
      this.world && this.world.playerSpaceEntities && this.world.playerSpaceEntities[HAND_SPACE];
    if (spaces) {
      for (const side of ['left', 'right']) {
        const p = this.getPos(spaces[side]);
        if (!p) continue;
        const hx = p[0] - px, hy = p[1] - py, hz = p[2] - pz;
        const hd = Math.hypot(hx, hy, hz) || 1;
        minHd = Math.min(minHd, hd);
        const nearness = clamp01((0.35 - hd) / 0.15); // 1 within 20 cm of the head, 0 beyond 35 cm
        const align = clamp01((hx * dx + hy * dy + hz * dz) / (hd * len) / 0.6);
        cup = Math.max(cup, nearness * align);
      }
    } else if (!this.warned) {
      console.warn('Earshot: hand spaces not found on world.playerSpaceEntities');
      this.warned = true;
    }

    const focus = clamp01(0.5 * look + 0.8 * cup);
    const now = this.ctx.currentTime;
    this.gain.gain.setTargetAtTime(0.15 + 0.85 * focus, now, 0.1);
    this.filter.frequency.setTargetAtTime(500 + 7500 * focus, now, 0.1);

    this.hud.textContent = 'look ' + look.toFixed(2) + '   cup ' + cup.toFixed(2) + '   hand ' + minHd.toFixed(2) + 'm';
  }
}