/** Retour haptique léger (Chrome Android). Sans effet ailleurs. */
export const tap = (ms = 8) => { if (typeof navigator !== "undefined") navigator.vibrate?.(ms); };
export const celebrate = () => { if (typeof navigator !== "undefined") navigator.vibrate?.([12, 40, 12, 40, 30]); };
