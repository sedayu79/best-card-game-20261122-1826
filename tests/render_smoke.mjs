// Smoke test: run the canvas renderer against a stub context for every screen,
// so a typo or bad reference in render.js fails here instead of in a browser.
// Run: node tests/render_smoke.mjs
import assert from 'node:assert/strict';
import { createDuel } from '../game/src/rules.js';
import { stageShot } from '../game/src/shots.js';
import {
  SCREEN_LOSS,
  SCREEN_PLAY,
  SCREEN_TITLE,
  SCREEN_WIN,
  createFx,
  draw,
  fxFromEvents,
  snapFx,
  tickFx,
} from '../game/src/render.js';

// A context that absorbs every call and hands back a gradient-shaped object.
const gradient = { addColorStop() {} };
const stubCtx = new Proxy({}, {
  get(target, prop) {
    if (prop === 'createRadialGradient' || prop === 'createLinearGradient') return () => gradient;
    if (prop === 'measureText') return () => ({ width: 10 });
    if (typeof prop === 'string') return (...args) => undefined;
    return undefined;
  },
  set() { return true; },
});

let checks = 0;
for (const name of ['title', 'play', 'win', 'loss']) {
  const level = name === 'loss' ? 3 : 1;
  const seed = name === 'loss' ? 49 : 7;
  const staged = stageShot(name, createDuel(level, seed));
  const fx = createFx();
  snapFx(fx);
  if (staged.screen === SCREEN_WIN) fxFromEvents(fx, [{ type: 'win' }], staged.screen);
  draw(stubCtx, staged.state, staged.screen, fx, { hover: 1, hoverEnd: true, guided: 0, selected: 2 });
  tickFx(fx, 0.5);
  draw(stubCtx, staged.state, staged.screen, fx, { hover: -1, hoverEnd: false, guided: -1, selected: -1 });
  checks += 1;
}
// Every screen from a live (non-shot) duel, with events flowing through.
const live = createDuel(1, 99);
const fx = createFx();
draw(stubCtx, live, SCREEN_TITLE, fx, {});
draw(stubCtx, live, SCREEN_PLAY, fx, { hover: 0, hoverEnd: false, guided: 0, selected: -1 });
fxFromEvents(fx, [{ type: 'damage', amount: 6, crit: true, target: 'foe' }], SCREEN_PLAY);
fxFromEvents(fx, [{ type: 'combo', suit: 'flame', text: 'FLAME COMBO! +2 burn' }], SCREEN_PLAY);
tickFx(fx, 1.2);
draw(stubCtx, live, SCREEN_PLAY, fx, {});
draw(stubCtx, live, SCREEN_WIN, fx, {});
draw(stubCtx, live, SCREEN_LOSS, fx, {});
checks += 1;

console.log(`Render smoke: ${checks} scene draws without throwing.`);
