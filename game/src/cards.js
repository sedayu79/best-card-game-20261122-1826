// The cards of Ember Pact: four elements, told apart by colour AND shape, never
// by text alone. Each card has a suit, an ember cost, a damage value and a name.
// A deck holds ten cards of each suit, forty in all.
export const SUITS = {
  flame: { key: 'flame', name: 'Flame', color: '#e8491d', light: '#ff8a3d', dark: '#8f1d05', combo: 'burn', comboText: '+2 burn' },
  tide: { key: 'tide', name: 'Tide', color: '#2b7de9', light: '#6db3ff', dark: '#0d3f8f', combo: 'heal', comboText: 'heal 3' },
  stone: { key: 'stone', name: 'Stone', color: '#8a7d6b', light: '#c2b49b', dark: '#4d4234', combo: 'shield', comboText: '+4 shield' },
  gale: { key: 'gale', name: 'Gale', color: '#3fae5a', light: '#7ddb8f', dark: '#175c2b', combo: 'draw', comboText: 'draw 2' },
};
export const SUIT_KEYS = ['flame', 'tide', 'stone', 'gale'];

// Ten cards per suit: three cheap sparks, three mid-weight strikes, two heavy
// blows, one crusher and one finisher. Cost and value climb together.
const SUIT_CARDS = [
  { cost: 1, value: 2 },
  { cost: 1, value: 2 },
  { cost: 1, value: 3 },
  { cost: 2, value: 4 },
  { cost: 2, value: 4 },
  { cost: 2, value: 5 },
  { cost: 3, value: 6 },
  { cost: 3, value: 7 },
  { cost: 4, value: 8 },
  { cost: 5, value: 10 },
];

const NAMES = {
  flame: ['Spark', 'Cinder', 'Kindling', 'Ember Fang', 'Pyre Lash', 'Flame Tongue', 'Wildfire', 'Inferno', 'Dragon Breath', 'Sunfall'],
  tide: ['Droplet', 'Ripple', 'Stream', 'Undertow', 'Tide Pull', 'Wave Crest', 'Deep Current', 'Maelstrom', 'Floodgate', 'Ocean Roar'],
  stone: ['Pebble', 'Shard', 'Boulder', 'Granite Fist', 'Mountain', 'Quake', 'Bedrock', 'Avalanche', 'Titan Step', 'Worldstone'],
  gale: ['Breeze', 'Gust', 'Zephyr', 'Wind Shear', 'Gale Force', 'Storm Front', 'Cyclone', 'Tempest', 'Sky Breaker', 'Storm Eye'],
};

let nextId = 1;

/** Build one fresh card of the given suit from the tier at `index`. */
export function makeCard(suitKey, index) {
  const tier = SUIT_CARDS[index % SUIT_CARDS.length];
  return {
    id: nextId,
    suit: suitKey,
    name: NAMES[suitKey][index % NAMES[suitKey].length],
    cost: tier.cost,
    value: tier.value,
  };
}

/** A fresh forty-card deck, unshuffled; the caller shuffles it with a seeded rng. */
export function buildDeck() {
  nextId = 1;
  const deck = [];
  for (const suit of SUIT_KEYS) {
    for (let i = 0; i < SUIT_CARDS.length; i += 1) {
      nextId += 1;
      deck.push(makeCard(suit, i));
    }
  }
  return deck;
}

/** The combo bonus a suit grants when two of its cards are played in a row. */
export function comboOf(suitKey) {
  return SUITS[suitKey].combo;
}

/** Human text for a suit's combo, shown on the combo banner. */
export function comboTextOf(suitKey) {
  return SUITS[suitKey].comboText;
}
