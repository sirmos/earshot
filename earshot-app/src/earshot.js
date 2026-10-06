import {
  createSystem,
  Mesh,
  SphereGeometry,
  RingGeometry,
  PlaneGeometry,
  MeshBasicMaterial,
  CanvasTexture,
  SRGBColorSpace,
  DoubleSide,
} from '@iwsdk/core';

const TEST = new URLSearchParams(location.search).has('test');
const DEBUG = import.meta.env.DEV || new URLSearchParams(location.search).has('debug');
const HAND_SPACE = 'gripSpaces'; // try 'indexTipSpaces' if hands are not detected
const INTRO_URL = 'audio/intro.mp3';
const DING_URL = 'audio/chime.mp3';
const NEED = 2.0;    // seconds of focused listening needed to catch a clue
const CUP_ON = 0.7;  // how "cupped" a hand must be to count as listening
const QUIET = 0.04;  // chatter volume while a clue is playing

// angle: degrees from straight ahead (negative = left, positive = right)
// startSpeaker / clueSpeaker: 0 or 1 = which of the pair talks (order matches room.js)
const CONVOS = [
  { name: 'LEFT ', chatter: 'audio/left-chatter.mp3', clue: 'audio/left-clue.mp3', angle: -80, dist: 1.4, startSpeaker: 0, clueSpeaker: 1 },
  { name: 'RIGHT', chatter: 'audio/right-chatter.mp3', clue: 'audio/right-clue.mp3', angle: 80, dist: 1.4, startSpeaker: 1, clueSpeaker: 0 },
  { name: 'FRONT', chatter: 'audio/front-chatter.mp3', clue: 'audio/front-clue.mp3', angle: 0, dist: 1.4, startSpeaker: 0, clueSpeaker: 1 },
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
    this.abuf = new Uint8Array(1024);
    window.earshotState = {
      phase: 'loading',
      introLevel: 0,
      convos: CONVOS.map((c) => ({ level: 0, speaker: c.startSpeaker })),
    };

    this.hud = document.createElement('div');
    this.hud.style.cssText =
      'position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:99999;padding:8px 14px;background:rgba(0,0,0,.75);color:#fff;font:14px monospace;border-radius:8px;pointer-events:none;white-space:pre;max-width:90vw';
    this.hud.style.display = DEBUG ? 'block' : 'none';
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

  addToScene(obj) {
    const w = this.world;
    if (w && w.scene && w.scene.add) w.scene.add(obj);
    else w.createTransformEntity(obj);
  }

  levelOf(an) {
    an.getByteTimeDomainData(this.abuf);
    let s = 0;
    for (let i = 0; i < this.abuf.length; i++) {
      const v = (this.abuf[i] - 128) / 128;
      s += v * v;
    }
    return Math.sqrt(s / this.abuf.length);
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
    this.introAn = ctx.createAnalyser();
    this.introAn.fftSize = 1024;

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
      const chatterAn = ctx.createAnalyser();
      chatterAn.fftSize = 1024;
      const clueAn = ctx.createAnalyser();
      clueAn.fftSize = 1024;
      return {
        cfg,
        chatterBuf: all[2 + i * 2],
        clueBuf: all[3 + i * 2],
        filter, gain, clueGain, panner, chatterAn, clueAn,
        x: 0, y: 0, z: 0,
        dwell: 0,
        caught: false,
        pulse: -1,
        lvl: 0,
        quiet: 0,
        speaker: cfg.startSpeaker,
        clueUntil: 0,
      };
    });

    // Give the headset a moment to start the session before Helen begins.
    await new Promise((r) => setTimeout(r, 2500));

    this.ready = true;
    this.phase = 'intro';
    this.message = 'Helen is speaking... listen.';
    const s = ctx.createBufferSource();
    s.buffer = all[0];
    s.connect(ctx.destination);
    s.connect(this.introAn);
    s.onended = () => this.startChatter();
    s.start();
  }

  startChatter() {
    this.placed = false; // re-place everything now that the headset position is valid
    for (const c of this.convos) {
      c.speaker = c.cfg.startSpeaker;
      const src = this.ctx.createBufferSource();
      src.buffer = c.chatterBuf;
      src.loop = true;
      src.connect(c.filter);
      src.connect(c.chatterAn);
      src.start();
    }
    this.phase = 'play';
    this.message = 'Cup a hand toward a conversation to listen in.';
  }

  catchClue(c) {
    c.caught = true;
    c.pulse = 0;
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
    s.connect(c.clueAn);
    s.start(t + 0.4);
    s.onended = () => {
      if (this.caughtCount === this.convos.length) {
        this.phase = 'solved';
        for (const o of this.convos) o.pulse = 0;
        this.message =
          "SOLVED: Victor hid Margaret's gift in the kitchen pantry, and he has the key.";
      }
    };
    c.clueUntil = performance.now() + (0.4 + c.clueBuf.duration) * 1000 + 200;
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

  // Test mode (?test): draws the numbers in front of the player's view inside the headset.
  drawTestHud(lines) {
    if (!this.testPlane) {
      const cv = document.createElement('canvas');
      cv.width = 720;
      cv.height = 320;
      this.testCtx = cv.getContext('2d');
      this.testTex = new CanvasTexture(cv);
      this.testTex.colorSpace = SRGBColorSpace;
      this.testPlane = new Mesh(
        new PlaneGeometry(0.72, 0.32),
        new MeshBasicMaterial({ map: this.testTex, transparent: true, depthTest: false })
      );
      this.testPlane.renderOrder = 20;
      this.testPlane.position.set(0, -0.32, -0.9);
      this.player.head.add(this.testPlane);
    }
    const t = performance.now();
    if (t - (this.testDraw || 0) < 200) return;
    this.testDraw = t;
    const g = this.testCtx;
    g.clearRect(0, 0, 720, 320);
    g.fillStyle = 'rgba(0,0,0,0.65)';
    g.fillRect(0, 0, 720, 320);
    g.fillStyle = '#ffffff';
    g.font = '17px monospace';
    lines.forEach((s, i) => g.fillText(s, 12, 28 + i * 26));
    this.testTex.needsUpdate = true;
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

    // Place every conversation relative to where you face (re-done when chatter starts).
    if (!this.placed) {
      const flat = Math.hypot(fx, fz) || 1;
      const ffx = fx / flat, ffz = fz / flat;
      const rx = -ffz, rz = ffx;
      const baseY = py > 0.5 ? py : 1.4;
      for (const c of this.convos) {
        const a = (c.cfg.angle * Math.PI) / 180;
        const dirx = ffx * Math.cos(a) + rx * Math.sin(a);
        const dirz = ffz * Math.cos(a) + rz * Math.sin(a);
        c.x = px + dirx * c.cfg.dist;
        c.y = baseY - 0.1;
        c.z = pz + dirz * c.cfg.dist;
        c.panner.positionX.value = c.x;
        c.panner.positionY.value = c.y;
        c.panner.positionZ.value = c.z;

        if (!c.orb) {
          c.orb = new Mesh(
            new SphereGeometry(1, 24, 16),
            new MeshBasicMaterial({ color: 0xff9f5b, transparent: true, opacity: 0.4, depthWrite: false })
          );
          c.orb.scale.setScalar(0.05);
          this.addToScene(c.orb);

          c.ring = new Mesh(
            new RingGeometry(0.9, 1, 48),
            new MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0, side: DoubleSide, depthWrite: false })
          );
          c.ring.scale.setScalar(0.1);
          this.addToScene(c.ring);
        }
        // The visible orb floats above the guests' heads; the sound itself stays at head height.
        c.orb.position.set(c.x, c.y + 0.7, c.z);
        c.ring.position.set(c.x, c.y + 0.7, c.z);
        c.ring.lookAt(px, baseY, pz);
      }
      this.placed = true;
      window.earshotLayout = this.convos.map((c) => ({ x: c.x, y: c.y, z: c.z }));
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

    // A gold ripple at each hand raised near your head: shows the game sees your listening gesture.
    if (!this.ripples) {
      this.ripples = [0, 1].map(() => {
        const r = new Mesh(
          new RingGeometry(0.85, 1, 40),
          new MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0, side: DoubleSide, depthTest: false })
        );
        r.renderOrder = 11;
        this.addToScene(r);
        return r;
      });
    }
    this.ripples.forEach((r, k) => {
      const p = hands[k];
      const near = p ? clamp01((0.38 - Math.hypot(p[0] - px, p[1] - py, p[2] - pz)) / 0.18) : 0;
      if (near <= 0.05) { r.material.opacity = 0; return; }
      const ph = (nowMs / 900 + k * 0.5) % 1;
      r.position.set(p[0], p[1], p[2]);
      r.lookAt(px, py, pz);
      r.scale.setScalar(0.05 + 0.09 * ph);
      r.material.opacity = near * 0.7 * (1 - ph);
    });

    const now = this.ctx.currentTime;
    const clueActive = nowMs < this.clueUntil;
    const lines = ['Clues: ' + this.caughtCount + '/' + this.convos.length];

    // Share talking info with the room (who speaks, how loudly).
    const state = window.earshotState;
    state.phase = this.phase;
    state.introLevel = this.phase === 'intro' ? this.levelOf(this.introAn) : 0;

    for (let i = 0; i < this.convos.length; i++) {
      const c = this.convos[i];
      const dx = c.x - px, dy = c.y - py, dz = c.z - pz;
      const len = Math.hypot(dx, dy, dz) || 1;

      // Who is talking right now, and how loudly (drives the guests' mouths).
      const clueNow = nowMs < c.clueUntil;
      const lvl = this.levelOf(clueNow ? c.clueAn : c.chatterAn);
      if (!clueNow) {
        if (lvl < 0.02) {
          c.quiet += dt;
        } else {
          if (c.quiet > 0.3) c.speaker = 1 - c.speaker;
          c.quiet = 0;
        }
      }
      c.lvl += (lvl - c.lvl) * 0.5;
      state.convos[i].level = c.lvl;
      state.convos[i].speaker = clueNow ? c.cfg.clueSpeaker : c.speaker;

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

      // Orb: grows and brightens with focus and progress; gold once caught.
      if (c.orb) {
        const prog = c.caught ? 1 : c.dwell / NEED;
        const beat = this.phase === 'solved' ? 0.02 * Math.sin(nowMs / 150) : 0;
        c.orb.scale.setScalar(c.caught ? 0.11 + beat : 0.05 + 0.04 * focus + 0.04 * prog);
        c.orb.material.opacity = c.caught ? 0.95 : 0.3 + 0.4 * focus + 0.25 * prog;
        c.orb.material.color.setHex(c.caught ? 0xffd34d : 0xff9f5b);

        // Ring burst after a clue is caught (and again for all three at the finale).
        if (c.pulse >= 0) {
          c.pulse += dt;
          const t = c.pulse / 1.2;
          if (t >= 1) {
            c.pulse = -1;
            c.ring.material.opacity = 0;
          } else {
            c.ring.scale.setScalar(0.1 + 0.5 * t);
            c.ring.material.opacity = 0.9 * (1 - t);
          }
        }
      }

      const filled = Math.round((10 * c.dwell) / NEED);
      const bar = c.caught ? 'CAUGHT    ' : '#'.repeat(filled) + '-'.repeat(10 - filled);
      lines.push(
        c.cfg.name + '  look ' + look.toFixed(2) + '  cup ' + cup.toFixed(2) + '  [' + bar + ']' +
        '  talk ' + c.lvl.toFixed(2) + ' spk ' + state.convos[i].speaker
      );
    }

    lines.push('');
    lines.push(this.message);
    this.hud.textContent = lines.join('\n');
    if (TEST) this.drawTestHud(lines);
  }
}