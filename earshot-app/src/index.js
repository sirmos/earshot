import { World } from '@iwsdk/core';
import projectOptions from 'virtual:iwsdk-project';
import { PanelSystem } from './panel.js';
import { RobotSystem } from './robot.js';
import { EarshotSystem } from './earshot.js';
import { RoomSystem } from './room.js';
import { GalaSystem } from './gala.js';
import { TitleSystem } from './title.js';

// Add ?debug to the address to see errors on screen (works inside a headset too).
let report = () => {};
if (new URLSearchParams(location.search).has('debug')) {
  const box = document.createElement('pre');
  box.style.cssText =
    'position:fixed;top:0;left:0;right:0;max-height:45vh;overflow:auto;margin:0;padding:8px;background:rgba(110,0,0,.92);color:#fff;font:12px monospace;z-index:2147483647;white-space:pre-wrap';
  document.body.appendChild(box);
  const seen = {};
  report = (m) => {
    const k = String(m).slice(0, 160);
    seen[k] = (seen[k] || 0) + 1;
    if (seen[k] > 2) return; // show each message only a couple of times
    box.textContent += m + '\n';
  };
  window.addEventListener('error', (e) =>
    report('ERROR: ' + e.message + ' @ ' + String(e.filename || '').split('/').pop() + ':' + e.lineno));
  window.addEventListener('unhandledrejection', (e) =>
    report('REJECTION: ' + ((e.reason && e.reason.message) || e.reason)));
  const ce = console.error;
  console.error = (...a) => { report('console.error: ' + a.join(' ')); ce(...a); };
  const cw = console.warn;
  console.warn = (...a) => { report('warn: ' + a.join(' ')); cw(...a); };
}

World.create(document.getElementById('scene-container'), projectOptions)
  .then((world) => {
    const systems = [
      ['Robot', RobotSystem],
      ['Panel', PanelSystem],
      ['Earshot', EarshotSystem],
      ['Room', RoomSystem],
      ['Gala', GalaSystem],
      ['Title', TitleSystem],
    ];
    const ok = [];
    for (const [name, S] of systems) {
      try {
        world.registerSystem(S);
        ok.push(name);
      } catch (e) {
        report('SYSTEM FAILED TO START: ' + name + ' -> ' + (e && e.message ? e.message : e));
        console.error('System failed: ' + name, e);
      }
    }
    report('systems started: ' + ok.join(', '));
    setTimeout(() => {
      const n = world.scene && world.scene.children ? world.scene.children.length : 'unknown';
      report('scene objects after 4s: ' + n);
    }, 4000);
  })
  .catch((e) => {
    report('World.create failed: ' + (e && e.message ? e.message : e));
    console.error(e);
  });