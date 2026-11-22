// Stage one screenshot scene through the real rules and print its state as
// JSON, for the Pillow renderer. Usage: node tools/dump_shot.mjs play 7
import { createDuel, lossLine } from '../game/src/rules.js';
import { stageShot } from '../game/src/shots.js';

const name = process.argv[2] || 'title';
const seed = Number(process.argv[3] || '7') || 7;
const level = name === 'loss' ? 3 : 1;
let state = createDuel(level, seed);
const staged = stageShot(name, state);
state = staged.state;

const pick = (side) => ({
  life: side.life,
  maxLife: side.maxLife,
  shield: side.shield,
  ember: side.ember,
  deck: side.deck.length,
  discard: side.discard.length,
  hand: side.hand.map((c) => ({ suit: c.suit, name: c.name, cost: c.cost, value: c.value })),
});

console.log(JSON.stringify({
  screen: staged.screen,
  level: state.level,
  turn: state.turn,
  foeName: state.foeName,
  foeTitle: state.foeTitle,
  player: pick(state.player),
  foe: pick(state.foe),
  intent: state.intent ? { suit: state.intent.suit } : null,
  lastPlayedPlayer: state.lastPlayedPlayer,
  lastPlayedFoe: state.lastPlayedFoe,
  comboBanner: state.comboBanner,
  lossLine: state.phase === 'loss' ? lossLine(state) : null,
}));
