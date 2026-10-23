/** Retour haptique léger (Chrome Android). Sans effet ailleurs. */
export const tap = (ms = 8) => { if (typeof navigator !== "undefined") navigator.vibrate?.(ms); };
/** Fin de repos : vibration longue. */
export const restOver = () => { if (typeof navigator !== "undefined") navigator.vibrate?.([200, 100, 200, 100, 400]); };
/** Petit bip (WebAudio). Peut être refusé tant que la page n'a reçu aucun geste : sans effet alors. */
export function beep(times = 3) {
  try {
    const C = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext, ctx = new C();
    for (let i = 0; i < times; i++) {
      const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime + i * 0.25;
      o.frequency.value = 880; g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + 0.2);
    }
    setTimeout(() => ctx.close(), times * 250 + 300);
  } catch { /* son indisponible */ }
}
export const celebrate = () => { if (typeof navigator !== "undefined") navigator.vibrate?.([12, 40, 12, 40, 30]); };
/** Petit carillon montant (WebAudio) : plus le palier est haut, plus il y a de notes. Sans effet si le son est bloqué. */
export function chime(tier = 1) {
  try {
    const C = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext, ctx = new C();
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5].slice(0, Math.min(5, tier + 1));
    notes.forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime + i * 0.09;
      o.type = "triangle"; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18, t + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + 0.55);
    });
    setTimeout(() => ctx.close(), notes.length * 90 + 700);
  } catch { /* son indisponible */ }
}
/** Coup de tampon : vibration sèche. */
export const stamp = () => { if (typeof navigator !== "undefined") navigator.vibrate?.([40, 30, 15]); };
