// Synthetic vital-sign waveforms for the monitor. No recordings: each
// heartbeat is built from a handful of Gaussian bumps, the same idea as the
// McSharry ECG model, evaluated at a phase θ that runs 0 → 1 once per beat.

/** The five deflections of one beat: P, Q, R, S, T (centre, height, width). */
export const WAVES = [
  { name: "P", at: 0.2, a: 0.12, w: 0.025 },
  { name: "Q", at: 0.37, a: -0.14, w: 0.01 },
  { name: "R", at: 0.4, a: 1.0, w: 0.012 },
  { name: "S", at: 0.43, a: -0.24, w: 0.012 },
  { name: "T", at: 0.66, a: 0.3, w: 0.05 },
];

const bump = (θ, { at, a, w }) => a * Math.exp(-((θ - at) ** 2) / (2 * w * w));

/** ECG lead II at beat phase θ ∈ [0, 1). */
export const ecg = (θ) => WAVES.reduce((sum, wave) => sum + bump(θ, wave), 0);

/** Pulse-oximetry pleth: a systolic rise and a smaller dicrotic wave,
 *  arriving a little after the R wave (the pulse has to travel). */
export const pleth = (θ) => {
  const t = (θ + 0.42) % 1;
  return 0.9 * Math.exp(-((t - 0.25) ** 2) / 0.008) + 0.35 * Math.exp(-((t - 0.48) ** 2) / 0.01);
};

/**
 * Advance a beat phase by dt seconds at heart rate `hr`, with a little
 * respiratory sinus arrhythmia: the heart speeds up slightly on each breath
 * in and slows on each breath out, the way a real one does.
 */
export function advance(phase, dt, hr, time, rr = 14) {
  const breath = Math.sin((time * rr * Math.PI * 2) / 60);
  return (phase + (dt * hr * (1 + 0.04 * breath)) / 60) % 1;
}
