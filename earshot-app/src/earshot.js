import {
  createSystem, Mesh, SphereGeometry, RingGeometry, PlaneGeometry, MeshBasicMaterial,
  CanvasTexture, SRGBColorSpace, DoubleSide,
} from '@iwsdk/core';
import { CASES } from './cases.js';

const TEST = new URLSearchParams(location.search).has('test');
const DEBUG = import.meta.env.DEV || new URLSearchParams(location.search).has('debug');
const HAND_SPACE = 'gripSpaces'; // where your hands are (cupping); try 'indexTipSpaces' if not detected
const RAY_SPACE = 'raySpaces';   // where your hands point (choosing answers)
const DING_URL = 'audio/chime.mp3';
const NEED = 2.0;          // classic cases: seconds of focused listening to catch a clue
const CUP_ON = 0.7;        // how "cupped" a hand must be to count as listening
const GAZE_RATE = 0.35;    // classic cases: no-hands assist speed
const GAZE_MIN = 0.85;     // how directly you must face a conversation for the gaze assist
const QUIET = 0.04;        // chatter volume while a clue / the host is speaking
const CARD_DWELL = 1.2;    // seconds to hold a pointer on a card to choose it
const POINT_COS = Math.cos((8 * Math.PI) / 180);
const FINALE_HOLD = 4500;  // ms to enjoy the finale before the case file appears
const EV_NEED = 0.5;       // timed case: fraction of an evidence line you must hear
const EV_GAZE = 0.6;       // timed case: listening rate with gaze only (no hands)
const DOWN_Y = -0.5;       // looking about 30 degrees down at your notebook starts the accusation
const ACCUSE_DWELL = 1.5;
const STORE = 'earshot-progress';
const BEST = 'earshot-best';

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smooth = (t) => t * t * (3 - 2 * t);
const fmtTime = (s) => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');

function readSolved() { try { return JSON.parse(localStorage.getItem(STORE) || '[]'); } catch (e) { return []; } }
function saveSolved(id) {
  try { const s = readSolved(); if (!s.includes(id)) { s.push(id); localStorage.setItem(STORE, JSON.stringify(s)); } } catch (e) { /* progress won't persist */ }
}
function readBest() { try { return JSON.parse(localStorage.getItem(BEST) || '{}'); } catch (e) { return {}; } }
function saveBest(id, score) {
  try { const b = readBest(); if (!(b[id] >= score)) { b[id] = score; localStorage.setItem(BEST, JSON.stringify(b)); return true; } } catch (e) { /* ignore */ }
  return false;
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r);
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
  roundRect(g, 4, 4, w - 8, h - 8, 22); g.fill();
  g.lineWidth = 6; g.strokeStyle = card.wrong ? '#8a2a3a' : '#b98a4a'; g.stroke();
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = dead ? '#cbbcb4' : '#5b2432';
  g.font = 'bold 34px Georgia, serif';
  const lines = wrapLines(g, card.label, w - 56);
  const y0 = card.sub ? h * 0.36 : h * 0.44;
  lines.forEach((s, i) => g.fillText(s, w / 2, y0 + (i - (lines.length - 1) / 2) * 40));
  if (card.sub || card.wrong) { g.font = 'italic 22px Georgia, serif'; g.fillText(card.wrong ? 'Not this one' : card.sub, w / 2, h * 0.72); }
  if (!dead) {
    g.fillStyle = 'rgba(91,36,50,0.2)'; g.fillRect(34, h - 34, w - 68, 10);
    g.fillStyle = '#d9a24f'; g.fillRect(34, h - 34, (w - 68) * prog, 10);
  }
}

export class EarshotSystem extends createSystem({}) {
  init() {
    this.ctx = null; this.ready = false; this.placed = false; this.warned = false;
    this.phase = 'loading'; this.cs = null; this.convos = []; this.cards = null;
    this.qs = []; this.qi = 0; this.curQ = null; this.hostPlaying = false;
    this.caughtCount = 0; this.clueUntil = 0; this.revealTimer = null; this.finishTimer = null;
    this.notes = []; this.totalEv = 0; this.totalKey = 0; this.endAt = 0; this.downT = 0;
    this.leftAtAccuse = 0; this.wrongCount = 0; this.report = '';
    this.toast = null; this.hud3 = null; this.hudOn = false; this.lastFy = 0; this.placeInfo = null;
    this.last = 0;
    this.message = 'Click the page once to start the audio.';
    this.abuf = new Uint8Array(1024);
    window.earshotState = { phase: 'loading', helenLevel: 0, revealed: false, celebrate: 0, convos: [] };

    this.hud = document.createElement('div');
    this.hud.style.cssText = 'position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:99999;padding:8px 14px;background:rgba(0,0,0,.75);color:#fff;font:14px monospace;border-radius:8px;pointer-events:none;white-space:pre;max-width:90vw';
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
    for (let i = 0; i < this.abuf.length; i++) { const v = (this.abuf[i] - 128) / 128; s += v * v; }
    return Math.sqrt(s / this.abuf.length);
  }

  // Who talks next in a conversation of n people (a different person each time).
  nextSpeaker(c) {
    if (c.n <= 2) return 1 - c.speaker;
    let s;
    do { s = Math.floor(Math.random() * c.n); } while (s === c.speaker);
    return s;
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
    // ?case=3 jumps straight to a case. Returning players see the case file first.
    const want = new URLSearchParams(location.search).get('case');
    const forced = want ? CASES.find((c) => String(c.id) === want) : null;
    if (forced) this.loadCase(forced, true);
    else if (readSolved().length) { this.phase = 'menu'; this.message = 'Choose a case.'; this.showMenu('Welcome back', 'Choose a case to play.', true); }
    else this.loadCase(CASES[0], true);
  }

  async loadCase(cs, first) {
    this.teardown();
    this.cs = cs;
    window.earshotCase = cs;
    window.earshotLayout = null; // the room builds only once this case has its own layout
    this.phase = 'loading';
    this.ready = false;
    this.message = 'Loading ' + cs.title + '...';
    const ctx = this.ctx;
    const timed = cs.mode === 'timed';

    const load = async (url, optional) => {
      try {
        const r = await fetch(url);
        if (!r.ok) throw new Error(url + ' (' + r.status + ')');
        return await ctx.decodeAudioData(await r.arrayBuffer());
      } catch (e) { if (optional) return null; throw e; }
    };

    let all;
    try {
      all = await Promise.all([
        load(cs.intro), load(cs.ask, true), load(cs.reveal, true),
        ...cs.groups.flatMap((g) => (timed ? [load(g.chatter)] : [load(g.chatter), load(g.clue)])),
      ]);
    } catch (e) {
      console.error(e);
      this.message = 'Audio failed to load: ' + e.message;
      this.phase = 'menu';
      this.showMenu('This case is not ready yet', 'Its audio files are missing. Pick another case.');
      return;
    }

    this.introBuf = all[0]; this.askBuf = all[1]; this.revealBuf = all[2];
    const per = timed ? 1 : 2;

    this.convos = cs.groups.map((cfg, i) => {
      const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 500;
      const gain = ctx.createGain(); gain.gain.value = 0.15;
      const clueGain = ctx.createGain(); clueGain.gain.value = 1.0;
      const panner = new PannerNode(ctx, { panningModel: 'HRTF', distanceModel: 'inverse', refDistance: 1, rolloffFactor: 0.5 });
      filter.connect(gain).connect(panner).connect(ctx.destination);
      clueGain.connect(panner);
      const chatterAn = ctx.createAnalyser(); chatterAn.fftSize = 1024;
      const clueAn = ctx.createAnalyser(); clueAn.fftSize = 1024;
      const chatterBuf = all[3 + i * per];
      return {
        cfg, chatterBuf, clueBuf: timed ? null : all[4 + i * per],
        filter, gain, clueGain, panner, chatterAn, clueAn,
        n: (cfg.members || cfg.pair || [0, 1]).length,
        ev: (cfg.evidence || []).map((e) => ({ ...e, heard: 0, done: false })),
        dur: chatterBuf ? chatterBuf.duration : 1, t0: 0, pos: 0, boost: cfg.boost || 1,
        x: 0, y: 0, z: 0, dwell: 0, caught: false, pulse: -1, lvl: 0, quiet: 0,
        speaker: cfg.startSpeaker || 0, clueUntil: 0, src: null, clueSrc: null,
      };
    });
    this.totalEv = this.convos.reduce((a, c) => a + c.ev.length, 0);
    this.totalKey = this.convos.reduce((a, c) => a + c.ev.filter((e) => e.key).length, 0);
    this.notes = []; this.toast = null; this.hudOn = false; this.downT = 0;
    this.wrongCount = 0; this.report = ''; this.leftAtAccuse = 0;

    const st = window.earshotState;
    st.convos = this.convos.map((c) => ({ level: 0, speaker: c.speaker, n: c.n }));
    st.revealed = false;
    this.caughtCount = 0; this.clueUntil = 0; this.placed = false;

    // Give the headset a moment to start the session before the room is placed.
    await new Promise((r) => setTimeout(r, first ? 2500 : 800));
    if (this.cs !== cs) return;

    // Place the conversations, then wait until this case's room is built so you never hear the host in the old room.
    this.ready = true;
    this.phase = 'prepare';
    this.message = 'Setting the scene...';
    const waitStart = performance.now();
    while (window.earshotBuilt !== cs.id && performance.now() - waitStart < 15000) {
      await new Promise((r) => setTimeout(r, 100));
      if (this.cs !== cs) return;
    }

    this.phase = 'intro';
    this.message = 'The host is speaking... listen.';
    if (timed) this.showCards(cs.title.toUpperCase(), cs.tagline || '', []);
    this.playHost(this.introBuf, () => { if (this.cs === cs && this.phase === 'intro') this.startChatter(); });
  }

  teardown() {
    clearTimeout(this.revealTimer);
    clearTimeout(this.finishTimer);
    this.stopChatter();
    for (const c of this.convos) {
      try { if (c.clueSrc) c.clueSrc.stop(); } catch (e) { /* already stopped */ }
      try { c.panner.disconnect(); c.filter.disconnect(); c.gain.disconnect(); c.clueGain.disconnect(); } catch (e) { /* ignore */ }
      for (const k of ['orb', 'ring']) if (c[k] && c[k].parent) c[k].parent.remove(c[k]);
    }
    this.convos = [];
    this.clearCards();
    if (this.hud3) this.hud3.mesh.visible = false;
    this.hudOn = false;
  }

  stopChatter() {
    for (const c of this.convos) {
      try { if (c.src) c.src.stop(); } catch (e) { /* already stopped */ }
      c.src = null;
    }
  }

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
    const dg = this.ctx.createGain(); dg.gain.value = vol;
    d.connect(dg).connect(this.ctx.destination);
    d.start();
  }

  playBuzz() {
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(160, t); o.frequency.linearRampToValueAtTime(105, t + 0.22);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.1, t + 0.03); g.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700;
    o.connect(lp).connect(g).connect(ctx.destination);
    o.start(t); o.stop(t + 0.3);
  }

  playFanfare() {
    const ctx = this.ctx, t0 = ctx.currentTime + 0.05;
    const master = ctx.createGain(); master.gain.value = 0.3; master.connect(ctx.destination);
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i, arr) => {
      const t = t0 + i * 0.13, tail = i === arr.length - 1 ? 1.6 : 0.5;
      for (const [mult, vol, type] of [[1, 1, 'triangle'], [2, 0.3, 'sine']]) {
        const o = ctx.createOscillator(); o.type = type; o.frequency.value = f * mult;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t + tail);
        o.connect(g).connect(master); o.start(t); o.stop(t + tail + 0.1);
      }
    });
  }

  playApplause(seconds) {
    const ctx = this.ctx, t0 = ctx.currentTime + 0.3;
    const len = Math.floor(ctx.sampleRate * 0.12);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2200; bp.Q.value = 0.7;
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, t0); master.gain.linearRampToValueAtTime(0.5, t0 + 0.4); master.gain.linearRampToValueAtTime(0.0001, t0 + seconds);
    bp.connect(master).connect(ctx.destination);
    const n = Math.floor(seconds * 30);
    for (let k = 0; k < n; k++) {
      const s = ctx.createBufferSource(); s.buffer = buf;
      s.playbackRate.value = 0.7 + Math.random() * 0.8;
      s.connect(bp); s.start(t0 + Math.pow(Math.random(), 0.85) * (seconds - 0.2));
    }
  }

  // Firework thumps: low, soft noise bursts.
  playBangs() {
    const ctx = this.ctx, t0 = ctx.currentTime + 0.4;
    const len = Math.floor(ctx.sampleRate * 0.35);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.2);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260;
    const g = ctx.createGain(); g.gain.value = 0.55;
    lp.connect(g).connect(ctx.destination);
    for (let b = 0; b < 6; b++) {
      const s = ctx.createBufferSource(); s.buffer = buf; s.playbackRate.value = 0.8 + Math.random() * 0.4;
      s.connect(lp); s.start(t0 + 0.2 + b * 0.6);
    }
  }

  startChatter() {
    // Re-place the room only if you have turned or moved noticeably since it was placed.
    const head = this.player.head;
    head.updateWorldMatrix(true, false);
    const m = head.matrixWorld.elements;
    const fl = Math.hypot(m[8], m[10]) || 1;
    const ffx = -m[8] / fl, ffz = -m[10] / fl;
    const pi = this.placeInfo;
    if (!pi || Math.hypot(m[12] - pi.px, m[14] - pi.pz) > 0.6 || ffx * pi.ffx + ffz * pi.ffz < Math.cos(0.4)) this.placed = false;

    this.clearCards();
    const t0 = this.ctx.currentTime;
    for (const c of this.convos) {
      c.speaker = c.cfg.startSpeaker || 0;
      const src = this.ctx.createBufferSource();
      src.buffer = c.chatterBuf; src.loop = true;
      src.connect(c.filter); src.connect(c.chatterAn);
      src.start();
      c.src = src; c.t0 = t0;
    }
    this.phase = 'play';
    if (this.cs.mode === 'timed') {
      this.endAt = performance.now() + this.cs.time * 1000;
      this.notes = []; this.hudOn = true; this.downT = 0;
      this.message = 'Listen in. Cup a hand toward a conversation.';
    } else {
      this.message = 'Cup a hand toward a conversation to listen in.';
    }
  }

  // ---------- classic cases: catching a clue ----------

  catchClue(c) {
    c.caught = true; c.pulse = 0; this.caughtCount++;
    const ctx = this.ctx, t = ctx.currentTime, cs = this.cs;
    this.playDing(0.3);
    const s = ctx.createBufferSource();
    s.buffer = c.clueBuf; s.connect(c.clueGain); s.connect(c.clueAn);
    s.start(t + 0.4);
    c.clueSrc = s;
    s.onended = () => { if (this.cs === cs && this.phase === 'play' && this.caughtCount === this.convos.length) this.beginAccuse(); };
    c.clueUntil = performance.now() + (0.4 + c.clueBuf.duration) * 1000 + 200;
    this.clueUntil = Math.max(this.clueUntil, performance.now() + (0.4 + c.clueBuf.duration) * 1000 + 300);
    this.message = 'Clue ' + this.caughtCount + ' of ' + this.convos.length + ' caught!';
  }

  // ---------- timed case: evidence in the notebook ----------

  noteEvidence(c, e) {
    e.done = true;
    c.pulse = 0;
    c.caught = c.ev.every((x) => x.done);
    this.notes.push({ text: e.note, key: !!e.key });
    this.playDing(0.35);
    this.toast = { text: e.note, t: performance.now() };
    this.message = 'Notebook: ' + this.notes.length + ' / ' + this.totalEv;
  }

  ensureHud() {
    if (this.hud3) return;
    const cv = document.createElement('canvas');
    cv.width = 1024; cv.height = 720;
    const tex = new CanvasTexture(cv);
    tex.colorSpace = SRGBColorSpace;
    const mesh = new Mesh(new PlaneGeometry(1.1, 0.7734), new MeshBasicMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }));
    mesh.renderOrder = 40;
    mesh.position.set(0, -0.587, -0.9);
    mesh.visible = false;
    this.player.head.add(mesh);
    this.hud3 = { cv, ctx: cv.getContext('2d'), tex, mesh, sig: '' };
  }

  // The notebook and countdown, drawn on a card that follows your head. Redrawn only when something changes.
  updateHud(nowMs, left) {
    this.ensureHud();
    const H = this.hud3;
    const show = this.phase === 'play' && this.hudOn;
    H.mesh.visible = show;
    if (!show) return;
    const n = this.notes.length, total = this.totalEv, minN = this.cs.minNotes || 6, unlocked = n >= minN;
    const expanded = this.lastFy < -0.35;
    const toast = this.toast && nowMs - this.toast.t < 5500 ? this.toast : null;
    const sig = [n, Math.ceil(left), expanded ? 1 : 0, toast ? toast.t : 0, Math.round(this.downT * 10), unlocked ? 1 : 0].join('|');
    if (sig === H.sig) return;
    H.sig = sig;

    const g = H.ctx;
    g.clearRect(0, 0, 1024, 720);
    g.fillStyle = 'rgba(28,12,20,0.88)'; roundRect(g, 8, 8, 1008, 84, 26); g.fill();
    g.lineWidth = 5; g.strokeStyle = '#b98a4a'; g.stroke();
    g.textBaseline = 'middle';
    g.textAlign = 'left'; g.fillStyle = '#ffe9b8'; g.font = 'bold 32px Georgia, serif';
    g.fillText('NOTEBOOK  ' + n + ' / ' + total, 34, 50);
    g.textAlign = 'right'; g.fillStyle = left < 60 ? '#ff7a6a' : '#f6ead3'; g.font = 'bold 40px Georgia, serif';
    g.fillText(fmtTime(Math.max(0, left)), 996, 50);
    g.textAlign = 'center'; g.fillStyle = '#f6ead3'; g.font = 'italic 24px Georgia, serif';
    g.fillText(unlocked ? 'Look down to accuse' : 'Cup a hand to listen', 512, 50);

    if (expanded) {
      g.fillStyle = 'rgba(246,234,211,0.97)'; roundRect(g, 8, 102, 1008, 606, 26); g.fill();
      g.lineWidth = 5; g.strokeStyle = '#b98a4a'; g.stroke();
      g.textAlign = 'left'; g.fillStyle = '#5b2432'; g.font = 'bold 30px Georgia, serif';
      g.fillText('DETECTIVE NOTEBOOK', 34, 140);
      g.font = '24px Georgia, serif';
      let y = 184;
      if (!n) { g.fillStyle = '#8a6a5a'; g.fillText('Nothing yet. Turn toward a conversation and cup a hand to your ear.', 34, y); }
      for (let k = 0; k < n; k++) {
        const lines = wrapLines(g, (k + 1) + '. ' + this.notes[k].text, 940);
        for (const ln of lines) { if (y > 610) break; g.fillText(ln, 34, y); y += 30; }
        y += 5;
      }
      g.textAlign = 'center';
      if (unlocked) {
        g.fillStyle = '#5b2432'; g.font = 'bold 26px Georgia, serif'; g.fillText('Keep looking down to accuse', 512, 646);
        g.fillStyle = 'rgba(91,36,50,0.2)'; g.fillRect(212, 668, 600, 16);
        g.fillStyle = '#d9a24f'; g.fillRect(212, 668, 600 * clamp01(this.downT / ACCUSE_DWELL), 16);
      } else {
        g.fillStyle = '#8a6a5a'; g.font = 'italic 24px Georgia, serif';
        g.fillText('Collect ' + (minN - n) + ' more notes to unlock your accusation', 512, 660);
      }
    } else if (toast) {
      g.fillStyle = 'rgba(28,12,20,0.9)'; roundRect(g, 8, 100, 1008, 84, 22); g.fill();
      g.lineWidth = 4; g.strokeStyle = '#d9a24f'; g.stroke();
      g.textAlign = 'left'; g.fillStyle = '#ffd98a'; g.font = 'italic 24px Georgia, serif';
      const lines = wrapLines(g, 'Noted: ' + toast.text, 960).slice(0, 2);
      lines.forEach((ln, i) => g.fillText(ln, 30, 128 + i * 32));
    }
    H.tex.needsUpdate = true;
  }

  buildReport() {
    const cs = this.cs;
    const keyFound = this.notes.filter((n) => n.key).length;
    const score = Math.max(0, keyFound * 100 + this.notes.length * 10 + Math.floor(this.leftAtAccuse / 10) - this.wrongCount * 40);
    const rank = keyFound === this.totalKey && this.notes.length >= this.totalEv - 1 ? 'PERFECT EAR'
      : keyFound >= this.totalKey - 1 ? 'SHARP EAR' : keyFound >= 4 ? 'GOOD EAR' : 'LUCKY GUESS';
    const isBest = saveBest(cs.id, score);
    return rank + '  |  Key clues ' + keyFound + '/' + this.totalKey + '  |  Notes ' + this.notes.length + '/' + this.totalEv +
      '  |  Time left ' + fmtTime(this.leftAtAccuse) + (this.wrongCount ? '  |  Wrong picks ' + this.wrongCount : '') +
      '  |  Score ' + score + (isBest ? '  NEW BEST' : '');
  }

  // ---------- the accusation, finale and case file ----------

  beginAccuse() {
    this.phase = 'accuse';
    this.hudOn = false;
    if (this.cs.mode === 'timed') this.leftAtAccuse = Math.max(0, Math.round((this.endAt - performance.now()) / 1000));
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
    for (let i = opts.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [opts[i], opts[j]] = [opts[j], opts[i]]; }
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
      this.playBuzz();
      this.wrongCount++;
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
    window.earshotState.celebrate++;  // confetti in the rooms, fireworks at the gala
    for (const o of this.convos) o.pulse = 0;
    saveSolved(cs.id);
    if (cs.mode === 'timed') this.report = this.buildReport();
    this.message = 'SOLVED: ' + cs.finale.text;
    this.playFanfare();
    this.playApplause(3.4);
    if (cs.theme === 'gala') this.playBangs();
    this.showCards('CASE SOLVED', cs.finale.text, []);
    // The host gives the solution just after the fanfare, then you get a few seconds to enjoy the finale.
    this.revealTimer = setTimeout(() => {
      if (this.cs !== cs || this.phase !== 'solved') return;
      this.playHost(this.revealBuf, () => {
        if (this.cs !== cs || this.phase !== 'solved') return;
        this.finishTimer = setTimeout(() => {
          if (this.cs === cs && this.phase === 'solved') this.finish();
        }, FINALE_HOLD);
      });
    }, 1600);
  }

  finish() {
    this.stopChatter();
    this.phase = 'menu';
    this.showMenu('Case file', this.report || 'Choose what to play next.');
  }

  showMenu(title, sub, follow) {
    const solved = readSolved();
    const best = readBest();
    const opts = CASES.map((c, i) => ({
      label: (i + 1) + '. ' + c.title,
      sub: solved.includes(c.id) ? (best[c.id] ? 'Solved. Best ' + best[c.id] : 'Solved. Play again') : 'New case',
      onPick: () => { this.clearCards(); this.loadCase(c, false); },
    }));
    this.showCards(title, sub, opts, follow);
  }

  // ---------- in-world cards (readable and choosable inside the headset) ----------

  makeCard(o) {
    const cv = document.createElement('canvas');
    cv.width = 460; cv.height = 260;
    const tex = new CanvasTexture(cv);
    tex.colorSpace = SRGBColorSpace;
    const mesh = new Mesh(new PlaneGeometry(0.46, 0.26), new MeshBasicMaterial({ map: tex, transparent: true, depthTest: false, side: DoubleSide }));
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
    cv.width = 1000; cv.height = 240;
    const ctx = cv.getContext('2d');
    const tex = new CanvasTexture(cv);
    tex.colorSpace = SRGBColorSpace;
    const mesh = new Mesh(new PlaneGeometry(0.96, 0.23), new MeshBasicMaterial({ map: tex, transparent: true, depthTest: false, side: DoubleSide }));
    mesh.renderOrder = 30;
    const t = {
      mesh, tex,
      set(a, b) {
        ctx.clearRect(0, 0, 1000, 240);
        ctx.fillStyle = 'rgba(30,14,20,0.88)'; roundRect(ctx, 4, 4, 992, 232, 26); ctx.fill();
        ctx.lineWidth = 6; ctx.strokeStyle = '#b98a4a'; ctx.stroke();
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffe9b8'; ctx.font = 'bold 50px Georgia, serif';
        const tl = wrapLines(ctx, a, 920);
        ctx.fillText(tl[0] + (tl.length > 1 ? '...' : ''), 500, 62);
        ctx.fillStyle = '#f6ead3'; ctx.font = '30px Georgia, serif';
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
      // Kept low (about 18 and 32 degrees below eye level) so they never cover the people you are looking at.
      // In the flat desktop preview the view is much narrower than in a headset, so lift the cards into frame.
      const vs = this.world && this.world.visibilityState;
      const desk = !!vs && vs.value === 'non-immersive';
      const titleY = desk ? baseY - 0.08 : baseY - 0.4, cardY = desk ? baseY - 0.4 : baseY - 0.68;
      const dist = desk ? 1.5 : 1.1, gap = desk ? 22 : 26;
      put(titleCard.mesh, 0, desk ? 1.5 : 1.2, titleY);
      items.forEach((it, i) => put(it.mesh, (i - (items.length - 1) / 2) * gap, dist, cardY));
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
      cv.width = 720; cv.height = 320;
      this.testCtx = cv.getContext('2d');
      this.testTex = new CanvasTexture(cv);
      this.testTex.colorSpace = SRGBColorSpace;
      this.testPlane = new Mesh(new PlaneGeometry(0.72, 0.32), new MeshBasicMaterial({ map: this.testTex, transparent: true, depthTest: false }));
      this.testPlane.renderOrder = 20;
      this.testPlane.position.set(0, -0.32, -0.9);
      this.player.head.add(this.testPlane);
    }
    const t = performance.now();
    if (t - (this.testDraw || 0) < 200) return;
    this.testDraw = t;
    const g = this.testCtx;
    g.clearRect(0, 0, 720, 320);
    g.fillStyle = 'rgba(0,0,0,0.65)'; g.fillRect(0, 0, 720, 320);
    g.fillStyle = '#ffffff'; g.font = '17px monospace';
    lines.forEach((s, i) => g.fillText(s, 12, 28 + i * 26));
    this.testTex.needsUpdate = true;
  }

  update() {
    const nowMs = performance.now();
    const dt = this.last ? Math.min(0.1, (nowMs - this.last) / 1000) : 0;
    this.last = nowMs;
    window.earshotState.phase = this.phase;

    if (!this.ctx) { this.hud.textContent = this.message; return; }

    const head = this.player.head;
    head.updateWorldMatrix(true, false);
    const m = head.matrixWorld.elements;
    const px = m[12], py = m[13], pz = m[14];
    const fx = -m[8], fy = -m[9], fz = -m[10];
    const ux = m[4], uy = m[5], uz = m[6];
    this.lastFy = fy;

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
      for (const side of ['left', 'right']) { const p = this.getPose(spaces[side]); if (p) hands.push(p); }
    } else if (!this.warned) {
      console.warn('Earshot: hand spaces not found on world.playerSpaceEntities');
      this.warned = true;
    }
    const rsp = pse && pse[RAY_SPACE];
    if (rsp) for (const side of ['left', 'right']) { const p = this.getPose(rsp[side]); if (p) rays.push(p); }

    if (this.cards) this.updateCards(dt, rays.length ? rays : hands, [px, py, pz], [fx, fy, fz]);

    // A gold ripple at each hand raised near your head: shows the game sees your listening gesture.
    if (!this.ripples) {
      this.ripples = [0, 1].map(() => {
        const r = new Mesh(new RingGeometry(0.85, 1, 40), new MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0, side: DoubleSide, depthTest: false }));
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

    if (!this.ready) { this.hud.textContent = this.message; return; }

    const cs = this.cs;
    const timed = cs.mode === 'timed';

    // Place every conversation (re-done when chatter starts, but only if you moved or turned).
    if (!this.placed) {
      const flat = Math.hypot(fx, fz) || 1;
      const ffx = fx / flat, ffz = fz / flat;
      const rx = -ffz, rz = ffx;
      const baseY = py > 0.5 ? py : 1.4;
      for (const c of this.convos) {
        if (c.cfg.at) {
          // Timed case: a fixed spot in the party's own coordinates (forward is -z, right is +x).
          const ax = c.cfg.at[0], az = c.cfg.at[1];
          c.x = px + ffx * -az + rx * ax;
          c.z = pz + ffz * -az + rz * ax;
        } else {
          const dist = c.cfg.dist || 1.4;
          const a = (c.cfg.angle * Math.PI) / 180;
          c.x = px + (ffx * Math.cos(a) + rx * Math.sin(a)) * dist;
          c.z = pz + (ffz * Math.cos(a) + rz * Math.sin(a)) * dist;
        }
        c.y = baseY - 0.1;
        c.panner.positionX.value = c.x;
        c.panner.positionY.value = c.y;
        c.panner.positionZ.value = c.z;

        if (!c.orb) {
          c.orb = new Mesh(new SphereGeometry(1, 24, 16), new MeshBasicMaterial({ color: 0xff9f5b, transparent: true, opacity: 0.4, depthWrite: false }));
          c.orb.scale.setScalar(0.05);
          this.addToScene(c.orb);
          c.ring = new Mesh(new RingGeometry(0.9, 1, 48), new MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0, side: DoubleSide, depthWrite: false }));
          c.ring.scale.setScalar(0.1);
          this.addToScene(c.ring);
        }
        // The visible orb floats above the guests' heads; the sound itself stays at head height.
        c.orb.position.set(c.x, c.y + 0.7, c.z);
        c.ring.position.set(c.x, c.y + 0.7, c.z);
        c.ring.lookAt(px, baseY, pz);
      }
      this.placed = true;
      this.placeInfo = { px, pz, ffx, ffz };
      window.earshotForward = [ffx, ffz];
      window.earshotLayout = this.convos.map((c) => ({ x: c.x, y: c.y, z: c.z }));
      window.earshotCase = cs;
    }

    const now = this.ctx.currentTime;
    const clueActive = nowMs < this.clueUntil;
    const hush = clueActive || this.phase !== 'play';
    const lines = ['Case ' + cs.id + (timed ? '  Notes: ' + this.notes.length + '/' + this.totalEv : '  Clues: ' + this.caughtCount + '/' + this.convos.length)];

    // Which conversation are you facing most directly? (the no-hands gaze assist)
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

      // Where we are in this conversation's loop (for calibrating evidence timings with ?debug).
      if (c.src) c.pos = (now - c.t0) % c.dur;

      // Who is talking right now, and how loudly (drives the guests' mouths).
      const clueNow = nowMs < c.clueUntil;
      const lvl = c.src || clueNow ? this.levelOf(clueNow ? c.clueAn : c.chatterAn) : 0;
      if (!clueNow) {
        if (lvl < 0.02) c.quiet += dt;
        else { if (c.quiet > 0.3) c.speaker = this.nextSpeaker(c); c.quiet = 0; }
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

      // Sound: clearer when you look and cup; far conversations get a boost; chatter ducks while a clue or the host plays.
      const focus = clamp01(0.5 * look + 0.8 * cup);
      c.gain.gain.setTargetAtTime((hush ? QUIET : 0.15 + 0.85 * focus) * c.boost, now, 0.1);
      c.filter.frequency.setTargetAtTime(hush ? 400 : 500 + 7500 * focus, now, 0.1);

      if (this.phase === 'play') {
        if (timed) {
          // Evidence is only caught if you are listening while that line is spoken.
          const rate = cup >= CUP_ON ? 1 : i === lookIdx ? EV_GAZE : 0;
          if (rate > 0) {
            for (const e of c.ev) {
              if (e.done) continue;
              if (c.pos >= e.at && c.pos < e.at + e.len) {
                e.heard += dt * rate;
                if (e.heard >= e.len * EV_NEED) this.noteEvidence(c, e);
              }
            }
          }
        } else if (!c.caught) {
          // Classic: cupping is fast; holding your gaze is a slower assist for players without hands.
          if (cup >= CUP_ON) c.dwell = Math.min(NEED, c.dwell + dt * (1 + look));
          else if (i === lookIdx && !clueActive) c.dwell = Math.min(NEED, c.dwell + dt * GAZE_RATE);
          else c.dwell = Math.max(0, c.dwell - dt);
          if (c.dwell >= NEED) this.catchClue(c);
        }
      }

      // Orb: grows and brightens with focus and progress; gold once everything here is caught.
      if (c.orb) {
        const prog = c.caught ? 1 : timed ? (c.ev.length ? c.ev.filter((e) => e.done).length / c.ev.length : 0) : c.dwell / NEED;
        const beat = this.phase === 'solved' ? 0.02 * Math.sin(nowMs / 150) : 0;
        c.orb.scale.setScalar(c.caught ? 0.11 + beat : 0.05 + 0.04 * focus + 0.04 * prog);
        c.orb.material.opacity = c.caught ? 0.95 : 0.3 + 0.4 * focus + 0.25 * prog;
        c.orb.material.color.setHex(c.caught ? 0xffd34d : 0xff9f5b);
        if (c.pulse >= 0) {
          c.pulse += dt;
          const t = c.pulse / 1.2;
          if (t >= 1) { c.pulse = -1; c.ring.material.opacity = 0; }
          else { c.ring.scale.setScalar(0.1 + 0.5 * t); c.ring.material.opacity = 0.9 * (1 - t); }
        }
      }

      if (timed) {
        const done = c.ev.filter((e) => e.done).length;
        lines.push(
          (c.cfg.name || 'G' + (i + 1)).padEnd(7) + ' look ' + look.toFixed(2) + '  cup ' + cup.toFixed(2) +
          '  t ' + c.pos.toFixed(1).padStart(5) + '/' + c.dur.toFixed(0) + '  ev ' + done + '/' + c.ev.length +
          '  spk ' + (state.convos[i] ? state.convos[i].speaker : '-')
        );
      } else {
        const filled = Math.round((10 * c.dwell) / NEED);
        const bar = c.caught ? 'CAUGHT    ' : '#'.repeat(filled) + '-'.repeat(10 - filled);
        lines.push(
          c.cfg.name + '  look ' + look.toFixed(2) + '  cup ' + cup.toFixed(2) + '  [' + bar + ']' +
          '  talk ' + c.lvl.toFixed(2) + ' spk ' + (state.convos[i] ? state.convos[i].speaker : '-')
        );
      }
    }

    // Timed case: the countdown, the notebook, and accusing by looking down at it.
    if (timed) {
      const left = this.phase === 'play' ? Math.max(0, (this.endAt - nowMs) / 1000) : 0;
      if (this.phase === 'play') {
        const unlocked = this.notes.length >= (cs.minNotes || 6);
        if (unlocked && fy < DOWN_Y) this.downT += dt;
        else this.downT = Math.max(0, this.downT - dt * 2);
        if (this.downT >= ACCUSE_DWELL) { this.message = 'You made your move.'; this.beginAccuse(); }
        else if (left <= 0) { this.message = "Time's up!"; this.beginAccuse(); }
        lines.push('time ' + fmtTime(left) + '  notes ' + this.notes.length + '/' + this.totalEv + '  down ' + this.downT.toFixed(1));
      }
      this.updateHud(nowMs, left);
    }

    lines.push('');
    lines.push(this.message);
    this.hud.textContent = lines.join('\n');
    if (TEST) this.drawTestHud(lines);
  }
}