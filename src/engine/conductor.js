import { clamp } from "./math.js";

/**
 * Plays beat changes as atomic, timed moves. Scroll only sets the *target*
 * beat; the conductor walks the shown beat toward it one move at a time.
 * A move in progress always finishes - sped up when the target is already
 * further on, reversed in place if the reader scrolls back.
 */
export function createConductor(duration = 1.1) {
  const c = { from: -1, to: -1, t: 1, settledAt: 0 };
  c.tick = (target, dt, now) => {
    const dir = Math.sign(c.to - c.from);
    if (c.t < 1 && dir && (target - c.from) * dir <= 0) {
      // reader went back past where this move started: run it in reverse
      [c.from, c.to] = [c.to, c.from];
      c.t = 1 - c.t;
    }
    if (c.t >= 1 && c.to !== target) {
      c.from = c.to;
      c.to += Math.sign(target - c.to);
      c.t = 0;
    }
    if (c.t < 1) {
      const ahead = Math.max(0, (target - c.to) * Math.sign(c.to - c.from));
      c.t = Math.min(1, c.t + (dt / duration) * (1 + ahead * 1.6));
      if (c.t >= 1) c.settledAt = now;
    }
    return c;
  };
  /** How present beat k's overlays should be right now. */
  c.presence = (k) => {
    if (c.t >= 1) return c.to === k ? 1 : 0;
    if (k === c.from) return 1 - clamp(c.t / 0.35);
    if (k === c.to) return clamp((c.t - 0.65) / 0.35);
    return 0;
  };
  /** Seconds-based progress of beat k's "arrival" flourishes (0→1). */
  c.arrival = (k, now, secs = 1) => (c.to === k && c.t >= 1 ? clamp((now - c.settledAt) / 1000 / secs) : c.from === k ? 1 : 0);
  return c;
}
