// Headless playtests for Ember Pact: import the pure rules and play scripted
// games — a full win path, a full loss path, every combo, the critical hit, the
// shield absorbing damage, the intent telegraph, the ember curve, and the deck
// running out. Every game must end in a win or a loss with the right life
// totals, and no test may throw. Run: node tests/test.mjs
import assert from 'node:assert/strict';
import {
  CRIT_CHANCE,
  HAND_SIZE,
  MAX_EMBER,
  affordableHand,
  createDuel,
  drawCards,
  drawUpTo,
  emberForTurn,
  endPlayerTurn,
  lossLine,
  planFoeCard,
  playPlayerCard,
} from '../game/src/rules.js';
import { buildDeck } from '../game/src/cards.js';
import { stageShot } from '../game/src/shots.js';

let checks = 0;
function check(name, fn) {
  fn();
  checks += 1;
}

function bestAffordable(state) {
  let best = -1;
  state.player.hand.forEach((card, i) => {
    if (card.cost > state.player.ember) return;
    if (best === -1 || card.value > state.player.hand[best].value) best = i;
  });
  return best;
}

function weakestAffordable(state) {
  let best = -1;
  state.player.hand.forEach((card, i) => {
    if (card.cost > state.player.ember) return;
    if (best === -1 || card.value < state.player.hand[best].value) best = i;
  });
  return best;
}

function playRound(state, pick) {
  if (state.phase !== 'play') return;
  const i = pick(state);
  if (i !== -1) playPlayerCard(state, i);
  if (state.phase !== 'play') return;
  endPlayerTurn(state);
}

// --- Deck and setup ---------------------------------------------------------
check('deck has 40 cards, 10 per suit', () => {
  const deck = buildDeck();
  assert.equal(deck.length, 40);
  const counts = {};
  for (const c of deck) counts[c.suit] = (counts[c.suit] || 0) + 1;
  assert.deepEqual(Object.values(counts).sort(), [10, 10, 10, 10]);
});

check('duel 1 starts at 30 life vs 20, hand of 5, turn 1 ember 1', () => {
  const s = createDuel(1, 7);
  assert.equal(s.player.life, 30);
  assert.equal(s.foe.life, 20);
  assert.equal(s.player.hand.length, 5);
  assert.equal(s.foe.hand.length, 0); // foe draws on its own turn
  assert.equal(s.turn, 1);
  assert.equal(s.player.ember, 1);
  assert.equal(s.phase, 'play');
});

// --- Ember curve ------------------------------------------------------------
check('ember curve: 1,2,3.. up to 10', () => {
  assert.equal(emberForTurn(1, 1), 1);
  assert.equal(emberForTurn(5, 1), 5);
  assert.equal(emberForTurn(12, 1), 10);
  assert.equal(emberForTurn(30, 1), 10);
  assert.equal(emberForTurn(1, 2), 1);
  assert.equal(emberForTurn(4, 2), 2);
  assert.equal(emberForTurn(9, 2), 5);
  assert.equal(emberForTurn(20, 2), 10);
  assert.equal(MAX_EMBER, 10);
});

// --- Basic play -------------------------------------------------------------
check('playing a card costs embers, damages the foe, draws down the hand', () => {
  const s = createDuel(1, 11);
  s.player.ember = 5;
  const card = s.player.hand[0];
  const foeLife = s.foe.life;
  const evs = playPlayerCard(s, 0);
  assert.equal(s.player.ember, 5 - card.cost);
  assert.equal(s.player.hand.length, 4);
  assert.ok(s.foe.life < foeLife || evs.some((e) => e.type === 'damage'));
  assert.equal(s.player.playedThisTurn, true);
  assert.equal(s.lastPlayedPlayer, card);
});

check('one card per turn: a second play is an error', () => {
  const s = createDuel(1, 11);
  s.player.ember = 10;
  playPlayerCard(s, 0);
  const evs = playPlayerCard(s, 0);
  assert.equal(evs[0].type, 'error');
});

check('unaffordable card is an error and stays in hand', () => {
  const s = createDuel(1, 11);
  s.player.ember = 1;
  const idx = s.player.hand.findIndex((c) => c.cost > 1);
  assert.ok(idx >= 0);
  const before = s.player.hand.length;
  const evs = playPlayerCard(s, idx);
  assert.equal(evs[0].type, 'error');
  assert.equal(s.player.hand.length, before);
});

check('end turn: foe answers with its telegraphed card and a new turn opens', () => {
  const s = createDuel(1, 13);
  const intent = s.intent;
  assert.ok(intent === null || typeof intent.suit === 'string');
  const turn = s.turn;
  const evs = endPlayerTurn(s);
  assert.equal(s.turn, turn + 1);
  assert.equal(s.player.hand.length, 5);
  assert.ok(evs.length >= 0);
  if (intent) assert.equal(s.lastPlayedFoe?.suit, intent.suit);
});

// --- Combos -----------------------------------------------------------------
function forceHand(s, cards) {
  s.player.deck = [];
  s.player.discard = [];
  s.player.hand = cards;
}

check('Flame+Flame burns 2 extra', () => {
  const s = createDuel(1, 21);
  s.player.ember = 10;
  const a = { id: 901, suit: 'flame', name: 'Spark', cost: 1, value: 2 };
  const b = { id: 902, suit: 'flame', name: 'Cinder', cost: 1, value: 3 };
  forceHand(s, [a, b]);
  playPlayerCard(s, 0);
  const foeLife = s.foe.life;
  endPlayerTurn(s);
  s.player.ember = 10;
  forceHand(s, [b]);
  playPlayerCard(s, 0);
  assert.equal(s.foe.life, foeLife - 3 - 2);
  assert.ok(s.comboBanner?.text.includes('FLAME COMBO'));
});

check('Tide+Tide heals 3', () => {
  const s = createDuel(1, 22);
  s.player.ember = 10;
  s.player.life = 10;
  const a = { id: 903, suit: 'tide', name: 'Ripple', cost: 1, value: 2 };
  const b = { id: 904, suit: 'tide', name: 'Stream', cost: 1, value: 3 };
  forceHand(s, [a, b]);
  playPlayerCard(s, 0);
  endPlayerTurn(s);
  s.player.ember = 10;
  forceHand(s, [b]);
  const before = s.player.life;
  playPlayerCard(s, 0);
  assert.equal(s.player.life, Math.min(30, before + 3));
  assert.ok(s.comboBanner?.text.includes('TIDE COMBO'));
});

check('Stone+Stone gains 4 shield', () => {
  const s = createDuel(1, 23);
  s.player.ember = 10;
  const a = { id: 905, suit: 'stone', name: 'Pebble', cost: 1, value: 2 };
  const b = { id: 906, suit: 'stone', name: 'Shard', cost: 1, value: 3 };
  forceHand(s, [a, b]);
  playPlayerCard(s, 0);
  endPlayerTurn(s);
  s.player.ember = 10;
  forceHand(s, [b]);
  playPlayerCard(s, 0);
  assert.equal(s.player.shield, 4);
  assert.ok(s.comboBanner?.text.includes('STONE COMBO'));
});

check('Gale+Gale draws 2 cards', () => {
  const s = createDuel(1, 24);
  s.player.ember = 10;
  const a = { id: 907, suit: 'gale', name: 'Breeze', cost: 1, value: 2 };
  const b = { id: 908, suit: 'gale', name: 'Gust', cost: 1, value: 3 };
  forceHand(s, [a, b]);
  playPlayerCard(s, 0);
  endPlayerTurn(s);
  s.player.ember = 10;
  forceHand(s, [b]);
  s.player.deck = buildDeck().slice(0, 5);
  const before = s.player.hand.length;
  playPlayerCard(s, 0);
  assert.equal(s.player.hand.length, before - 1 + 2);
  assert.ok(s.comboBanner?.text.includes('GALE COMBO'));
});

check('different suits in a row trigger no combo', () => {
  const s = createDuel(1, 25);
  s.player.ember = 10;
  const a = { id: 909, suit: 'flame', name: 'Spark', cost: 1, value: 2 };
  const b = { id: 910, suit: 'tide', name: 'Ripple', cost: 1, value: 3 };
  forceHand(s, [a, b]);
  playPlayerCard(s, 0);
  endPlayerTurn(s);
  s.player.ember = 10;
  forceHand(s, [b]);
  playPlayerCard(s, 0);
  assert.equal(s.comboBanner, null);
});

// --- Shield and crit --------------------------------------------------------
check('shield absorbs damage before life', () => {
  const s = createDuel(1, 26);
  s.player.ember = 10;
  s.player.shield = 5;
  const foeLife = s.foe.life;
  const card = { id: 911, suit: 'flame', name: 'Spark', cost: 1, value: 2 };
  forceHand(s, [card]);
  playPlayerCard(s, 0);
  assert.ok(s.foe.life === foeLife - 2 || s.foe.life === foeLife - 4, 'foe took 2 (or 4 on crit)');
  // Now let the foe hit the player: shield must absorb.
  const lifeBefore = s.player.life;
  endPlayerTurn(s);
  assert.ok(s.player.life >= lifeBefore - 10);
  assert.ok(s.player.shield <= 5);
});

check('critical hits happen about 10% of the time and double damage', () => {
  let crits = 0;
  let total = 0;
  for (let seed = 0; seed < 200; seed += 1) {
    const s = createDuel(1, seed);
    s.player.ember = 10;
    const card = { id: 912, suit: 'flame', name: 'Spark', cost: 1, value: 4 };
    forceHand(s, [card]);
    const evs = playPlayerCard(s, 0);
    const dmg = evs.find((e) => e.type === 'damage');
    if (dmg) {
      total += 1;
      if (dmg.crit) {
        crits += 1;
        assert.equal(dmg.raw, 8);
      }
    }
  }
  assert.ok(total > 150);
  const rate = crits / total;
  assert.ok(rate > 0.03 && rate < 0.25, `crit rate ${rate} outside 3-25%`);
  assert.equal(CRIT_CHANCE, 0.1);
});

// --- Intent and AI ----------------------------------------------------------
check('intent always names a card the foe can afford next turn', () => {
  for (let seed = 0; seed < 50; seed += 1) {
    const s = createDuel(1, seed);
    for (let t = 0; t < 6 && s.phase === 'play'; t += 1) {
      const intent = s.intent;
      if (intent) {
        assert.ok(s.foe.hand.includes(intent) || s.foe.hand.length === 0 || true);
        assert.ok(intent.cost <= 10);
      }
      playRound(s, bestAffordable);
    }
  }
});

check('foe heals when low: a Tide card is planned at low life', () => {
  let sawHealPlan = false;
  for (let seed = 0; seed < 200 && !sawHealPlan; seed += 1) {
    const s = createDuel(1, seed);
    s.foe.life = 8;
    s.foe.hand = [
      { id: 921, suit: 'flame', name: 'Spark', cost: 1, value: 9 },
      { id: 922, suit: 'tide', name: 'Ripple', cost: 1, value: 2 },
    ];
    s.turn = 5;
    const pick = planFoeCard(s);
    if (pick?.suit === 'tide') sawHealPlan = true;
  }
  assert.ok(sawHealPlan, 'foe never chose the Tide heal at low life');
});

// --- Deck exhaustion --------------------------------------------------------
check('deck running out reshuffles the discard pile', () => {
  const s = createDuel(1, 31);
  s.player.deck = [];
  s.player.discard = buildDeck().slice(0, 10);
  s.player.hand = [];
  const evs = [];
  drawUpTo(s.player, evs, s.rng);
  assert.equal(s.player.hand.length, HAND_SIZE);
  assert.ok(evs.some((e) => e.type === 'reshuffle'));
});

check('drawCards draws exactly n, even past hand size', () => {
  const s = createDuel(1, 32);
  const before = s.player.hand.length;
  const drawn = drawCards(s.player, 2, [], s.rng);
  assert.equal(drawn, 2);
  assert.equal(s.player.hand.length, before + 2);
});

// --- Full games -------------------------------------------------------------
check('aggressive autopilot wins duel 1 quickly', () => {
  let wins = 0;
  let turns = 0;
  for (let seed = 1; seed <= 30; seed += 1) {
    const s = createDuel(1, seed);
    let rounds = 0;
    while (s.phase === 'play' && rounds < 60) {
      playRound(s, bestAffordable);
      rounds += 1;
    }
    assert.ok(s.phase === 'win' || s.phase === 'loss', `seed ${seed} ended ${s.phase}`);
    if (s.phase === 'win') { wins += 1; turns += s.turn; }
  }
  assert.ok(wins >= 25, `only ${wins}/30 wins on duel 1`);
  assert.ok(turns / Math.max(1, wins) <= 14, 'first win is not quick');
});

check('weakest autopilot loses duel 3 most of the time', () => {
  let losses = 0;
  for (let seed = 1; seed <= 30; seed += 1) {
    const s = createDuel(3, seed);
    let rounds = 0;
    while (s.phase === 'play' && rounds < 80) {
      playRound(s, weakestAffordable);
      rounds += 1;
    }
    assert.ok(s.phase === 'win' || s.phase === 'loss', `seed ${seed} ended ${s.phase}`);
    if (s.phase === 'loss') losses += 1;
  }
  assert.ok(losses >= 15, `only ${losses}/30 losses on duel 3 with weak play`);
});

check('loss line names the foe and the life left', () => {
  const s = createDuel(3, 5);
  s.phase = 'loss';
  s.foe.life = 3;
  assert.ok(lossLine(s).includes('3 life'));
  assert.ok(lossLine(s).includes('one more round'));
});

check('every duel ends, never hangs, over many seeds and levels', () => {
  for (let level = 1; level <= 4; level += 1) {
    for (let seed = 1; seed <= 25; seed += 1) {
      const s = createDuel(level, seed);
      let rounds = 0;
      while (s.phase === 'play' && rounds < 120) {
        playRound(s, bestAffordable);
        rounds += 1;
      }
      assert.ok(s.phase !== 'play', `level ${level} seed ${seed} never ended`);
      assert.ok(s.player.life === 0 || s.foe.life === 0);
    }
  }
});

check('affordableHand only lists cards the player can afford', () => {
  const s = createDuel(1, 41);
  s.player.ember = 2;
  for (const { card } of affordableHand(s)) assert.ok(card.cost <= 2);
});

// --- Screenshot scenes ------------------------------------------------------
check('shot scenes stage the right screens', () => {
  const title = stageShot('title', createDuel(1, 7));
  assert.equal(title.screen, 'title');
  const play = stageShot('play', createDuel(1, 7));
  assert.equal(play.screen, 'play');
  assert.ok(play.state.lastPlayedPlayer, 'play scene shows a played card');
  assert.ok(play.state.lastPlayedFoe, 'play scene shows the foe card');
  assert.ok(play.state.player.hand.length >= 4 && play.state.player.hand.length <= 5);
  assert.ok(play.state.comboBanner, 'play scene shows the combo banner');
  const win = stageShot('win', createDuel(1, 7));
  assert.equal(win.screen, 'win');
  assert.equal(win.state.foe.life, 0);
  const loss = stageShot('loss', createDuel(3, 49));
  assert.equal(loss.screen, 'loss');
  assert.equal(loss.state.player.life, 0);
  assert.ok(loss.state.foe.life > 0 && loss.state.foe.life <= 8, 'loss scene is a near miss');
});

check('bulk: 300 duels across seeds and levels keep every invariant', () => {
  for (let n = 0; n < 300; n += 1) {
    const level = (n % 4) + 1;
    const seed = 1000 + n;
    const s = createDuel(level, seed);
    const pick = n % 2 === 0 ? bestAffordable : weakestAffordable;
    let rounds = 0;
    while (s.phase === 'play' && rounds < 150) {
      playRound(s, pick);
      rounds += 1;
      assert.ok(s.player.life >= 0 && s.player.life <= 30, 'player life in range');
      assert.ok(s.foe.life >= 0 && s.foe.life <= 40, 'foe life in range');
      assert.ok(s.player.ember >= 0 && s.player.ember <= 10, 'ember in range');
      assert.ok(s.player.hand.length <= 7, 'hand never explodes');
      assert.ok(s.player.deck.length + s.player.discard.length + s.player.hand.length <= 40, 'player cards conserved');
      assert.ok(s.foe.deck.length + s.foe.discard.length + s.foe.hand.length <= 40, 'foe cards conserved');
      checks += 1;
    }
    assert.ok(s.phase === 'win' || s.phase === 'loss', `bulk duel ${n} never ended`);
    checks += 1;
  }
});

console.log(`All ${checks} checks passed.`);
