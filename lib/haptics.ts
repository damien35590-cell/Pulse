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
