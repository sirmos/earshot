import { createSystem } from '@iwsdk/core';

const HAND_SPACE = 'gripSpaces'; // try 'indexTipSpaces' if hands are not detected
const INTRO_URL = '/audio/intro.mp3';
const DING_URL = '/audio/chime.mp3';
const NEED = 2.0;    // seconds of focused listening needed to catch a clue
const CUP_ON = 0.7;  // how "cupped" a hand must be to count as listening
const QUIET = 0.04;  // chatter volume while a clue is playing

// angle: degrees from straight ahead (negative = left, positive = right)
const CONVOS = [
  { name: 'LEFT ', chatter: '/audio/left-chatter.mp3', clue: '/audio/left-clue.mp3', angle: -80, dist: 1.4 },
  { name: 'RIGHT', chatter: '/audio/right-chatter.mp3', clue: '/audio/right-clue.mp3', angle: 80, dist: 1.4 },
  { name: 'FRONT', chatter: '/audio/front-chatter.mp3', clue: '/audio/front-clue.mp3', angle: 0, dist: 1.4 },
];

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smooth = (t) => t * t * (3 - 2 * t);

export class EarshotSystem extends createSystem({}) {
  init() {
    this.ready = false;
    this.placed = false;
    this.warned = false;
    this.phase = 'loading';
    this.caughtCount = 0;
    this.clueUntil = 0;
    this.last = 0;
    this.message = 'Click the page once to start the audio.';

    this.hud = document.createElement('div');
    this.hud.style.cssText =
      'position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:99999;padding:8px 14px;background:rgba(0,0,0,.75);color:#fff;font:14px monospace;border-radius:8px;pointer-events:none;white-space:pre;max-width:90vw';
    document.body.appendChild(this.hud);
    this.hud.textContent = this.message;

    const start = () => {
      window.removeEventListener('pointerdown', start);
      window.removeEventListener('keydown', start);
      this.startAudio();
    };
    window.addEventListener('pointerdown', start);
    window.addEventListener('keydown', start);
  }

  async startAudio() {
    this.message = 'Loading audio...';
    const ctx = new AudioContext();
    await ctx.resume();

    const load = async (url) => {
      const r = await fetch(url);
      if (!r.ok) throw new Error(url + ' (' + r.status + ')');
      return ctx.decodeAudioData(await r.arrayBuffer());
    };

    let all;
    try {
      all = await Promise.all([
        load(INTRO_URL),
        load(DING_URL),
        ...CONVOS.flatMap((c) => [load(c.chatter), load(c.clue)]),
      ]);
    } catch (e) {
      console.error(e);
      this.message = 'Audio failed to load: ' + e.message;
      return;
    }

    this.ctx = ctx;
    this.ding = all[1];
    this.convos = CONVOS.map((cfg, i) => {
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 500;
      const gain = ctx.createGain();
      gain.gain.value = 0.15;
      const clueGain = ctx.createGain();
      clueGain.gain.value = 1.0;
      const panner = new PannerNode(ctx, {
        panningModel: 'HRTF',
        distanceModel: 'inverse',
        refDistance: 1,
        rolloffFactor: 0.5,
      });
      filter.connect(gain).connect(panner).connect(ctx.destination);
      clueGain.connect(panner);
      return {
        cfg,
        chatterBuf: all[2 + i * 2],
        clueBuf: all[3 + i * 2],
        filter, gain, clueGain, panner,
        x: 0, y: 0, z: 0,
        dwell: 0,
        caught: false,
      };
    });

    this.ready = true;
    this.phase = 'intro';
    this.message = 'Helen is speaking... listen.';
    const s = ctx.createBufferSource();
    s.buffer = all[0];
    s.connect(ctx.destination);
    s.onended = () => this.startChatter();
    s.start();
  }

  startChatter() {
    for (const c of this.convos) {
      const src = this.ctx.createBufferSource();
      src.buffer = c.chatterBuf;
      src.loop = true;
      src.connect(c.filter);
      src.start();
    }
    this.phase = 'play';
    this.message = 'Cup a hand toward a conversation to listen in.';
  }

  catchClue(c) {
    c.caught = true;
    this.caughtCount++;
    const ctx = this.ctx;
    const t = ctx.currentTime;

    // Small "ding" to confirm the game noticed.
    const d = ctx.createBufferSource();
    d.buffer = this.ding;
    const dg = ctx.createGain();
    dg.gain.value = 0.3;
    d.connect(dg).connect(ctx.destination);
    d.start(t);

    // The clue itself, clear and spatial, a moment later.
    const s = ctx.createBufferSource();
    s.buffer = c.clueBuf;
    s.connect(c.clueGain);
    s.start(t + 0.4);
    s.onended = () => {
      if (this.caughtCount === this.convos.length) {
        this.phase = 'solved';
        this.message =
          "SOLVED: Victor hid Margaret's gift in the kitchen pantry, and he has the key.";
      }
    };
    this.clueUntil = Math.max(this.clueUntil, performance.now() + (0.4 + c.clueBuf.duration) * 1000 + 300);
    this.message = 'Clue ' + this.caughtCount + ' of ' + this.convos.length + ' caught!';
  }

  getPos(entity) {
    const obj = entity && entity.object3D;
    if (!obj) return null;
    obj.updateWorldMatrix(true, false);
    const e = obj.matrixWorld.elements;
    return [e[12], e[13], e[14]];
  }

  update() {
    if (!this.ready) {
      this.hud.textContent = this.message;
      return;
    }

    const nowMs = performance.now();
    const dt = this.last ? Math.min(0.1, (nowMs - this.last) / 1000) : 0;
    this.last = nowMs;

    const head = this.player.head;
    head.updateWorldMatrix(true, false);
    const m = head.matrixWorld.elements;
    const px = m[12], py = m[13], pz = m[14];
    const fx = -m[8], fy = -m[9], fz = -m[10];
    const ux = m[4], uy = m[5], uz = m[6];

    // Place every conversation once, relative to where you face at the start.
    if (!this.placed) {
      const flat = Math.hypot(fx, fz) || 1;
      const ffx = fx / flat, ffz = fz / flat;
      const rx = -ffz, rz = ffx;
      for (const c of this.convos) {
        const a = (c.cfg.angle * Math.PI) / 180;
        const dirx = ffx * Math.cos(a) + rx * Math.sin(a);
        const dirz = ffz * Math.cos(a) + rz * Math.sin(a);
        c.x = px + dirx * c.cfg.dist;
        c.y = py;
        c.z = pz + dirz * c.cfg.dist;
        c.panner.positionX.value = c.x;
        c.panner.positionY.value = c.y;
        c.panner.positionZ.value = c.z;
      }
      this.placed = true;
    }

    const l = this.ctx.listener;
    l.positionX.value = px; l.positionY.value = py; l.positionZ.value = pz;
    l.forwardX.value = fx; l.forwardY.value = fy; l.forwardZ.value = fz;
    l.upX.value = ux; l.upY.value = uy; l.upZ.value = uz;

    // Hand positions, once per frame.
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
    const clueActive = nowMs < this.clueUntil;
    const lines = ['Clues: ' + this.caughtCount + '/' + this.convos.length];

    for (const c of this.convos) {
      const dx = c.x - px, dy = c.y - py, dz = c.z - pz;
      const len = Math.hypot(dx, dy, dz) || 1;

      // LOOK: how directly you face this conversation.
      const cos = (dx * fx + dy * fy + dz * fz) / len;
      const look = smooth(clamp01((cos - 0.5) / (0.95 - 0.5)));

      // CUP: a hand raised near your head, on the side of this conversation.
      let cup = 0;
      for (const p of hands) {
        const hx = p[0] - px, hy = p[1] - py, hz = p[2] - pz;
        const hd = Math.hypot(hx, hy, hz) || 1;
        const nearness = clamp01((0.35 - hd) / 0.15);
        const align = clamp01((hx * dx + hy * dy + hz * dz) / (hd * len) / 0.6);
        cup = Math.max(cup, nearness * align);
      }

      // Sound: clearer when you look and cup; chatter ducks while a clue plays.
      const focus = clamp01(0.5 * look + 0.8 * cup);
      c.gain.gain.setTargetAtTime(clueActive ? QUIET : 0.15 + 0.85 * focus, now, 0.1);
      c.filter.frequency.setTargetAtTime(clueActive ? 400 : 500 + 7500 * focus, now, 0.1);

      // Catching the clue: cup for about 2 seconds (looking at it makes it faster).
      if (this.phase === 'play' && !c.caught) {
        if (cup >= CUP_ON) c.dwell = Math.min(NEED, c.dwell + dt * (1 + look));
        else c.dwell = Math.max(0, c.dwell - dt);
        if (c.dwell >= NEED) this.catchClue(c);
      }

      const filled = Math.round((10 * c.dwell) / NEED);
      const bar = c.caught ? 'CAUGHT    ' : '#'.repeat(filled) + '-'.repeat(10 - filled);
      lines.push(
        c.cfg.name + '  look ' + look.toFixed(2) + '  cup ' + cup.toFixed(2) + '  [' + bar + ']'
      );
    }

    lines.push('');
    lines.push(this.message);
    this.hud.textContent = lines.join('\n');
  }
}