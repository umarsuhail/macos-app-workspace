import type { JsonValue as J } from '../types';
export const example = {
  project: 'Clear JSON',
  version: '1.0.0',
  description: 'A little clarity for your data.',
  active: true,
  team: {
    name: 'Design engineering',
    members: [
      { id: 1, name: 'Alex Morgan', role: 'Developer', online: true },
      { id: 2, name: 'Sam Taylor', role: 'Designer', online: false },
    ],
  },
  settings: { theme: 'light', notifications: true, refreshInterval: 30 },
  tags: ['simple', 'readable', 'private'],
  lastUpdated: null,
};
export const kind = (v: J) => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v);
export function analyze(v: J) {
  const counts: Record<string, number> = {
    object: 0,
    array: 0,
    string: 0,
    number: 0,
    boolean: 0,
    null: 0,
  };
  let depth = 0,
    keys = 0;
  function walk(x: J, d: number) {
    counts[kind(x)]++;
    depth = Math.max(depth, d);
    if (x !== null && typeof x === 'object') {
      if (!Array.isArray(x)) keys += Object.keys(x).length;
      Object.values(x).forEach((y) => walk(y, d + 1));
    }
  }
  walk(v, 0);
  return { counts, depth, keys, total: Object.values(counts).reduce((a, b) => a + b, 0) };
}
