// Everything the eye sees in Ember Pact, drawn on one canvas: the felt table,
// the two hands, the intent banner, the played cards, the combo banner, the
// title, win and loss screens, and the small flourishes (deal slide, damage
// pops, confetti). Layout constants live here and are mirrored by the Pillow
// screenshot renderer, so a screenshot is the game's own drawing.
import { SUITS } from './cards.js';
import { HAND_SIZE, lossLine } from './rules.js';

export const VIEW_W = 1280;
export const VIEW_H = 720;

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_WIN = 'win';
export const SCREEN_LOSS = 'loss';

// Layout: one source of truth for where everything sits on the 1280x720 table.
export const LAYOUT = {
  foeHand: { x: 640, y: 30, w: 64, h: 92, gap: 52 },
  foePortrait: { x: 110, y: 96, r: 46 },
  foeLife: { x: 180, y: 66, w: 220, h: 22 },
  intent: { x: 640, y: 172, w: 460, h: 40 },
  playedPlayer: { x: 470, y: 236, w: 150, h: 210 },
  playedFoe: { x: 660, y: 236, w: 150, h: 210 },
  combo: { x: 640, y: 472, w: 520, h: 36 },
  hint: { x: 640, y: 710 },
  hand: { x: 640, y: 492, w: 150, h: 210, gap: 158 },
  playerLife: { x: 48, y: 566, w: 220, h: 22 },
  ember: { x: 48, y: 616 },
  endTurn: { x: 1062, y: 622, w: 170, h: 56 },
  title: { x: 640, y: 178 },
  playButton: { x: 640, y: 386, w: 260, h: 72 },
  bigButton: { x: 640, y: 470, w: 280, h: 64 },
};

const FELT = '#1e5233';
const FELT_DARK = '#0d2a18';
const WOOD = '#5a3a22';
const CREAM = '#f7efdc';
const INK = '#241a12';

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function easeOut(t) {
  return 1 - (1 - t) * (1 - t) * (1 - t);
}

/** Draw one suit's icon (flame, wave, mountain, swirl) centred at (x, y). */
export function drawSuitIcon(ctx, suitKey, x, y, size, color) {
  const s = size / 2;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, size * 0.09);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (suitKey === 'flame') {
    ctx.beginPath();
    ctx.moveTo(0, -s);
    ctx.bezierCurveTo(s * 0.9, -s * 0.2, s * 0.7, s * 0.5, 0, s);
    ctx.bezierCurveTo(-s * 0.7, s * 0.5, -s * 0.9, -s * 0.2, 0, -s);
    ctx.fill();
    ctx.fillStyle = '#ffd23d';
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.1);
    ctx.bezierCurveTo(s * 0.45, s * 0.25, s * 0.3, s * 0.7, 0, s * 0.72);
    ctx.bezierCurveTo(-s * 0.3, s * 0.7, -s * 0.45, s * 0.25, 0, -s * 0.1);
    ctx.fill();
  } else if (suitKey === 'tide') {
    ctx.beginPath();
    for (let row = 0; row < 2; row += 1) {
      const yy = -s * 0.4 + row * s * 0.8;
      ctx.moveTo(-s, yy);
      ctx.quadraticCurveTo(-s * 0.5, yy - s * 0.55, 0, yy);
      ctx.quadraticCurveTo(s * 0.5, yy + s * 0.55, s, yy);
    }
    ctx.stroke();
  } else if (suitKey === 'stone') {
    ctx.beginPath();
    ctx.moveTo(-s, s * 0.7);
    ctx.lineTo(-s * 0.45, -s * 0.55);
    ctx.lineTo(0, s * 0.1);
    ctx.lineTo(s * 0.4, -s * 0.9);
    ctx.lineTo(s, s * 0.7);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.moveTo(s * 0.4, -s * 0.9);
    ctx.lineTo(s * 0.72, -s * 0.1);
    ctx.lineTo(s * 0.08, -s * 0.1);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  } else {
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.85, 0.6, 4.4);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.45, 2.2, 5.6);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(s * 0.62, -s * 0.55, s * 0.16, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** One ember pip: a small glowing ember dot. */
function drawEmberPip(ctx, x, y, r, lit) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  if (lit) {
    ctx.fillStyle = '#ff7a1a';
    ctx.shadowColor = '#ffb347';
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffd23d';
    ctx.beginPath();
    ctx.arc(x, y, r * 0.45, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.restore();
}

/** A face-up card: cream face, suit band, cost pips, big value, icon, name. */
export function drawCardFace(ctx, card, x, y, w, h, opts = {}) {
  const suit = SUITS[card.suit];
  const lift = opts.lift || 0;
  const dim = opts.dim || false;
  const selected = opts.selected || false;
  ctx.save();
  ctx.translate(x, y - lift);
  if (dim) ctx.globalAlpha = 0.55;
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 5;
  rr(ctx, 0, 0, w, h, 12);
  ctx.fillStyle = CREAM;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.lineWidth = selected ? 5 : 3;
  ctx.strokeStyle = selected ? '#ffd23d' : suit.color;
  ctx.stroke();
  // Suit band across the top.
  rr(ctx, 4, 4, w - 8, 34, 9);
  ctx.fillStyle = suit.color;
  ctx.fill();
  // Cost pips, top-left inside the band.
  for (let i = 0; i < card.cost; i += 1) {
    drawEmberPip(ctx, 18 + i * 17, 21, 6, true);
  }
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${Math.round(w * 0.11)}px system-ui, sans-serif`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText(suit.name.toUpperCase(), w - 12, 22);
  // Big value in the centre.
  ctx.fillStyle = INK;
  ctx.font = `bold ${Math.round(w * 0.52)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(String(card.value), w / 2, h * 0.52);
  // Suit icon above the value.
  drawSuitIcon(ctx, card.suit, w / 2, h * 0.24, w * 0.3, suit.color);
  // Name along the bottom.
  ctx.fillStyle = suit.dark;
  ctx.font = `bold ${Math.round(w * 0.115)}px system-ui, sans-serif`;
  ctx.fillText(card.name, w / 2, h - 18);
  ctx.restore();
}

/** A face-down card: dark back with an ember diamond. */
export function drawCardBack(ctx, x, y, w, h) {
  ctx.save();
  rr(ctx, x, y, w, h, 10);
  ctx.fillStyle = '#3a1c12';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#c96a2e';
  ctx.stroke();
  rr(ctx, x + 6, y + 6, w - 12, h - 12, 7);
  ctx.strokeStyle = 'rgba(201,106,46,0.6)';
  ctx.stroke();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = '#ff7a1a';
  const s = Math.min(w, h) * 0.2;
  ctx.fillRect(-s / 2, -s / 2, s, s);
  ctx.fillStyle = '#ffd23d';
  ctx.fillRect(-s / 4, -s / 4, s / 2, s / 2);
  ctx.restore();
}

/** A life bar with a number: "30 / 30" style, shield shown as a blue slice. */
function drawLifeBar(ctx, x, y, w, h, life, maxLife, shield, label) {
  ctx.save();
  ctx.font = `bold 15px system-ui, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#f7efdc';
  ctx.fillText(label, x, y - 14);
  rr(ctx, x, y, w, h, 10);
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fill();
  const frac = Math.max(0, life / maxLife);
  if (frac > 0) {
    rr(ctx, x + 2, y + 2, (w - 4) * frac, h - 4, 8);
    ctx.fillStyle = life <= 8 ? '#e8491d' : '#3fae5a';
    ctx.fill();
  }
  if (shield > 0) {
    ctx.fillStyle = '#6db3ff';
    ctx.font = `bold 13px system-ui, sans-serif`;
    ctx.textAlign = 'right';
    ctx.fillText(`+${shield} shield`, x + w, y - 14);
  }
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 14px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(`${life} / ${maxLife}`, x + w / 2, y + h / 2 + 1);
  ctx.restore();
}

function drawButton(ctx, x, y, w, h, text, enabled, hot) {
  ctx.save();
  rr(ctx, x, y, w, h, 12);
  ctx.fillStyle = enabled ? (hot ? '#ff8a3d' : '#e8491d') : 'rgba(255,255,255,0.14)';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = enabled ? '#ffd23d' : 'rgba(255,255,255,0.25)';
  ctx.stroke();
  ctx.fillStyle = enabled ? '#ffffff' : 'rgba(255,255,255,0.5)';
  ctx.font = `bold 20px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + w / 2, y + h / 2 + 1);
  ctx.restore();
}

// ---- Motion and flourishes -------------------------------------------------

/** Fresh animation state: deal slides, floating damage numbers, confetti. */
export function createFx() {
  return {
    time: 0,
    deal: 1,
    dealSeed: 0,
    playAnim: null,
    floaters: [],
    confetti: [],
    shake: 0,
    flash: 0,
    bannerUntil: 0,
  };
}

/** Finish every animation at once: the deterministic frame a screenshot takes. */
export function snapFx(fx) {
  fx.deal = 1;
  fx.playAnim = null;
  fx.shake = 0;
  fx.flash = 0;
  for (const f of fx.floaters) f.life = 0;
  fx.floaters = [];
}

/** Turn rules events into visible motion: pops, banners, shake, confetti. */
export function fxFromEvents(fx, events, screen) {
  for (const ev of events) {
    if (ev.type === 'damage') {
      const targetTop = ev.target === 'foe';
      fx.floaters.push({
        x: targetTop ? 660 : 640,
        y: targetTop ? 250 : 560,
        text: ev.crit ? `CRITICAL! ${ev.amount}` : `-${ev.amount}`,
        crit: ev.crit,
        life: 1,
        color: ev.crit ? '#ffd23d' : '#ff5a3c',
      });
      fx.shake = ev.crit ? 10 : 5;
      if (ev.crit) fx.flash = 0.35;
    } else if (ev.type === 'combo') {
      fx.bannerUntil = fx.time + 2.2;
    } else if (ev.type === 'win') {
      seedConfetti(fx, 160);
    } else if (ev.type === 'heal' || ev.type === 'shield') {
      fx.floaters.push({
        x: ev.target === 'foe' ? 660 : 640,
        y: ev.target === 'foe' ? 250 : 560,
        text: ev.type === 'heal' ? `+${ev.amount}` : `+${ev.amount} shield`,
        crit: false,
        life: 1,
        color: ev.type === 'heal' ? '#7ddb8f' : '#6db3ff',
      });
    }
  }
  if (screen === SCREEN_WIN && fx.confetti.length === 0) seedConfetti(fx, 160);
}

function seedConfetti(fx, n) {
  const colors = ['#ffd23d', '#e8491d', '#3fae5a', '#2b7de9', '#ff8a3d', '#f7efdc'];
  for (let i = 0; i < n; i += 1) {
    fx.confetti.push({
      x: 100 + Math.random() * 1080,
      y: -20 - Math.random() * 200,
      vx: (Math.random() - 0.5) * 60,
      vy: 90 + Math.random() * 160,
      size: 5 + Math.random() * 7,
      color: colors[i % colors.length],
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 6,
    });
  }
}

/** Advance the animation clock by dt seconds. */
export function tickFx(fx, dt) {
  fx.time += dt;
  if (fx.deal < 1) fx.deal = Math.min(1, fx.deal + dt * 2.2);
  if (fx.shake > 0) fx.shake = Math.max(0, fx.shake - dt * 26);
  if (fx.flash > 0) fx.flash = Math.max(0, fx.flash - dt * 1.4);
  if (fx.playAnim) {
    fx.playAnim.t += dt / 0.32;
    if (fx.playAnim.t >= 1) fx.playAnim = null;
  }
  for (const f of fx.floaters) f.life -= dt * 0.8;
  fx.floaters = fx.floaters.filter((f) => f.life > 0);
  for (const c of fx.confetti) {
    c.x += c.vx * dt;
    c.y += c.vy * dt;
    c.rot += c.vr * dt;
    if (c.y > VIEW_H + 20) {
      c.y = -20;
      c.x = 100 + Math.random() * 1080;
    }
  }
}

/** Start the deal: the hand fans in from the deck with weight. */
export function startDeal(fx) {
  fx.deal = 0;
  fx.dealSeed = fx.time;
}

// ---- The table -------------------------------------------------------------

function drawTable(ctx) {
  const g = ctx.createRadialGradient(640, 330, 80, 640, 360, 820);
  g.addColorStop(0, FELT);
  g.addColorStop(1, FELT_DARK);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.strokeStyle = WOOD;
  ctx.lineWidth = 18;
  ctx.strokeRect(9, 9, VIEW_W - 18, VIEW_H - 18);
  ctx.strokeStyle = 'rgba(255,210,61,0.25)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(640, 360, 560, 300, 0, 0, Math.PI * 2);
  ctx.stroke();
}

function drawFoeArea(ctx, state) {
  const L = LAYOUT;
  // Face-down hand, fanned across the top.
  for (let i = 0; i < HAND_SIZE; i += 1) {
    const x = L.foeHand.x + (i - (HAND_SIZE - 1) / 2) * L.foeHand.gap - L.foeHand.w / 2;
    drawCardBack(ctx, x, L.foeHand.y, L.foeHand.w, L.foeHand.h);
  }
  // Portrait: a burning ember mage.
  const p = L.foePortrait;
  ctx.save();
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
  ctx.fillStyle = '#2a160e';
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#c96a2e';
  ctx.stroke();
  ctx.clip();
  drawSuitIcon(ctx, 'flame', p.x, p.y + 4, 64, '#e8491d');
  ctx.fillStyle = '#ffd23d';
  ctx.beginPath();
  ctx.arc(p.x - 14, p.y - 12, 4, 0, Math.PI * 2);
  ctx.arc(p.x + 14, p.y - 12, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#f7efdc';
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(`${state.foeName} — ${state.foeTitle}`, L.foeLife.x, L.foeLife.y - 26);
  drawLifeBar(ctx, L.foeLife.x, L.foeLife.y, L.foeLife.w, L.foeLife.h, state.foe.life, state.foe.maxLife, state.foe.shield, '');
  ctx.fillStyle = 'rgba(247,239,220,0.85)';
  ctx.font = '14px system-ui, sans-serif';
  ctx.fillText(`Deck ${state.foe.deck.length}  ·  Discard ${state.foe.discard.length}`, L.foeLife.x, L.foeLife.y + 44);
}

function drawIntent(ctx, state) {
  const L = LAYOUT.intent;
  const intent = state.intent;
  ctx.save();
  rr(ctx, L.x - L.w / 2, L.y - L.h / 2, L.w, L.h, 20);
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = intent ? SUITS[intent.suit].color : 'rgba(255,255,255,0.3)';
  ctx.stroke();
  if (intent) {
    drawSuitIcon(ctx, intent.suit, L.x - L.w / 2 + 34, L.y, 26, SUITS[intent.suit].light);
    ctx.fillStyle = '#f7efdc';
    ctx.font = 'bold 17px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${state.foeName} will play a ${SUITS[intent.suit].name} card`, L.x - L.w / 2 + 56, L.y + 1);
  } else {
    ctx.fillStyle = 'rgba(247,239,220,0.8)';
    ctx.font = 'bold 17px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${state.foeName} has nothing to play`, L.x, L.y + 1);
  }
  ctx.restore();
}

function drawPlayed(ctx, state, fx) {
  const L = LAYOUT;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('LAST PLAYED', L.playedPlayer.x + L.playedPlayer.w / 2, L.playedPlayer.y - 12);
  ctx.fillText('LAST PLAYED', L.playedFoe.x + L.playedFoe.w / 2, L.playedFoe.y - 12);
  ctx.restore();
  if (state.lastPlayedPlayer) {
    drawCardFace(ctx, state.lastPlayedPlayer, L.playedPlayer.x, L.playedPlayer.y, L.playedPlayer.w, L.playedPlayer.h);
  } else {
    ctx.save();
    rr(ctx, L.playedPlayer.x, L.playedPlayer.y, L.playedPlayer.w, L.playedPlayer.h, 12);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.setLineDash([8, 6]);
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }
  if (state.lastPlayedFoe) {
    drawCardFace(ctx, state.lastPlayedFoe, L.playedFoe.x, L.playedFoe.y, L.playedFoe.w, L.playedFoe.h);
  } else {
    ctx.save();
    rr(ctx, L.playedFoe.x, L.playedFoe.y, L.playedFoe.w, L.playedFoe.h, 12);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.setLineDash([8, 6]);
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }
  // "VS" between the two played cards.
  ctx.save();
  ctx.fillStyle = '#ffd23d';
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('VS', 640, 340);
  ctx.restore();
}

function drawComboBanner(ctx, state, fx) {
  const L = LAYOUT.combo;
  const banner = state.comboBanner;
  if (!banner || fx.time > fx.bannerUntil) return;
  const suit = SUITS[banner.suit];
  ctx.save();
  rr(ctx, L.x - L.w / 2, L.y - L.h / 2, L.w, L.h, 18);
  ctx.fillStyle = suit.color;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#ffd23d';
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(banner.text, L.x, L.y + 1);
  ctx.restore();
}

function drawPlayerArea(ctx, state, ui) {
  const L = LAYOUT;
  drawLifeBar(ctx, L.playerLife.x, L.playerLife.y, L.playerLife.w, L.playerLife.h, state.player.life, state.player.maxLife, state.player.shield, 'YOU');
  // Ember pips: ten, lit up to the current ember count.
  ctx.save();
  ctx.fillStyle = '#f7efdc';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('EMBERS', L.ember.x, L.ember.y - 18);
  for (let i = 0; i < MAX_EMBER; i += 1) {
    drawEmberPip(ctx, L.ember.x + 12 + i * 24, L.ember.y + 8, 9, i < state.player.ember);
  }
  ctx.fillStyle = '#ffd23d';
  ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.fillText(`${state.player.ember}`, L.ember.x + 12 + MAX_EMBER * 24 + 6, L.ember.y + 8);
  ctx.fillStyle = 'rgba(247,239,220,0.85)';
  ctx.font = '14px system-ui, sans-serif';
  ctx.fillText(`Turn ${state.turn}  ·  Deck ${state.player.deck.length}`, L.ember.x, L.ember.y + 40);
  ctx.restore();
  // The hand, fanned in with weight: each card slides from the deck corner.
  const hand = state.player.hand;
  const n = hand.length;
  for (let i = 0; i < n; i += 1) {
    const card = hand[i];
    const slotX = L.hand.x + (i - (n - 1) / 2) * L.hand.gap - L.hand.w / 2;
    const slotY = L.hand.y;
    const stagger = Math.min(1, Math.max(0, (fx.deal - i * 0.08) / 0.6));
    const e = easeOut(stagger);
    const fromX = 1180;
    const fromY = 640;
    const x = fromX + (slotX - fromX) * e;
    const y = fromY + (slotY - fromY) * e;
    const fan = (i - (n - 1) / 2) * 0.035;
    const affordable = card.cost <= state.player.ember && !state.player.playedThisTurn;
    const hover = ui.hover === i;
    ctx.save();
    ctx.translate(x + L.hand.w / 2, y + L.hand.h / 2);
    ctx.rotate(fan);
    ctx.translate(-L.hand.w / 2, -L.hand.h / 2);
    drawCardFace(ctx, card, 0, 0, L.hand.w, L.hand.h, {
      lift: hover || ui.selected === i ? 26 : 0,
      dim: !affordable,
      selected: ui.selected === i,
    });
    if (ui.guided === i) {
      ctx.strokeStyle = '#ffd23d';
      ctx.lineWidth = 4;
      ctx.setLineDash([10, 6]);
      rr(ctx, -6, -6, L.hand.w + 12, L.hand.h + 12, 16);
      ctx.stroke();
    }
    ctx.restore();
  }
  // Keyboard hints ride on the cards themselves: the key number is the card's
  // position in the hand, and the hint line below the table says so.
  // End Turn button.
  const canEnd = !state.player.playedThisTurn || true;
  drawButton(ctx, L.endTurn.x, L.endTurn.y, L.endTurn.w, L.endTurn.h, state.player.playedThisTurn ? 'END TURN ✓' : 'END TURN', canEnd, ui.hoverEnd);
  // One-line hint.
  ctx.save();
  ctx.fillStyle = 'rgba(247,239,220,0.9)';
  ctx.font = '15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Play a card, then End Turn  ·  1-5 play  ·  Enter ends turn  ·  M mutes  ·  R restarts', LAYOUT.hint.x, LAYOUT.hint.y);
  ctx.restore();
}

function drawFloaters(ctx, fx) {
  for (const f of fx.floaters) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, f.life));
    ctx.font = `bold ${f.crit ? 44 : 34}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    const y = f.y - (1 - f.life) * 70;
    ctx.strokeText(f.text, f.x, y);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, y);
    ctx.restore();
  }
}

function drawConfetti(ctx, fx) {
  for (const c of fx.confetti) {
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(c.rot);
    ctx.fillStyle = c.color;
    ctx.fillRect(-c.size / 2, -c.size / 4, c.size, c.size / 2);
    ctx.restore();
  }
}

function drawOverlay(ctx, title, titleColor, lines, buttonText) {
  ctx.save();
  ctx.fillStyle = 'rgba(8,16,10,0.72)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = titleColor;
  ctx.font = 'bold 84px system-ui, sans-serif';
  ctx.fillText(title, 640, 250);
  ctx.fillStyle = '#f7efdc';
  ctx.font = '22px system-ui, sans-serif';
  lines.forEach((line, i) => ctx.fillText(line, 640, 310 + i * 34));
  drawButton(ctx, LAYOUT.bigButton.x - LAYOUT.bigButton.w / 2, LAYOUT.bigButton.y, LAYOUT.bigButton.w, LAYOUT.bigButton.h, buttonText, true, false);
  ctx.fillStyle = 'rgba(247,239,220,0.75)';
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillText('Press Enter to continue', 640, LAYOUT.bigButton.y + 96);
  ctx.restore();
}

// ---- Screens ----------------------------------------------------------------

function drawTitleScreen(ctx, state) {
  drawTable(ctx);
  // The dark band sits behind the title; the fan of cards sits below it, so
  // the subtitle never crosses a card top.
  ctx.save();
  ctx.fillStyle = 'rgba(8,16,10,0.55)';
  ctx.fillRect(0, 96, VIEW_W, 130);
  ctx.restore();
  // A fan of decorative cards behind the title.
  const suits = ['flame', 'tide', 'stone', 'gale'];
  for (let i = 0; i < 4; i += 1) {
    ctx.save();
    ctx.translate(640 + (i - 1.5) * 120, 340);
    ctx.rotate((i - 1.5) * 0.12);
    drawCardFace(ctx, { suit: suits[i], name: ['Wildfire', 'Maelstrom', 'Avalanche', 'Tempest'][i], cost: 3, value: 6 + i }, -75, -105, 150, 210);
    ctx.restore();
  }
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd23d';
  ctx.font = 'bold 92px system-ui, sans-serif';
  ctx.fillText('EMBER PACT', 640, 178);
  ctx.fillStyle = '#f7efdc';
  ctx.font = '24px system-ui, sans-serif';
  ctx.fillText('A duel of ember-mages', 640, 214);
  ctx.restore();
  drawButton(ctx, LAYOUT.playButton.x - LAYOUT.playButton.w / 2, LAYOUT.playButton.y, LAYOUT.playButton.w, LAYOUT.playButton.h, '▶  PLAY', true, false);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f7efdc';
  ctx.font = '18px system-ui, sans-serif';
  ctx.fillText('Play one card a turn. Two of the same suit in a row triggers its combo.', 640, 500);
  ctx.fillText('Flame burns, Tide heals, Stone shields, Gale draws. First to 0 life loses.', 640, 528);
  ctx.fillStyle = '#ffd23d';
  ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.fillText(`Duel 1: ${state.foeName}, the ${state.foeTitle} — ${state.foe.life} life, slow embers. Win in about 2 minutes.`, 640, 580);
  ctx.fillStyle = 'rgba(247,239,220,0.7)';
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillText('Mouse or keys 1-5 to play · Enter ends turn · M mutes · R restarts', 640, 640);
  ctx.restore();
}

function drawPlayScreen(ctx, state, fx, ui) {
  drawTable(ctx);
  drawFoeArea(ctx, state);
  drawIntent(ctx, state);
  drawPlayed(ctx, state, fx);
  drawComboBanner(ctx, state, fx);
  drawPlayerArea(ctx, state, ui);
  drawFloaters(ctx, fx);
  if (fx.flash > 0) {
    ctx.save();
    ctx.fillStyle = `rgba(255,210,61,${fx.flash * 0.5})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.restore();
  }
}

function drawWinScreen(ctx, state, fx) {
  drawPlayScreen(ctx, state, fx, { hover: -1, hoverEnd: false, guided: -1 });
  drawConfetti(ctx, fx);
  drawOverlay(ctx, 'VICTORY', '#ffd23d', [
    `You ${state.player.life}  —  ${state.foeName} 0`,
    `Duel ${state.level} won in ${state.turn} turns.`,
    `Next duel: ${state.foeName} returns stronger.`,
  ], 'NEXT DUEL ▶');
}

function drawLossScreen(ctx, state, fx) {
  drawPlayScreen(ctx, state, fx, { hover: -1, hoverEnd: false, guided: -1 });
  drawOverlay(ctx, 'DEFEAT', '#ff5a3c', [
    lossLine(state),
    `You fell on turn ${state.turn}.`,
    'The pact is not broken. Rematch and take it back.',
  ], 'REMATCH ↻');
}

// ---- Entry point ------------------------------------------------------------

/** Draw one frame. `screen` is title/play/win/loss; `ui` carries hover state. */
export function draw(ctx, state, screen, fx, ui) {
  ctx.save();
  if (fx.shake > 0) {
    ctx.translate((Math.random() - 0.5) * fx.shake, (Math.random() - 0.5) * fx.shake);
  }
  if (screen === SCREEN_TITLE) drawTitleScreen(ctx, state);
  else if (screen === SCREEN_WIN) drawWinScreen(ctx, state, fx);
  else if (screen === SCREEN_LOSS) drawLossScreen(ctx, state, fx);
  else drawPlayScreen(ctx, state, fx, ui);
  ctx.restore();
}
