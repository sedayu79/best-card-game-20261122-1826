// The screenshot scenes behind ?shot=title|play|win|loss&seed=N. Each one plays
// the real rules forward from a fresh duel for a fixed number of steps, steered
// by a simple autopilot, so the frame is what a short game really looks like
// and the same seed always gives the same frame. The Pillow renderer replays
// these same scenes from the same seeds.
import { createDuel, endPlayerTurn, playPlayerCard } from './rules.js';
import { SCREEN_LOSS, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

export const SHOT_NAMES = ['title', 'play', 'win', 'loss'];

/** The player's autopilot: the best affordable card, or the weakest one. */
function autopilotPlay(state, weakest) {
  const hand = state.player.hand;
  let best = -1;
  for (let i = 0; i < hand.length; i += 1) {
    const card = hand[i];
    if (card.cost > state.player.ember) continue;
    if (best === -1) { best = i; continue; }
    const better = weakest
      ? card.value < hand[best].value
      : card.value > hand[best].value;
    if (better) best = i;
  }
  if (best === -1) return;
  playPlayerCard(state, best);
}

/** One full round: the player plays, then the foe answers. */
function playRound(state, weakest) {
  if (state.phase !== 'play') return;
  autopilotPlay(state, weakest);
  if (state.phase !== 'play') return;
  endPlayerTurn(state);
}

/**
 * Set `state` to the named scene and return the screen to draw. The state is
 * created fresh by the caller at the given level and seed; this only plays it
 * forward. Any other name is the title.
 */
export function stageShot(name, state) {
  if (name === 'play') {
    for (let round = 0; round < 3; round += 1) playRound(state, false);
    // Mid-turn on turn 4: the hand is full again and both last-played cards
    // are still on the table. Only play when no combo banner is showing yet,
    // so the banner is earned by this turn's play instead.
    if (state.phase === 'play' && !state.comboBanner) {
      let pick = -1;
      for (let i = 0; i < state.player.hand.length; i += 1) {
        const card = state.player.hand[i];
        if (card.cost <= state.player.ember && card.suit === state.player.lastSuit) { pick = i; break; }
      }
      if (pick === -1) {
        let best = -1;
        for (let i = 0; i < state.player.hand.length; i += 1) {
          const card = state.player.hand[i];
          if (card.cost > state.player.ember) continue;
          if (best === -1 || card.value > state.player.hand[best].value) best = i;
        }
        pick = best;
      }
      if (pick !== -1) playPlayerCard(state, pick);
    }
    return { screen: SCREEN_PLAY, state };
  }
  if (name === 'win') {
    for (let round = 0; round < 60 && state.phase === 'play'; round += 1) playRound(state, false);
    return { screen: state.phase === 'win' ? SCREEN_WIN : SCREEN_PLAY, state };
  }
  if (name === 'loss') {
    for (let round = 0; round < 60 && state.phase === 'play'; round += 1) playRound(state, true);
    return { screen: state.phase === 'loss' ? SCREEN_LOSS : SCREEN_PLAY, state };
  }
  return { screen: SCREEN_TITLE, state };
}
