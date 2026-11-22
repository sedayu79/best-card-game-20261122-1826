// All sound in Ember Pact is synthesised with WebAudio: no audio files, no
// network. Short envelopes on plain oscillators give the deal tick, the play
// thock, the damage thud, the win arpeggio and the loss descent.
let ctx = null;
let muted = false;

export function isMuted() {
  return muted;
}

export function toggleMute() {
  muted = !muted;
  return muted;
}

function audio() {
  if (muted) return null;
  try {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** One short tone: frequency, seconds, shape and loudness. */
function tone(freq, dur, type, gain, when = 0, slideTo = null) {
  const ac = audio();
  if (!ac) return;
  const t0 = ac.currentTime + when;
  const osc = ac.createOscillator();
  const amp = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  amp.gain.setValueAtTime(0.0001, t0);
  amp.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(amp);
  amp.connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

/** A soft tick as a card slides into the hand. */
export function playDeal() {
  tone(880, 0.06, 'triangle', 0.12);
}

/** The snap of a card landing on the table. */
export function playThock() {
  tone(180, 0.09, 'square', 0.16, 0, 90);
}

/** A low thud when damage lands; harder when it is a critical hit. */
export function playThud(crit) {
  tone(110, 0.16, 'sine', 0.28, 0, 55);
  if (crit) tone(1320, 0.12, 'triangle', 0.14, 0.02, 1760);
}

/** A soft chime when a card heals or a shield rises. */
export function playChime() {
  tone(660, 0.14, 'sine', 0.12);
  tone(990, 0.18, 'sine', 0.1, 0.07);
}

/** A click for buttons and the end-turn press. */
export function playClick() {
  tone(520, 0.05, 'triangle', 0.1);
}

/** A dull buzz when a play is not legal. */
export function playError() {
  tone(140, 0.12, 'sawtooth', 0.1, 0, 110);
}

/** The win lands with a rising arpeggio. */
export function playWin() {
  const notes = [523, 659, 784, 1047, 1319];
  notes.forEach((freq, i) => tone(freq, 0.34, 'triangle', 0.16, i * 0.11));
}

/** The loss descends. */
export function playLoss() {
  const notes = [392, 330, 262, 196];
  notes.forEach((freq, i) => tone(freq, 0.4, 'sine', 0.14, i * 0.14));
}
