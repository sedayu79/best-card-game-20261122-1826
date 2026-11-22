// Ember Pact: the bootstrap. Wires the canvas, the mouse and the keyboard to
// the rules, runs the animation loop, and turns rules events into sounds and
// motion. With ?shot=title|play|win|loss&seed=N it stages one deterministic
// scene instead of starting a live duel.
import { createDuel, endPlayerTurn, playPlayerCard } from './rules.js';
import {
  LAYOUT,
  SCREEN_LOSS,
  SCREEN_PLAY,
  SCREEN_TITLE,
  SCREEN_WIN,
  VIEW_H,
  VIEW_W,
  createFx,
  draw,
  fxFromEvents,
  snapFx,
  startDeal,
  tickFx,
} from './render.js';
import { stageShot } from './shots.js';
import * as sfx from './audio.js';

const canvas = document.getElementById('game');
const statusEl = document.getElementById('status');
const ctx = canvas.getContext('2d');
canvas.width = VIEW_W;
canvas.height = VIEW_H;

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seed = Number(params.get('seed') || '7') || 7;

let level = 1;
let state = createDuel(level, seed);
let screen = SCREEN_PLAY;
let fx = createFx();
const ui = { hover: -1, hoverEnd: false, guided: -1, selected: -1 };

function say(text) {
  statusEl.textContent = text;
}

function refreshGuided() {
  ui.guided = -1;
  if (screen !== SCREEN_PLAY || state.turn !== 1 || state.player.playedThisTurn) return;
  for (let i = 0; i < state.player.hand.length; i += 1) {
    if (state.player.hand[i].cost <= state.player.ember) { ui.guided = i; break; }
  }
}

function handleEvents(events) {
  fxFromEvents(fx, events, screen);
  for (const ev of events) {
    if (ev.type === 'damage') sfx.playThud(ev.crit);
    else if (ev.type === 'combo') sfx.playChime();
    else if (ev.type === 'heal' || ev.type === 'shield') sfx.playChime();
    else if (ev.type === 'win') sfx.playWin();
    else if (ev.type === 'loss') sfx.playLoss();
    else if (ev.type === 'error') sfx.playError();
  }
  if (state.phase === 'win') screen = SCREEN_WIN;
  else if (state.phase === 'loss') screen = SCREEN_LOSS;
  refreshGuided();
}

function startDuel(nextLevel) {
  level = nextLevel;
  state = createDuel(level, seed + level * 101);
  screen = SCREEN_PLAY;
  fx = createFx();
  startDeal(fx);
  say(`Duel ${level}. Play a card, then End Turn.`);
  refreshGuided();
}

function playCardAt(index) {
  if (screen !== SCREEN_PLAY) return;
  const events = playPlayerCard(state, index);
  const ok = !events.some((e) => e.type === 'error');
  if (ok) {
    sfx.playThock();
    ui.selected = index;
    window.setTimeout(() => { ui.selected = -1; }, 260);
  }
  handleEvents(events);
  say(events.find((e) => e.type === 'error')?.text || `Played ${state.lastPlayedPlayer?.name || 'a card'}.`);
}

function endTurn() {
  if (screen !== SCREEN_PLAY) return;
  sfx.playClick();
  const events = endPlayerTurn(state);
  handleEvents(events);
  if (state.phase === 'play') {
    startDeal(fx);
    sfx.playDeal();
  }
  say(state.phase === 'play' ? `Turn ${state.turn}. ${state.player.ember} embers.` : '');
}

// ---- Input: mouse -----------------------------------------------------------

function toGameCoords(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * VIEW_W,
    y: ((event.clientY - rect.top) / rect.height) * VIEW_H,
  };
}

function handHit(x, y) {
  const L = LAYOUT.hand;
  const n = state.player.hand.length;
  for (let i = n - 1; i >= 0; i -= 1) {
    const slotX = L.x + (i - (n - 1) / 2) * L.gap - L.w / 2;
    if (x >= slotX && x <= slotX + L.w && y >= L.y - 26 && y <= L.y + L.h) return i;
  }
  return -1;
}

function inRect(x, y, r) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

canvas.addEventListener('mousemove', (event) => {
  const { x, y } = toGameCoords(event);
  ui.hover = screen === SCREEN_PLAY ? handHit(x, y) : -1;
  ui.hoverEnd = screen === SCREEN_PLAY && inRect(x, y, LAYOUT.endTurn);
});

canvas.addEventListener('click', (event) => {
  const { x, y } = toGameCoords(event);
  if (screen === SCREEN_TITLE) {
    const b = LAYOUT.playButton;
    if (inRect(x, y, { x: b.x - b.w / 2, y: b.y, w: b.w, h: b.h })) startDuel(1);
    return;
  }
  if (screen === SCREEN_WIN) {
    const b = LAYOUT.bigButton;
    if (inRect(x, y, { x: b.x - b.w / 2, y: b.y, w: b.w, h: b.h })) startDuel(level + 1);
    return;
  }
  if (screen === SCREEN_LOSS) {
    const b = LAYOUT.bigButton;
    if (inRect(x, y, { x: b.x - b.w / 2, y: b.y, w: b.w, h: b.h })) startDuel(level);
    return;
  }
  const hit = handHit(x, y);
  if (hit !== -1) { playCardAt(hit); return; }
  if (inRect(x, y, LAYOUT.endTurn)) endTurn();
});

// ---- Input: keyboard --------------------------------------------------------

window.addEventListener('keydown', (event) => {
  if (event.key >= '1' && event.key <= '5') {
    playCardAt(Number(event.key) - 1);
  } else if (event.key === 'Enter') {
    if (screen === SCREEN_TITLE) startDuel(1);
    else if (screen === SCREEN_WIN) startDuel(level + 1);
    else if (screen === SCREEN_LOSS) startDuel(level);
    else endTurn();
  } else if (event.key === 'm' || event.key === 'M') {
    sfx.toggleMute();
    say(sfx.isMuted() ? 'Muted.' : 'Sound on.');
  } else if (event.key === 'r' || event.key === 'R') {
    startDuel(level);
  }
});

// ---- Boot -------------------------------------------------------------------

if (shotName) {
  // A deterministic scene: play the real rules forward, then hold one frame.
  // The loss scene needs a strong foe, or the weakest autopilot never falls.
  if (shotName === 'loss') state = createDuel(3, seed);
  const staged = stageShot(shotName, state);
  screen = staged.screen;
  state = staged.state;
  snapFx(fx);
  if (screen === SCREEN_WIN) fxFromEvents(fx, [{ type: 'win' }], screen);
  draw(ctx, state, screen, fx, ui);
  say(`Ember Pact, ${shotName} scene.`);
} else {
  screen = SCREEN_TITLE;
  state = createDuel(1, seed);
  refreshGuided();
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    tickFx(fx, dt);
    draw(ctx, state, screen, fx, ui);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  say('Ember Pact. Press Play to begin the duel.');
}
