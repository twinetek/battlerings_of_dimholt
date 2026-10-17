// Hex grid math, independent of the game. Axial coordinates (q, r) with
// pointy-top hexes; the third cube coordinate is s = -q - r.
// Reference: https://www.redblobgames.com/grids/hexagons/
//
// A board is any set of hex keys ("q,r"). Movement and pathfinding take a
// passable(hex) callback, so callers decide what blocks (walls, pillars,
// other fighters).

export const key = h => `${h.q},${h.r}`;
export function fromKey(k) {
  const [q, r] = k.split(',').map(Number);
  return { q, r };
}

export const DIRECTIONS = [
  { q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 },
  { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 },
];

export const add = (a, b) => ({ q: a.q + b.q, r: a.r + b.r });
export const equal = (a, b) => a.q === b.q && a.r === b.r;
export const neighbors = h => DIRECTIONS.map(d => add(h, d));

export function distance(a, b) {
  return (Math.abs(a.q - b.q) + Math.abs(a.r - b.r) + Math.abs(a.q + a.r - b.q - b.r)) / 2;
}

export const adjacent = (a, b) => distance(a, b) === 1;

// Every hex within `radius` steps of the center: a hexagon-shaped board.
export function hexagon(radius, center = { q: 0, r: 0 }) {
  const out = [];
  for (let q = -radius; q <= radius; q++) {
    for (let r = Math.max(-radius, -q - radius); r <= Math.min(radius, -q + radius); r++) {
      out.push({ q: center.q + q, r: center.r + r });
    }
  }
  return out;
}

// Pixel center of a hex, for hexes `size` px from center to corner.
export function toPixel(h, size) {
  return { x: size * Math.sqrt(3) * (h.q + h.r / 2), y: size * 1.5 * h.r };
}

export function corners(center, size) {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 180) * (60 * i - 30);
    return { x: center.x + size * Math.cos(a), y: center.y + size * Math.sin(a) };
  });
}

// Breadth-first flood from `start`: every hex reachable in at most `steps`
// moves, as a Map of key -> steps taken. The start is included at 0.
export function reachable(start, steps, passable) {
  const seen = new Map([[key(start), 0]]);
  let frontier = [start];
  for (let d = 1; d <= steps; d++) {
    const next = [];
    for (const h of frontier) {
      for (const n of neighbors(h)) {
        const k = key(n);
        if (seen.has(k) || !passable(n)) continue;
        seen.set(k, d);
        next.push(n);
      }
    }
    frontier = next;
  }
  return seen;
}

// Shortest path from start to the first hex where done(hex) is true, moving
// only through passable hexes. Returns the hexes after start, or null.
export function pathTo(start, done, passable, limit = 200) {
  if (done(start)) return [];
  const came = new Map([[key(start), null]]);
  let frontier = [start];
  for (let step = 0; step < limit && frontier.length; step++) {
    const next = [];
    for (const h of frontier) {
      for (const n of neighbors(h)) {
        const k = key(n);
        if (came.has(k) || !passable(n)) continue;
        came.set(k, h);
        if (done(n)) {
          const path = [n];
          for (let p = h; p && !equal(p, start); p = came.get(key(p))) path.unshift(p);
          return path;
        }
        next.push(n);
      }
    }
    frontier = next;
  }
  return null;
}

export const pathToHex = (start, goal, passable) => pathTo(start, h => equal(h, goal), passable);
export const pathToAdjacent = (start, target, passable) => pathTo(start, h => adjacent(h, target), passable);
