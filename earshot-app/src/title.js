import { createSystem, VisibilityState } from '@iwsdk/core';

export class TitleSystem extends createSystem({}) {
  init() {
    const el = document.createElement('div');
    el.style.cssText =
      'position:fixed;inset:0;z-index:99998;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;text-align:center;padding:24px;background:radial-gradient(ellipse at center,#4a1f2c 0%,#1c0d14 75%);color:#f6ead3;font-family:Georgia,serif;';
    el.innerHTML =
      '<div style="font-size:clamp(44px,9vw,92px);letter-spacing:.14em;font-weight:bold">EARSHOT</div>' +
      '<div style="font-size:clamp(16px,2.6vw,24px);max-width:640px;opacity:.92">A seated audio mystery.<br>Cup your hand to your ear and listen in.</div>' +
      '<div style="font-size:15px;opacity:.7;max-width:520px">Put on headphones. Hands only, no controllers needed. About five minutes.</div>';

    const mk = (label, primary) => {
      const b = document.createElement('button');
      b.textContent = label;
      b.style.cssText =
        'cursor:pointer;font:600 20px Georgia,serif;padding:14px 38px;border-radius:999px;border:2px solid #d9a24f;' +
        (primary ? 'background:#d9a24f;color:#2b1a10;' : 'background:transparent;color:#f6ead3;font-size:16px;padding:10px 26px;');
      return b;
    };
    const enter = mk('Enter VR', true);
    const preview = mk('Preview on this screen', false);
    enter.addEventListener('click', () => { try { this.world.launchXR(); } catch (e) { console.warn(e); } });
    preview.addEventListener('click', () => { el.style.display = 'none'; });
    el.append(enter, preview);
    document.body.appendChild(el);

    const vs = this.world.visibilityState;
    if (vs && vs.subscribe) {
      this.cleanupFuncs.push(
        vs.subscribe((s) => { el.style.display = s === VisibilityState.NonImmersive ? 'flex' : 'none'; })
      );
    }
  }
}