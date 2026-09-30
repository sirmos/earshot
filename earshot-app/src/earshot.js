import { createSystem } from '@iwsdk/core';

// If hands aren't detected, try 'indexTipSpaces' here.
const HAND_SPACE = 'gripSpaces';

// angle: degrees from straight ahead (negative = left, positive = right)
// Replace the url with real voice clips later, e.g. '/audio/voice1.m4a'
const VOICES = [
  { url: '/audio/chime.mp3', angle: -60, dist: 1.4, rate: 1.0 },
  { url: '/audio/chime.mp3', angle: 60, dist: 1.4, rate: 0.6 },
];

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smooth = (t) => t * t * (3 - 2 * t);

export class EarshotSystem extends createSystem({}) {
  init() {
    this.ready = false;
    this.placed = false;
    this.warned = false;

    this.hud = document.createElement('div');
    this.hud.style.cssText =
      'position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:99999;padding:8px 14px;background:rgba(0,0,0,.7);color:#fff;font:14px monospace;border-radius:8px;pointer-events:none;white-space:pre';
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

    this.voices = [];
    for (const cfg of VOICES) {
      const response = await fetch(cfg.url);
      const buffer = await ctx.decodeAudioData(await response.arrayBuffer());

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.playbackRate.value = cfg.rate;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 500;

      const gain = ctx.createGain();
      gain.gain.value = 0.15;

      const panner = new PannerNode(ctx, {
        panningModel: 'HRTF',
        distanceModel: 'inverse',
        refDistance: 1,
        rolloffFactor: 0.5,
      });

      source.connect(filter).connect(gain).connect(panner).connect(ctx.destination);
      source.start();
      this.voices.push({ cfg, filter, gain, panner, x: 0, y: 0, z: 0 });
    }

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

    // Place every voice once, relative to where you are facing at the start.
    if (!this.placed) {
      const flat = Math.hypot(fx, fz) || 1;
      const ffx = fx / flat, ffz = fz / flat;
      const rx = -ffz, rz = ffx;
      for (const v of this.voices) {
        const a = (v.cfg.angle * Math.PI) / 180;
        const dirx = ffx * Math.cos(a) + rx * Math.sin(a);
        const dirz = ffz * Math.cos(a) + rz * Math.sin(a);
        v.x = px + dirx * v.cfg.dist;
        v.y = py;
        v.z = pz + dirz * v.cfg.dist;
        v.panner.positionX.value = v.x;
        v.panner.positionY.value = v.y;
        v.panner.positionZ.value = v.z;
      }
      this.placed = true;
    }

    const l = this.ctx.listener;
    l.positionX.value = px; l.positionY.value = py; l.positionZ.value = pz;
    l.forwardX.value = fx; l.forwardY.value = fy; l.forwardZ.value = fz;
    l.upX.value = ux; l.upY.value = uy; l.upZ.value = uz;

    // Collect hand positions once per frame.
    const hands = [];
    const spaces =
      this.world && this.world.playerSpaceEntities && this.world.playerSpaceEntities[HAND_SPACE];
    if (spaces) {
      for (const side of ['left', 'right']) {
        const p = this.getPos(spaces[side]);
        if (p) hands.push(p);
      }
    } else if (!this.warned) {
      console.warn('Earshot: hand spaces not found on world.playerSpaceEntities');
      this.warned = true;
    }

    const now = this.ctx.currentTime;
    const lines = [];
    this.voices.forEach((v, i) => {
      const dx = v.x - px, dy = v.y - py, dz = v.z - pz;
      const len = Math.hypot(dx, dy, dz) || 1;

      // LOOK: how directly are you facing this voice?
      const cos = (dx * fx + dy * fy + dz * fz) / len;
      const look = smooth(clamp01((cos - 0.5) / (0.95 - 0.5)));

      // CUP: is a hand raised near your head, on the side of this voice?
      let cup = 0;
      for (const p of hands) {
        const hx = p[0] - px, hy = p[1] - py, hz = p[2] - pz;
        const hd = Math.hypot(hx, hy, hz) || 1;
        const nearness = clamp01((0.35 - hd) / 0.15);
        const align = clamp01((hx * dx + hy * dy + hz * dz) / (hd * len) / 0.6);
        cup = Math.max(cup, nearness * align);
      }

      const focus = clamp01(0.5 * look + 0.8 * cup);
      v.gain.gain.setTargetAtTime(0.15 + 0.85 * focus, now, 0.1);
      v.filter.frequency.setTargetAtTime(500 + 7500 * focus, now, 0.1);
      lines.push('voice ' + (i + 1) + '  look ' + look.toFixed(2) + '  cup ' + cup.toFixed(2));
    });

    this.hud.textContent = lines.join('\n');
  }
}