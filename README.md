[![make.fun](https://make.fun/badge/best-card-game-20261122-1826.svg)](https://make.fun/bounty/best-card-game-20261122-1826)
[![rank](https://make.fun/badge/best-card-game-20261122-1826/sedayu79/best-card-game-20261122-1826/rank.svg)](https://make.fun/bounty/best-card-game-20261122-1826)
[![reward](https://make.fun/badge/best-card-game-20261122-1826/sedayu79/best-card-game-20261122-1826/reward.svg)](https://make.fun/bounty/best-card-game-20261122-1826)

# Ember Pact

A duel of ember-mages: a complete, original card game that runs offline in a
desktop browser from static files. Built for the
[make.fun best card game bounty](https://make.fun/bounty/best-card-game-20261122-1826).

## How to play

Serve `game/` and open it, or just open `game/index.html` in desktop Chrome:

```sh
node serve.ts   # then open http://localhost:8080
```

Each player has 30 life. Each turn you play **one card** from your hand of 5.
Cards cost embers; you gain embers each turn (1 on turn 1, +1 each turn, up to
10). First to reduce the opponent to 0 life wins.

- **Four suits, told apart by colour and shape:** Flame (burn), Tide (heal),
  Stone (shield), Gale (draw).
- **Combos:** play two cards of the same suit in a row to trigger that suit's
  bonus — Flame+Flame burns 2 extra, Tide+Tide heals 3, Stone+Stone gains 4
  shield, Gale+Gale draws 2 cards.
- **Readable opponent:** Ghor shows its intent before it acts
  ("Ghor will play a Flame card"), so you can answer with a shield, a heal,
  or a bigger hit.
- **Quick first win:** the first duel is against a weak Ghor (20 life, slow
  embers), winnable in about 2 minutes. Win and the next duel is stronger.
- **Variable rewards:** a critical hit lands 10% of the time for double damage.

Mouse (click a card, click End Turn) or keyboard (1-5 play a card, Enter ends
the turn, M mutes, R restarts). All sound is synthesised with WebAudio; all
art is drawn in code.

## Layout

- `game/` — the playable game: `index.html` plus one ES module per job
  (`rules.js` the pure rules, `cards.js` the deck, `render.js` the canvas
  table, `audio.js` the synth, `shots.js` the deterministic scenes,
  `main.js` the bootstrap).
- `screenshots/` — four renders of the game's own code: title, table,
  victory, defeat.
- `main.ts` — the hand-in program: copies `game/` and `screenshots/` to
  `/output` and writes `dossier.json` with the vendored make.fun library.
- `tests/test.mjs` — headless playtests (run with `node tests/test.mjs`).
- `tools/render_shots.py` — renders the screenshots with Pillow from the
  staged scenes (`tools/dump_shot.mjs` stages them through the real rules).

## License

MIT — see [LICENSE](LICENSE).
