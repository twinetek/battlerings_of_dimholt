// Dice and randomness. Every random number in the game goes through here, so
// tests can swap in a seeded generator with setRng(seeded(1234)).

let rng = Math.random;

export function setRng(fn) { rng = fn; }
export const random = () => rng();

// Mulberry32: small, fast, seedable PRNG.
export function seeded(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function die(sides) { return 1 + Math.floor(rng() * sides); }

const DICE_RE = /^(\d*)d(\d+)([+-]\d+)?$/;

// "2d4+1" -> { n: 2, sides: 4, mod: 1 }. Plain numbers are allowed too.
export function parse(spec) {
  if (typeof spec === 'number') return { n: 0, sides: 0, mod: spec };
  const text = String(spec).replace(/\s+/g, '');
  const m = DICE_RE.exec(text);
  if (m) return { n: m[1] === '' ? 1 : Number(m[1]), sides: Number(m[2]), mod: m[3] ? Number(m[3]) : 0 };
  const k = Number(text);
  if (Number.isFinite(k)) return { n: 0, sides: 0, mod: k };
  throw new Error(`Bad dice spec: ${spec}`);
}

export function roll(spec) {
  const { n, sides, mod } = parse(spec);
  let total = mod;
  for (let i = 0; i < n; i++) total += die(sides);
  return total;
}

export function span(spec, bonus = 0) {
  const { n, sides, mod } = parse(spec);
  return { min: Math.max(1, n + mod + bonus), max: Math.max(1, n * sides + mod + bonus) };
}

// Range text in the style of the original game: "2-8".
export function rangeText(spec, bonus = 0) {
  const { min, max } = span(spec, bonus);
  return min === max ? `${min}` : `${min}-${max}`;
}

export function average(spec) {
  const { n, sides, mod } = parse(spec);
  return n * (sides + 1) / 2 + mod;
}
