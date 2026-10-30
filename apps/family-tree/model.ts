import { households, people, type Person } from "./data";

export type Member = Person & { generation: number };
export type Relation = "parent" | "partner" | "sibling" | "custom";
export type Connection = { id: string; source: string; target: string; type: Relation; label: string };
export type FamilyMap = { version: 2; title: string; people: Member[]; edges: Connection[]; portraits: Record<string, string> };
export const MAP_KEY = "winden-family-map-v2";
export const CARD_W = 140, CARD_H = 176;
export const relationNames: Record<Relation, string> = { parent: "Parent of", partner: "Partner", sibling: "Sibling", custom: "Connection" };
export function initialMap(): FamilyMap {
  return { version: 2, title: "Winden · Family connections", people: people.map(p => ({ ...p, generation: p.role === "Parent" ? 0 : 1 })), portraits: {}, edges: Object.values(households).flatMap(h => [
    { id: `${h.parents[0]}-${h.parents[1]}`, source: h.parents[0], target: h.parents[1], type: "partner" as const, label: "Partner" },
    ...h.parents.flatMap(source => h.children.map(target => ({ id: `${source}-${target}`, source, target, type: "parent" as const, label: "Parent of" }))),
  ]) };
}
export function validateMap(value: unknown): FamilyMap {
  const m = value as FamilyMap;
  if (!m || m.version !== 2 || typeof m.title !== "string" || !Array.isArray(m.people) || !Array.isArray(m.edges) || !m.portraits || typeof m.portraits !== "object") throw new Error("Invalid map");
  const ids = new Set<string>();
  for (const p of m.people) {
    if (!p || typeof p.id !== "string" || ids.has(p.id) || typeof p.name !== "string" || !p.name.trim() || typeof p.family !== "string" || !p.family.trim() || typeof p.description !== "string" || !Number.isInteger(p.generation) || p.generation < 0 || p.generation > 9) throw new Error("Invalid person");
    ids.add(p.id);
  }
  const edges = new Set<string>();
  for (const e of m.edges) {
    if (!e || typeof e.id !== "string" || edges.has(e.id) || !ids.has(e.source) || !ids.has(e.target) || e.source === e.target || !Object.hasOwn(relationNames, e.type) || typeof e.label !== "string") throw new Error("Invalid connection");
    edges.add(e.id);
  }
  return { ...m, portraits: Object.fromEntries(Object.entries(m.portraits).filter(([id, src]) => ids.has(id) && typeof src === "string" && src.startsWith("data:image/jpeg;base64,"))) };
}
export function connectionError(edges: Connection[], edge: Connection): string {
  if (edge.source === edge.target) return "Choose two different people.";
  if (edges.some(e => e.id !== edge.id && e.type === edge.type && e.label.toLowerCase() === edge.label.toLowerCase() && ((e.source === edge.source && e.target === edge.target) || (edge.type !== "parent" && e.source === edge.target && e.target === edge.source)))) return "That connection already exists.";
  return "";
}

export type Node = { person: Member; x: number; y: number };
export function layoutMap(people: Member[]) {
  const families = [...new Set(people.map(p => p.family))];
  const nodes: Node[] = [];
  const groups: { family: string; x: number; width: number }[] = [];
  let offset = 60;
  for (const family of families) {
    const members = people.filter(p => p.family === family);
    const generations = [...new Set(members.map(p => p.generation))].sort((a, b) => a - b);
    const width = Math.max(400, ...generations.map(g => members.filter(p => p.generation === g).length * 190 + 40));
    groups.push({ family, x: offset, width });
    for (const g of generations) {
      const row = members.filter(p => p.generation === g);
      row.forEach((person, i) => nodes.push({ person, x: offset + (width - (row.length * 190 - 50)) / 2 + i * 190, y: 70 + g * 270 }));
    }
    offset += width + 80;
  }
  return { nodes, groups, width: Math.max(560, offset - 20), height: Math.max(490, ...nodes.map(n => n.y + CARD_H + 80)) };
}
export function edgeGeometry(edge: Connection, nodes: Node[], lane = 0) {
  const a = nodes.find(n => n.person.id === edge.source), b = nodes.find(n => n.person.id === edge.target);
  if (!a || !b) return null;
  const crossFamily = a.person.family !== b.person.family;
  if (crossFamily || a.y === b.y || b.y < a.y) {
    const x1 = a.x + CARD_W / 2, x2 = b.x + CARD_W / 2;
    const y = Math.min(a.y, b.y) - 20 - (lane % 5) * 8;
    return { d: `M ${x1} ${a.y} V ${y} H ${x2} V ${b.y}`, x: (x1 + x2) / 2, y: y - 7, crossFamily };
  }
  const x1 = a.x + CARD_W / 2, x2 = b.x + CARD_W / 2, y1 = a.y + CARD_H, y2 = b.y;
  const middle = y1 + (y2 - y1) * (.4 + (lane % 3) * .1);
  return { d: `M ${x1} ${y1} V ${middle} H ${x2} V ${y2}`, x: (x1 + x2) / 2, y: middle - 7, crossFamily };
}

const escape = (value: string) => value.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!);
function wrap(value: string, limit: number) {
  const lines: string[] = []; let current = "";
  for (const word of value.split(/\s+/)) {
    if ((current + " " + word).trim().length > limit && current) { lines.push(current); current = ""; }
    if (word.length > limit) { if (current) { lines.push(current); current = ""; } for (let i = 0; i < word.length; i += limit) lines.push(word.slice(i, i + limit)); }
    else current = (current + " " + word).trim();
  }
  if (current) lines.push(current);
  return lines;
}
/** Self-contained vector export: includes every family, embedded portraits and an edge register. */
export function mapSvg(map: FamilyMap) {
  const layout = layoutMap(map.people);
  const width = Math.max(900, layout.width + 80);
  const rows = map.edges.map(e => ({ e, lines: wrap(`${map.people.find(p => p.id === e.source)?.name} — ${e.label} ${e.type === "parent" ? "→" : "↔"} ${map.people.find(p => p.id === e.target)?.name}`, Math.floor((width - 130) / 8)) }));
  const height = layout.height + 210 + rows.reduce((sum, row) => sum + Math.max(28, row.lines.length * 19 + 9), 0);
  const text = (x: number, y: number, value: string, size = 13, fill = "#dedfcf", anchor = "start") => `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" text-anchor="${anchor}">${escape(value)}</text>`;
  const edgeMarkup = map.edges.map((edge, index) => { const g = edgeGeometry(edge, layout.nodes, index); return g ? `<path d="${g.d}" fill="none" stroke="${g.crossFamily ? "#9cbfc2" : "#bca977"}" stroke-width="1.5" ${edge.type === "partner" ? 'stroke-dasharray="5 4"' : ""} ${edge.type === "parent" ? 'marker-end="url(#arrow)"' : ""}/>${text(g.x, g.y, String(index + 1), 11, "#d5c58f", "middle")}` : ""; }).join("");
  const nodes = layout.nodes.map(({ person: p, x, y }, i) => {
    const portrait = map.portraits[p.id];
    const names = wrap(p.name, 19).slice(0, 3);
    return `<g><rect x="${x}" y="${y}" width="${CARD_W}" height="${CARD_H}" rx="4" fill="#1b241a" stroke="#7d8866"/>
      <clipPath id="portrait-${i}"><rect x="${x + 7}" y="${y + 7}" width="126" height="94" rx="2"/></clipPath>
      ${portrait ? `<image href="${escape(portrait)}" x="${x + 7}" y="${y + 7}" width="126" height="94" preserveAspectRatio="xMidYMid slice" clip-path="url(#portrait-${i})"/>` : `<rect x="${x + 7}" y="${y + 7}" width="126" height="94" fill="#2e3928"/><circle cx="${x + 70}" cy="${y + 40}" r="14" fill="none" stroke="#8f9c7e"/><path d="M ${x + 42} ${y + 90} Q ${x + 70} ${y + 38} ${x + 98} ${y + 90}" fill="none" stroke="#8f9c7e"/>`}
      ${names.map((line, j) => text(x + 70, y + 119 + j * 16, line, 12, "#e8e7dd", "middle")).join("")}</g>`;
  }).join("");
  let rowY = layout.height + 155;
  const register = rows.map(({ lines }, i) => { const result = text(45, rowY, `${i + 1}.`, 12, "#bca977") + lines.map((line, j) => text(80, rowY + j * 19, line)).join(""); rowY += Math.max(28, lines.length * 19 + 9); return result; }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escape(map.title)}"><defs><marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0 0L6 3L0 6Z" fill="#bca977"/></marker></defs><rect width="100%" height="100%" fill="#101510"/><g font-family="Arial, sans-serif">${text(40, 42, map.title, 25)}${text(40, 67, `${map.people.length} people · ${layout.groups.length} families · ${map.edges.length} connections`, 12, "#a6b095")}<g transform="translate(20 90)">${layout.groups.map(g => text(g.x + g.width / 2, 15, g.family, 15, "#c9bc91", "middle")).join("")}${edgeMarkup}${nodes}</g>${text(40, layout.height + 123, "CONNECTION REGISTER · Arrow indicates parent → child; other connections are mutual", 12, "#bca977")}${register}</g></svg>`;
}
export function downloadFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob), a = document.createElement("a");
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
export async function exportMap(map: FamilyMap, format: "svg" | "png" | "json") {
  if (format === "json") { downloadFile(new Blob([JSON.stringify(map, null, 2)], { type: "application/json" }), "family-map.json"); return; }
  const svg = mapSvg(map), blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  if (format === "svg") { downloadFile(blob, "family-map.svg"); return; }
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image(); img.src = url; await img.decode();
    const scale = Math.min(2, 8192 / Math.max(img.width, img.height), Math.sqrt(24000000 / (img.width * img.height)));
    const canvas = document.createElement("canvas"); canvas.width = Math.ceil(img.width * scale); canvas.height = Math.ceil(img.height * scale);
    const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("Canvas unavailable");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const png = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error("PNG failed")), "image/png"));
    downloadFile(png, "family-map.png");
  } finally { URL.revokeObjectURL(url); }
}
