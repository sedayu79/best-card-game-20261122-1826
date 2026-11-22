// The pure rules of Ember Pact: no canvas, no sound, no DOM. A duel is a plain
// state object; every function below takes it, changes it, and returns the list of
// events the table should show (damage pops, combo banners, draws, the win).
// The same module drives the live game, the headless tests and the screenshot
// scenes, so what the screenshots show is what the rules really do.
import { buildDeck, comboOf, comboTextOf, SUIT_KEYS } from './cards.js';
import { makeRng, shuffle } from './random.js';

export const HAND_SIZE = 5;
export const MAX_EMBER = 10;
export const CRIT_CHANCE = 0.1;

export const FOES = [
  { name: 'Ghor', title: 'Ember Pup', life: 20, emberDivisor: 2, smart: false },
  { name: 'Ghor', title: 'Ember Wolf', life: 30, emberDivisor: 1, smart: false },
  { name: 'Ghor', title: 'Ember Lord', life: 35, emberDivisor: 1, smart: true },
  { name: 'Ghor', title: 'Ember King', life: 40, emberDivisor: 1, smart: true },
];

function newSide(life, rng) {
  return {
    life,
    maxLife: life,
    shield: 0,
    ember: 0,
    deck: shuffle(buildDeck(), rng),
    discard: [],
    hand: [],
    lastSuit: null,
    playedThisTurn: false,
  };
}

/** Start a duel at the given difficulty level (1 is the quick first win). */
export function createDuel(level, seed) {
  const rng = makeRng(seed);
  const foeSpec = FOES[Math.min(level, FOES.length) - 1];
  const state = {
    level,
    foeName: foeSpec.name,
    foeTitle: foeSpec.title,
    seed,
    rng,
    turn: 0,
    phase: 'play',
    player: newSide(30, rng),
    foe: newSide(foeSpec.life, rng),
    intent: null,
    lastPlayedPlayer: null,
    lastPlayedFoe: null,
    comboBanner: null,
    winner: null,
    loserLifeLeft: 0,
    log: [],
  };
  beginPlayerTurn(state);
  return state;
}

/** Ember income for a side on a turn: 1 on turn 1, +1 each turn, up to 10. */
export function emberForTurn(turn, divisor) {
  return Math.min(MAX_EMBER, Math.max(1, Math.ceil(turn / divisor)));
}

/** Draw `n` cards, reshuffling the discard pile when the deck runs dry. */
export function drawCards(side, n, events, rng) {
  let drawn = 0;
  for (let i = 0; i < n; i += 1) {
    if (side.deck.length === 0) {
      if (side.discard.length === 0) break;
      side.deck = shuffle(side.discard, rng);
      side.discard = [];
      events.push({ type: 'reshuffle' });
    }
    side.hand.push(side.deck.pop());
    drawn += 1;
  }
  return drawn;
}

/** Draw cards until the side holds HAND_SIZE, reshuffling the discard pile first. */
export function drawUpTo(side, events, rng) {
  drawCards(side, HAND_SIZE - side.hand.length, events, rng);
}

function note(state, text) {
  state.log.push(text);
  if (state.log.length > 8) state.log.shift();
}

/** Open the player's turn: fresh embers, a full hand, and the foe's intent. */
export function beginPlayerTurn(state) {
  const events = [];
  state.turn += 1;
  const player = state.player;
  const foe = state.foe;
  player.ember = emberForTurn(state.turn, 1);
  player.playedThisTurn = false;
  drawUpTo(player, events, state.rng);
  state.intent = planFoeCard(state);
  note(state, `Turn ${state.turn}: ${player.ember} embers.`);
  return events;
}

/** The foe's readable rule: highest damage, unless its life is low, then it
 *  heals or shields. Never random, never hidden: the plan becomes the intent
 *  banner the player sees before the foe acts. */
export function planFoeCard(state) {
  const foe = state.foe;
  const spec = FOES[Math.min(state.level, FOES.length) - 1];
  const ember = emberForTurn(state.turn, spec.emberDivisor);
  const affordable = foe.hand.filter((c) => c.cost <= ember);
  if (affordable.length === 0) return null;
  const lowLife = foe.life <= 10;
  const hurt = foe.life <= foe.maxLife * 0.5;
  let pool = affordable;
  if (lowLife) {
    const tide = affordable.filter((c) => c.suit === 'tide');
    if (tide.length > 0) pool = tide;
  } else if (hurt) {
    const stone = affordable.filter((c) => c.suit === 'stone');
    if (stone.length > 0) pool = stone;
  }
  if (spec.smart && foe.lastSuit) {
    const same = pool.filter((c) => c.suit === foe.lastSuit);
    if (same.length > 0) pool = same;
  }
  let best = pool[0];
  for (const card of pool) {
    if (card.value > best.value || (card.value === best.value && card.cost < best.cost)) best = card;
  }
  return best;
}

/** Cards in the player's hand the player can afford right now. */
export function affordableHand(state) {
  return state.player.hand
    .map((card, index) => ({ card, index }))
    .filter(({ card }) => card.cost <= state.player.ember && !state.player.playedThisTurn);
}

function dealDamage(state, attacker, defender, card, events, isFoe) {
  let damage = card.value;
  const crit = state.rng() < CRIT_CHANCE;
  if (crit) damage *= 2;
  const absorbed = Math.min(defender.shield, damage);
  defender.shield -= absorbed;
  const dealt = damage - absorbed;
  defender.life = Math.max(0, defender.life - dealt);
  events.push({
    type: 'damage',
    amount: dealt,
    absorbed,
    crit,
    raw: damage,
    target: isFoe ? 'player' : 'foe',
    suit: card.suit,
  });
  return dealt;
}

function applyCombo(state, side, other, card, events, isFoe) {
  const combo = comboOf(card.suit);
  const banner = `${card.suit.toUpperCase()} COMBO! ${comboTextOf(card.suit)}`;
  state.comboBanner = { suit: card.suit, text: banner };
  if (combo === 'burn') {
    other.life = Math.max(0, other.life - 2);
    events.push({ type: 'burn', amount: 2, target: isFoe ? 'player' : 'foe', suit: card.suit });
  } else if (combo === 'heal') {
    side.life = Math.min(side.maxLife, side.life + 3);
    events.push({ type: 'heal', amount: 3, target: isFoe ? 'foe' : 'player', suit: card.suit });
  } else if (combo === 'shield') {
    side.shield += 4;
    events.push({ type: 'shield', amount: 4, target: isFoe ? 'foe' : 'player', suit: card.suit });
  } else if (combo === 'draw') {
    const drawn = drawCards(side, 2, events, state.rng);
    events.push({ type: 'draw', amount: drawn, target: isFoe ? 'foe' : 'player', suit: card.suit });
  }
  events.push({ type: 'combo', suit: card.suit, text: banner });
}

/** Resolve one card played by `side` against `other`. Shared by player and foe. */
function resolvePlay(state, side, other, card, events, isFoe) {
  side.ember -= card.cost;
  side.discard.push(card);
  const combo = side.lastSuit === card.suit;
  side.lastSuit = card.suit;
  side.playedThisTurn = true;
  dealDamage(state, side, other, card, events, isFoe);
  // The banner shows the latest combo until the next card is played without
  // one, so it is still on the table when the next turn opens.
  if (combo) applyCombo(state, side, other, card, events, isFoe);
  else state.comboBanner = null;
  if (isFoe) state.lastPlayedFoe = card;
  else state.lastPlayedPlayer = card;
  note(state, `${isFoe ? state.foeName : 'You'} played ${card.name} (${card.value}).`);
  checkEnd(state, events);
  return events;
}

/** The player plays the card at `index` in their hand. Returns events, or an
 *  error event when the play is not legal. */
export function playPlayerCard(state, index) {
  const events = [];
  if (state.phase !== 'play') return [{ type: 'error', text: 'The duel is over.' }];
  if (state.player.playedThisTurn) return [{ type: 'error', text: 'One card a turn. End your turn.' }];
  const card = state.player.hand[index];
  if (!card) return [{ type: 'error', text: 'No card there.' }];
  if (card.cost > state.player.ember) {
    return [{ type: 'error', text: `Need ${card.cost} embers, you have ${state.player.ember}.` }];
  }
  state.player.hand.splice(index, 1);
  return resolvePlay(state, state.player, state.foe, card, events, false);
}

/** End the player's turn: the foe plays its telegraphed card, then a new turn. */
export function endPlayerTurn(state) {
  const events = [];
  if (state.phase !== 'play') return events;
  const foe = state.foe;
  const spec = FOES[Math.min(state.level, FOES.length) - 1];
  foe.ember = emberForTurn(state.turn, spec.emberDivisor);
  foe.playedThisTurn = false;
  drawUpTo(foe, events, state.rng);
  let card = state.intent;
  if (!card || !foe.hand.includes(card) || card.cost > foe.ember) card = planFoeCard(state);
  if (card) {
    foe.hand.splice(foe.hand.indexOf(card), 1);
    resolvePlay(state, foe, state.player, card, events, true);
  } else {
    note(state, `${state.foeName} passes, out of embers.`);
    events.push({ type: 'pass', target: 'foe' });
  }
  if (state.phase === 'play') beginPlayerTurn(state);
  return events;
}

function checkEnd(state, events) {
  if (state.foe.life <= 0 && state.player.life <= 0) {
    state.phase = 'win';
    state.winner = 'player';
    state.loserLifeLeft = 0;
  } else if (state.foe.life <= 0) {
    state.phase = 'win';
    state.winner = 'player';
    state.loserLifeLeft = state.player.life;
  } else if (state.player.life <= 0) {
    state.phase = 'loss';
    state.winner = 'foe';
    state.loserLifeLeft = state.foe.life;
  }
  if (state.phase === 'win' || state.phase === 'loss') {
    events.push({ type: state.phase, loserLifeLeft: state.loserLifeLeft });
  }
}

/** How close the loss was, for the defeat screen's near-miss line. */
export function lossLine(state) {
  const left = state.foe.life;
  if (left <= 3) return `${state.foeName} survived with ${left} life — one more round.`;
  if (left <= 8) return `${state.foeName} survived with ${left} life — so close.`;
  return `${state.foeName} survived with ${left} life. Rematch and take it back.`;
}

/** Every suit key, for the renderer and the tests. */
export function allSuits() {
  return SUIT_KEYS.slice();
}
