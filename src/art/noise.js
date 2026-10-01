/**
 * 1-D value noise: a lattice of seeded randoms, smoothly interpolated with
 * a cubic Hermite (smoothstep) curve. fbm() sums three octaves - each at
 * roughly double the frequency and half the weight of the last - into
 * fractal Brownian motion: smooth at large scale, detailed up close.
 */
export function valueNoise(seed = 1234567) {
  const lattice = new Float32Array(1024);
  let s = seed;
  for (let i = 0; i < lattice.length; i++) lattice[i] = (s = (s * 16807) % 2147483647) / 2147483647;

  const noise = (x) => {
    const i = Math.floor(x);
    const f = x - i;
    const a = lattice[i & 1023];
    const b = lattice[(i + 1) & 1023];
    return a + (b - a) * f * f * (3 - 2 * f);
  };

  const fbm = (x) => noise(x) * 0.55 + noise(x * 2.07 + 17) * 0.3 + noise(x * 4.3 + 41) * 0.15;

  return { noise, fbm };
}

export const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
