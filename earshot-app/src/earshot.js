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
import { CASES } from './cases.js';

const TEST = new URLSearchParams(location.search).has('test');
const DEBUG = import.meta.env.DEV || new URLSearchParams(location.search).has('debug');
const HAND_SPACE = 'gripSpaces'; // where your hands are (used for cupping); try 'indexTipSpaces' if not detected
const RAY_SPACE = 'raySpaces';   // where your hands point (used for choosing answers)
const DING_URL = 'audio/chime.mp3';
const NEED = 2.0;          // seconds of focused listening needed to catch a clue
const CUP_ON = 0.7;        // how "cupped" a hand must be to count as listening
const GAZE_RATE = 0.35;    // no-hands assist: holding your gaze fills a clue at this fraction of the cupping speed
const GAZE_MIN = 0.85;     // how directly you must face a conversation for the gaze assist
const QUIET = 0.04;        // chatter volume while a clue / Helen is speaking
const CARD_DWELL = 1.2;    // seconds to hold a pointer on a card to choose it
const POINT_COS = Math.cos((8 * Math.PI) / 180); // pointing tolerance (8 degrees)
const STORE = 'earshot-progress';

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smooth = (t) => t * t * (3 - 2 * t);

function readSolved() {
  try { return JSON.parse(localStorage.getItem(STORE) || '[]'); } catch (e) { return []; }
}
function saveSolved(id) {
  try {
    const s = readSolved();
    if (!s.includes(id)) { s.push(id); localStorage.setItem(STORE, JSON.stringify(s)); }
  } catch (e) { /* storage unavailable: progress just won't persist */ }
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function wrapLines(g, text, maxW) {
  const words = String(text).split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (g.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}

function drawCard(card, prog) {
  const g = card.ctx, w = card.cv.width, h = card.cv.height;
  g.clearRect(0, 0, w, h);
  const dead = card.locked || card.wrong;
  g.fillStyle = dead ? '#6b5a55' : '#f6ead3';
  roundRect(g, 4, 4, w - 8, h - 8, 22);
  g.fill();
  g.lineWidth = 6;
  g.strokeStyle = card.wrong ? '#8a2a3a' : '#b98a4a';
  g.stroke();
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = dead ? '#cbbcb4' : '#5b2432';
  g.font = 'bold 34px Georgia, serif';
  const lines = wrapLines(g, card.label, w - 56);
  const y0 = card.sub ? h * 0.36 : h * 0.44;
  lines.forEach((s, i) => g.fillText(s, w / 2, y0 + (i - (lines.length - 1) / 2) * 40));
  if (card.sub || card.wrong) {
    g.font = 'italic 22px Georgia, serif';
    g.fillText(card.wrong ? 'Not this one' : card.sub, w / 2, h * 0.72);
  }
  if (!dead) {
    g.fillStyle = 'rgba(91,36,50,0.2)';
    g.fillRect(34, h - 34, w - 68, 10);
    g.fillStyle = '#d9a24f';
    g.fillRect(34, h - 34, (w - 68) * prog, 10);
  }
}

export class EarshotSystem extends createSystem({}) {
  init() {
    this.ctx = null;
    this.ready = false;
    this.placed = false;
    this.warned = false;
    this.phase = 'loading';
    this.cs = null;
    this.convos = [];
    this.cards = null;
    this.qs = [];
    this.qi = 0;
    this.curQ = null;
    this.hostPlaying = false;
    this.caughtCount = 0;
    this.clueUntil = 0;
    this.last = 0;
    this.message = 'Click the page once to start the audio.';
    this.abuf = new Uint8Array(1024);
    window.earshotState = { phase: 'loading', helenLevel: 0, revealed: false, convos: [] };

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

  // ---------- starting up ----------

  async startAudio() {
    this.message = 'Loading audio...';
    const ctx = new AudioContext();
    await ctx.resume();
    this.ctx = ctx;
    this.hostAn = ctx.createAnalyser();
    this.hostAn.fftSize = 1024;
    try {
      const r = await fetch(DING_URL);
      if (!r.ok) throw new Error(DING_URL + ' (' + r.status + ')');
      this.ding = await ctx.decodeAudioData(await r.arrayBuffer());
    } catch (e) {
      console.error(e);
      this.message = 'Audio failed to load: ' + e.message;
      return;
    }
    // ?case=2 jumps straight to a case. Returning players see the case file first.
    const want = new URLSearchParams(location.search).get('case');
    const forced = want ? CASES.find((c) => String(c.id) === want) : null;
    if (forced) {
      this.loadCase(forced, true);
    } else if (readSolved().length) {
      this.phase = 'menu';
      this.message = 'Choose a case.';
      this.showMenu('Welcome back', 'Choose a case to play.', true);
    } else {
      this.loadCase(CASES[0], true);
    }
  }

  async loadCase(cs, first) {
    this.teardown();
    this.cs = cs;
    window.earshotCase = cs; // lets the room start loading this case's pictures right away
    this.phase = 'loading';
    this.ready = false;
    this.message = 'Loading ' + cs.title + '...';
    const ctx = this.ctx;

    const load = async (url, optional) => {
      try {
        const r = await fetch(url);
        if (!r.ok) throw new Error(url + ' (' + r.status + ')');
        return await ctx.decodeAudioData(await r.arrayBuffer());
      } catch (e) {
        if (optional) return null;
        throw e;
      }
    };

    let all;
    try {
      all = await Promise.all([
        load(cs.intro),
        load(cs.ask, true),
        load(cs.reveal, true),
        ...cs.groups.flatMap((g) => [load(g.chatter), load(g.clue)]),
      ]);
    } catch (e) {
      console.error(e);
      this.message = 'Audio failed to load: ' + e.message;
      this.phase = 'menu';
      this.showMenu('This case is not ready yet', 'Its audio files are missing. Pick another case.');
      return;
    }

    this.introBuf = all[0];
    this.askBuf = all[1];
    this.revealBuf = all[2];

    this.convos = cs.groups.map((cfg, i) => {
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
        chatterBuf: all[3 + i * 2],
        clueBuf: all[4 + i * 2],
        filter, gain, clueGain, panner, chatterAn, clueAn,
        x: 0, y: 0, z: 0,
        dwell: 0,
        caught: false,
        pulse: -1,
        lvl: 0,
        quiet: 0,
        speaker: cfg.startSpeaker,
        clueUntil: 0,
        src: null,
        clueSrc: null,
      };
    });

    const st = window.earshotState;
    st.convos = cs.groups.map((g) => ({ level: 0, speaker: g.startSpeaker }));
    st.revealed = false;
    this.caughtCount = 0;
    this.clueUntil = 0;
    this.placed = false;

    // Give the headset a moment to start the session before Helen begins.
    await new Promise((r) => setTimeout(r, first ? 2500 : 800));
    if (this.cs !== cs) return;

    this.ready = true;
    this.phase = 'intro';
    this.message = 'Helen is speaking... listen.';
    this.playHost(this.introBuf, () => { if (this.cs === cs && this.phase === 'intro') this.startChatter(); });
  }

  teardown() {
    this.stopChatter();
    for (const c of this.convos) {
      try { if (c.clueSrc) c.clueSrc.stop(); } catch (e) { /* already stopped */ }
      try { c.panner.disconnect(); c.filter.disconnect(); c.gain.disconnect(); c.clueGain.disconnect(); } catch (e) { /* ignore */ }
      for (const k of ['orb', 'ring']) if (c[k] && c[k].parent) c[k].parent.remove(c[k]);
    }
    this.convos = [];
    this.clearCards();
  }

  stopChatter() {
    for (const c of this.convos) {
      try { if (c.src) c.src.stop(); } catch (e) { /* already stopped */ }
      c.src = null;
    }
  }

  // Plays one of Helen's lines (analysed so her mouth moves). Works without audio too.
  playHost(buf, done) {
    if (!buf) { setTimeout(() => done && done(), done ? 5000 : 0); return; }
    const s = this.ctx.createBufferSource();
    s.buffer = buf;
    s.connect(this.ctx.destination);
    s.connect(this.hostAn);
    this.hostPlaying = true;
    s.onended = () => { this.hostPlaying = false; if (done) done(); };
    s.start();
  }

  playDing(vol) {
    const d = this.ctx.createBufferSource();
    d.buffer = this.ding;
    const dg = this.ctx.createGain();
    dg.gain.value = vol;
    d.connect(dg).connect(this.ctx.destination);
    d.start();
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
      c.src = src;
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
    const cs = this.cs;

    // Small "ding" to confirm the game noticed.
    this.playDing(0.3);

    // The clue itself, clear and spatial, a moment later.
    const s = ctx.createBufferSource();
    s.buffer = c.clueBuf;
    s.connect(c.clueGain);
    s.connect(c.clueAn);
    s.start(t + 0.4);
    c.clueSrc = s;
    s.onended = () => {
      if (this.cs === cs && this.phase === 'play' && this.caughtCount === this.convos.length) this.beginAccuse();
    };
    c.clueUntil = performance.now() + (0.4 + c.clueBuf.duration) * 1000 + 200;
    this.clueUntil = Math.max(this.clueUntil, performance.now() + (0.4 + c.clueBuf.duration) * 1000 + 300);
    this.message = 'Clue ' + this.caughtCount + ' of ' + this.convos.length + ' caught!';
  }

  // ---------- the accusation, finale and case file ----------

  beginAccuse() {
    this.phase = 'accuse';
    for (const o of this.convos) o.pulse = 0;
    const a = this.cs.accuse;
    this.qs = Array.isArray(a) ? a : [a];
    this.qi = 0;
    this.askQuestion();
    this.playHost(this.askBuf, null);
  }

  askQuestion() {
    const a = this.qs[this.qi];
    this.curQ = a;
    const opts = a.options.map((label, i) => ({ label, correct: i === a.answer }));
    for (let i = opts.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [opts[i], opts[j]] = [opts[j], opts[i]];
    }
    opts.forEach((o) => { o.onPick = (it) => this.onAnswer(it); });
    const step = this.qs.length > 1 ? 'Question ' + (this.qi + 1) + ' of ' + this.qs.length + '. ' : '';
    this.message = a.question + ' (point at an answer and hold)';
    this.showCards(a.question, step + 'Point a hand at your answer, or look at it, and hold.', opts);
  }

  onAnswer(it) {
    if (it.correct) {
      if (this.qi + 1 < this.qs.length) {
        this.playDing(0.35);
        this.qi++;
        this.askQuestion();
      } else {
        this.solve();
      }
    } else {
      it.wrong = true;
      drawCard(it, 0);
      it.tex.needsUpdate = true;
      this.cards.title.set('Not quite. Try again', this.curQ.question);
    }
  }

  solve() {
    const cs = this.cs;
    this.phase = 'solved';
    window.earshotState.revealed = true;
    for (const o of this.convos) o.pulse = 0;
    saveSolved(cs.id);
    this.message = 'SOLVED: ' + cs.finale.text;
    this.showCards('CASE SOLVED', cs.finale.text, []);
    this.playHost(this.revealBuf, () => { if (this.cs === cs && this.phase === 'solved') this.finish(); });
  }

  finish() {
    this.stopChatter();
    this.phase = 'menu';
    this.showMenu('Case file', 'Choose what to play next.');
  }

  showMenu(title, sub, follow) {
    const solved = readSolved();
    const opts = CASES.map((c, i) => ({
      label: (i + 1) + '. ' + c.title,
      sub: solved.includes(c.id) ? 'Solved. Play again' : 'New case',
      onPick: () => { this.clearCards(); this.loadCase(c, false); },
    }));
    this.showCards(title, sub, opts, follow);
  }

  // ---------- in-world cards (readable and choosable inside the headset) ----------

  makeCard(o) {
    const cv = document.createElement('canvas');
    cv.width = 460;
    cv.height = 260;
    const tex = new CanvasTexture(cv);
    tex.colorSpace = SRGBColorSpace;
    const mesh = new Mesh(
      new PlaneGeometry(0.46, 0.26),
      new MeshBasicMaterial({ map: tex, transparent: true, depthTest: false, side: DoubleSide })
    );
    mesh.renderOrder = 30;
    const card = {
      cv, ctx: cv.getContext('2d'), tex, mesh,
      label: o.label, sub: o.sub, locked: !!o.locked, correct: !!o.correct, onPick: o.onPick,
      wrong: false, dwell: 0, shown: -1,
    };
    drawCard(card, 0);
    tex.needsUpdate = true;
    return card;
  }

  makeTitle(title, sub) {
    const cv = document.createElement('canvas');
    cv.width = 1000;
    cv.height = 240;
    const ctx = cv.getContext('2d');
    const tex = new CanvasTexture(cv);
    tex.colorSpace = SRGBColorSpace;
    const mesh = new Mesh(
      new PlaneGeometry(0.96, 0.23),
      new MeshBasicMaterial({ map: tex, transparent: true, depthTest: false, side: DoubleSide })
    );
    mesh.renderOrder = 30;
    const t = {
      mesh, tex,
      set(a, b) {
        ctx.clearRect(0, 0, 1000, 240);
        ctx.fillStyle = 'rgba(30,14,20,0.88)';
        roundRect(ctx, 4, 4, 992, 232, 26);
        ctx.fill();
        ctx.lineWidth = 6;
        ctx.strokeStyle = '#b98a4a';
        ctx.stroke();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffe9b8';
        ctx.font = 'bold 50px Georgia, serif';
        const tl = wrapLines(ctx, a, 920);
        ctx.fillText(tl[0] + (tl.length > 1 ? '...' : ''), 500, 62);
        ctx.fillStyle = '#f6ead3';
        ctx.font = '30px Georgia, serif';
        const sl = wrapLines(ctx, b || '', 900).slice(0, 3);
        sl.forEach((s, i) => ctx.fillText(s, 500, 132 + i * 36 - (sl.length - 1) * 8));
        tex.needsUpdate = true;
      },
    };
    t.set(title, sub);
    return t;
  }

  showCards(title, sub, options, follow) {
    this.clearCards();
    const titleCard = this.makeTitle(title, sub);
    const items = options.map((o) => this.makeCard(o));
    const place = () => {
      const head = this.player.head;
      head.updateWorldMatrix(true, false);
      const m = head.matrixWorld.elements;
      const px = m[12], py = m[13], pz = m[14];
      const flat = Math.hypot(-m[8], -m[10]) || 1;
      const ffx = -m[8] / flat, ffz = -m[10] / flat;
      const rx = -ffz, rz = ffx;
      const baseY = py > 0.5 ? py : 1.4;
      const put = (mesh, deg, dist, y) => {
        const a = (deg * Math.PI) / 180;
        mesh.position.set(px + (ffx * Math.cos(a) + rx * Math.sin(a)) * dist, y, pz + (ffz * Math.cos(a) + rz * Math.sin(a)) * dist);
        mesh.lookAt(px, y, pz);
      };
      put(titleCard.mesh, 0, 1.25, baseY - 0.06);
      items.forEach((it, i) => put(it.mesh, (i - (items.length - 1) / 2) * 26, 1.15, baseY - 0.38));
    };
    place();
    this.addToScene(titleCard.mesh);
    items.forEach((it) => this.addToScene(it.mesh));
    this.cards = { title: titleCard, items, t0: performance.now(), place, follow: !!follow };
  }

  clearCards() {
    const C = this.cards;
    if (!C) return;
    for (const m of [C.title, ...C.items]) {
      if (m.mesh.parent) m.mesh.parent.remove(m.mesh);
      m.mesh.geometry.dispose();
      m.mesh.material.dispose();
      m.tex.dispose();
    }
    this.cards = null;
  }

  // Pointing: a hand held out (ray along the hand) or your gaze picks a card; hold to choose.
  updateCards(dt, pointers, pos, fwd) {
    const C = this.cards;
    if (!C) return;
    const age = performance.now() - C.t0;
    if (C.follow && age < 6000) C.place(); // follow the headset while the session settles
    if (age < 900) return;                 // short grace so nothing is picked by accident

    const rays = [];
    for (const h of pointers) {
      if (Math.hypot(h.p[0] - pos[0], h.p[1] - pos[1], h.p[2] - pos[2]) > 0.3) rays.push({ o: h.p, d: h.d });
    }
    rays.push({ o: pos, d: fwd });

    let hover = null;
    let best = POINT_COS;
    for (const it of C.items) {
      if (it.locked || it.wrong) continue;
      for (const r of rays) {
        const vx = it.mesh.position.x - r.o[0], vy = it.mesh.position.y - r.o[1], vz = it.mesh.position.z - r.o[2];
        const len = Math.hypot(vx, vy, vz) || 1;
        const c = (vx * r.d[0] + vy * r.d[1] + vz * r.d[2]) / len;
        if (c > best) { best = c; hover = it; }
      }
    }
    for (const it of C.items) {
      if (it === hover) it.dwell = Math.min(CARD_DWELL, it.dwell + dt);
      else it.dwell = Math.max(0, it.dwell - dt * 1.5);
      const step = Math.round((10 * it.dwell) / CARD_DWELL);
      if (step !== it.shown) {
        it.shown = step;
        drawCard(it, it.dwell / CARD_DWELL);
        it.tex.needsUpdate = true;
      }
      if (it.dwell >= CARD_DWELL) {
        it.dwell = 0;
        it.onPick(it);
        break;
      }
    }
  }

  // ---------- per-frame ----------

  getPose(entity) {
    const obj = entity && entity.object3D;
    if (!obj) return null;
    obj.updateWorldMatrix(true, false);
    const e = obj.matrixWorld.elements;
    return { p: [e[12], e[13], e[14]], d: [-e[8], -e[9], -e[10]] };
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
    const nowMs = performance.now();
    const dt = this.last ? Math.min(0.1, (nowMs - this.last) / 1000) : 0;
    this.last = nowMs;
    window.earshotState.phase = this.phase;

    if (!this.ctx) {
      this.hud.textContent = this.message;
      return;
    }

    const head = this.player.head;
    head.updateWorldMatrix(true, false);
    const m = head.matrixWorld.elements;
    const px = m[12], py = m[13], pz = m[14];
    const fx = -m[8], fy = -m[9], fz = -m[10];
    const ux = m[4], uy = m[5], uz = m[6];

    const l = this.ctx.listener;
    l.positionX.value = px; l.positionY.value = py; l.positionZ.value = pz;
    l.forwardX.value = fx; l.forwardY.value = fy; l.forwardZ.value = fz;
    l.upX.value = ux; l.upY.value = uy; l.upZ.value = uz;

    // Hand poses, once per frame: where the hands are (cupping) and where they point (answers).
    const hands = [];
    const rays = [];
    const pse = this.world && this.world.playerSpaceEntities;
    const spaces = pse && pse[HAND_SPACE];
    if (spaces) {
      for (const side of ['left', 'right']) {
        const p = this.getPose(spaces[side]);
        if (p) hands.push(p);
      }
    } else if (!this.warned) {
      console.warn('Earshot: hand spaces not found on world.playerSpaceEntities');
      this.warned = true;
    }
    const rsp = pse && pse[RAY_SPACE];
    if (rsp) {
      for (const side of ['left', 'right']) {
        const p = this.getPose(rsp[side]);
        if (p) rays.push(p);
      }
    }

    if (this.cards) this.updateCards(dt, rays.length ? rays : hands, [px, py, pz], [fx, fy, fz]);

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
      const h = hands[k];
      const p = h && h.p;
      const near = p ? clamp01((0.38 - Math.hypot(p[0] - px, p[1] - py, p[2] - pz)) / 0.18) : 0;
      if (near <= 0.05 || this.phase !== 'play') { r.material.opacity = 0; return; }
      const ph = (nowMs / 900 + k * 0.5) % 1;
      r.position.set(p[0], p[1], p[2]);
      r.lookAt(px, py, pz);
      r.scale.setScalar(0.05 + 0.09 * ph);
      r.material.opacity = near * 0.7 * (1 - ph);
    });

    const state = window.earshotState;
    state.helenLevel = this.hostPlaying ? this.levelOf(this.hostAn) : 0;

    if (!this.ready) {
      this.hud.textContent = this.message;
      return;
    }

    // Place every conversation relative to where you face (re-done when chatter starts).
    if (!this.placed) {
      const flat = Math.hypot(fx, fz) || 1;
      const ffx = fx / flat, ffz = fz / flat;
      const rx = -ffz, rz = ffx;
      const baseY = py > 0.5 ? py : 1.4;
      for (const c of this.convos) {
        const dist = c.cfg.dist || 1.4;
        const a = (c.cfg.angle * Math.PI) / 180;
        const dirx = ffx * Math.cos(a) + rx * Math.sin(a);
        const dirz = ffz * Math.cos(a) + rz * Math.sin(a);
        c.x = px + dirx * dist;
        c.y = baseY - 0.1;
        c.z = pz + dirz * dist;
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
      window.earshotForward = [ffx, ffz];
      window.earshotLayout = this.convos.map((c) => ({ x: c.x, y: c.y, z: c.z }));
      window.earshotCase = this.cs;
    }

    const now = this.ctx.currentTime;
    const clueActive = nowMs < this.clueUntil;
    const hush = clueActive || this.phase !== 'play';
    const lines = ['Case ' + this.cs.id + '  Clues: ' + this.caughtCount + '/' + this.convos.length];

    // Which conversation are you facing most directly? (for the no-hands gaze assist)
    let lookIdx = -1;
    let lookBest = GAZE_MIN;
    for (let i = 0; i < this.convos.length; i++) {
      const c = this.convos[i];
      const dx = c.x - px, dy = c.y - py, dz = c.z - pz;
      const len = Math.hypot(dx, dy, dz) || 1;
      const lk = smooth(clamp01(((dx * fx + dy * fy + dz * fz) / len - 0.5) / 0.45));
      if (lk > lookBest) { lookBest = lk; lookIdx = i; }
    }

    for (let i = 0; i < this.convos.length; i++) {
      const c = this.convos[i];
      const dx = c.x - px, dy = c.y - py, dz = c.z - pz;
      const len = Math.hypot(dx, dy, dz) || 1;

      // Who is talking right now, and how loudly (drives the guests' mouths).
      const clueNow = nowMs < c.clueUntil;
      const lvl = c.src || clueNow ? this.levelOf(clueNow ? c.clueAn : c.chatterAn) : 0;
      if (!clueNow) {
        if (lvl < 0.02) {
          c.quiet += dt;
        } else {
          if (c.quiet > 0.3) c.speaker = 1 - c.speaker;
          c.quiet = 0;
        }
      }
      c.lvl += (lvl - c.lvl) * 0.5;
      if (state.convos[i]) {
        state.convos[i].level = c.lvl;
        state.convos[i].speaker = clueNow ? c.cfg.clueSpeaker : c.speaker;
      }

      // LOOK: how directly you face this conversation.
      const cos = (dx * fx + dy * fy + dz * fz) / len;
      const look = smooth(clamp01((cos - 0.5) / (0.95 - 0.5)));

      // CUP: a hand raised near your head, on the side of this conversation.
      let cup = 0;
      for (const h of hands) {
        const p = h.p;
        const hx = p[0] - px, hy = p[1] - py, hz = p[2] - pz;
        const hd = Math.hypot(hx, hy, hz) || 1;
        const nearness = clamp01((0.35 - hd) / 0.15);
        const align = clamp01((hx * dx + hy * dy + hz * dz) / (hd * len) / 0.6);
        cup = Math.max(cup, nearness * align);
      }

      // Sound: clearer when you look and cup; chatter ducks while a clue or Helen plays.
      const focus = clamp01(0.5 * look + 0.8 * cup);
      c.gain.gain.setTargetAtTime(hush ? QUIET : 0.15 + 0.85 * focus, now, 0.1);
      c.filter.frequency.setTargetAtTime(hush ? 400 : 500 + 7500 * focus, now, 0.1);

      // Catching the clue: cupping is fast; holding your gaze is a slower assist for players without hands.
      if (this.phase === 'play' && !c.caught) {
        if (cup >= CUP_ON) c.dwell = Math.min(NEED, c.dwell + dt * (1 + look));
        else if (i === lookIdx && !clueActive) c.dwell = Math.min(NEED, c.dwell + dt * GAZE_RATE);
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

        // Ring burst after a clue is caught (and again for all of them at the finale).
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
        '  talk ' + c.lvl.toFixed(2) + ' spk ' + (state.convos[i] ? state.convos[i].speaker : '-')
      );
    }

    lines.push('');
    lines.push(this.message);
    this.hud.textContent = lines.join('\n');
    if (TEST) this.drawTestHud(lines);
  }
}