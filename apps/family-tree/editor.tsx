"use client";
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { ArrowUpRight, Download, Focus, ImagePlus, Link2, Minus, Move, Pencil, Plus, Search, Trash2, Undo2, UserRound, Workflow, X } from "lucide-react";
import { CARD_H, CARD_W, MAP_KEY, edgeGeometry, exportMap, initialMap, layoutMap, validateMap, type Connection, type FamilyMap, type Member } from "./model";
import { ConnectionForm, Modal, PersonForm } from "./dialogs";
import "./family-tree.css";
import "./editor.css";

type View = { x: number; y: number; zoom: number };
type Dialog = { type: "person"; person?: Member } | { type: "connection"; connection?: Connection } | { type: "delete"; id: string } | { type: "export" } | null;
function Portrait({ person, src }: { person: Member; src?: string }) {
  return <span className="ft-portrait">{src ? /* eslint-disable-next-line @next/next/no-img-element -- locally stored portraits */
    <img src={src} alt={`Portrait of ${person.name}`} /> : <><UserRound strokeWidth={.7} aria-hidden="true" /><span className="ft-portrait-initials">{person.name.split(" ").map(s => s[0]).join("").slice(0, 3)}</span></>}</span>;
}

export default function FamilyTreeEditor() {
  const [map, setMap] = useState<FamilyMap>(initialMap);
  const mapRef = useRef(map);
  const [loaded, setLoaded] = useState(false);
  const [family, setFamily] = useState<string | null>("Nielsen");
  const [selected, setSelected] = useState<string | null>("martha");
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [saved, setSaved] = useState(true);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [history, setHistory] = useState<FamilyMap[]>([]);
  const [exportTitle, setExportTitle] = useState("");
  const [exporting, setExporting] = useState(false);
  const [view, setView] = useState<View>({ x: 0, y: 0, zoom: 1 });
  const viewRef = useRef(view);
  const [panning, setPanning] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const drag = useRef<{ id: number; x: number; y: number; origin: View } | null>(null);
  const uploadSequence = useRef(0);
  const person = map.people.find(p => p.id === selected);
  const families = [...new Set(map.people.map(p => p.family))];
  const visiblePeople = useMemo(() => map.people.filter(p => !family || p.family === family), [map.people, family]);
  const layout = useMemo(() => layoutMap(visiblePeople), [visiblePeople]);
  const visibleIds = new Set(visiblePeople.map(p => p.id));
  const hiddenConnections = map.edges.filter(e => visibleIds.has(e.source) !== visibleIds.has(e.target)).length;
  const connections = map.edges.filter(e => e.source === selected || e.target === selected);
  const related = new Set(connections.flatMap(e => [e.source, e.target]));
  const matches = query.trim() ? map.people.filter(p => p.name.toLowerCase().includes(query.trim().toLowerCase())) : [];

  useEffect(() => {
    try {
      const raw = localStorage.getItem(MAP_KEY);
      const next = raw ? validateMap(JSON.parse(raw)) : initialMap();
      if (!raw) {
        try { const old = JSON.parse(localStorage.getItem("winden-family-portraits-v1") ?? "{}"); next.portraits = validateMap({ ...next, portraits: old }).portraits; } catch { /* Keep the editable map usable if old portrait storage is damaged. */ }
      }
      mapRef.current = next; setMap(next);
      if (!next.people.some(p => p.family === "Nielsen")) setFamily(null);
      if (!next.people.some(p => p.id === "martha")) setSelected(null);
    } catch { setSaved(false); setNotice("Saved data could not be read. The starter map is shown; export it before replacing your saved map."); }
    setLoaded(true);
    return () => { uploadSequence.current++; };
  }, []);

  function persist(next: FamilyMap, message: string) {
    mapRef.current = next; setMap(next);
    try { localStorage.setItem(MAP_KEY, JSON.stringify(next)); setSaved(true); setNotice(message); }
    catch { setSaved(false); setNotice("Changes are in this session only: browser storage is unavailable or full. Export JSON to keep a copy."); }
  }
  function commit(next: FamilyMap, message: string) {
    setHistory(h => [...h.slice(-19), mapRef.current]);
    persist(next, message);
  }
  function undo() {
    const previous = history.at(-1); if (!previous) return;
    uploadSequence.current++;
    setHistory(h => h.slice(0, -1)); persist(previous, "Last change undone."); setFamily(null); setSelected(null);
  }
  const changeView = useCallback((next: View) => { viewRef.current = next; setView(next); }, []);
  const fit = useCallback(() => {
    const stage = stageRef.current; if (!stage) return;
    const zoom = Math.max(.05, Math.min(1.15, (stage.clientWidth - 24) / layout.width, (stage.clientHeight - 24) / layout.height));
    changeView({ x: (stage.clientWidth - layout.width * zoom) / 2, y: (stage.clientHeight - layout.height * zoom) / 2, zoom });
  }, [layout.width, layout.height, changeView]);
  useEffect(() => { const stage = stageRef.current; if (!stage) return; const observer = new ResizeObserver(fit); observer.observe(stage); fit(); return () => observer.disconnect(); }, [fit, family]);
  const zoomAt = useCallback((factor: number, x?: number, y?: number) => {
    const stage = stageRef.current; if (!stage) return;
    const current = viewRef.current, zoom = Math.max(.05, Math.min(2, current.zoom * factor));
    const cx = x ?? stage.clientWidth / 2, cy = y ?? stage.clientHeight / 2;
    changeView({ zoom, x: cx - (cx - current.x) * zoom / current.zoom, y: cy - (cy - current.y) * zoom / current.zoom });
  }, [changeView]);
  useEffect(() => {
    const stage = stageRef.current; if (!stage) return;
    const wheel = (e: WheelEvent) => { e.preventDefault(); const rect = stage.getBoundingClientRect(); zoomAt(Math.exp(-Math.max(-100, Math.min(100, e.deltaY)) * .002), e.clientX - rect.left, e.clientY - rect.top); };
    stage.addEventListener("wheel", wheel, { passive: false }); return () => stage.removeEventListener("wheel", wheel);
  }, [zoomAt]);

  function choosePerson(id: string, reveal = false) { setSelected(id); if (reveal) setFamily(map.people.find(p => p.id === id)?.family ?? null); setQuery(""); }
  function chooseFamily(next: string | null) { setFamily(next); setQuery(""); if (next && person?.family !== next) setSelected(null); }
  function pointerDown(e: PointerEvent<HTMLDivElement>) {
    if (e.button !== 0 || (e.target as Element).closest("button")) return;
    e.currentTarget.focus(); e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, origin: viewRef.current }; setPanning(true);
  }
  function pointerMove(e: PointerEvent<HTMLDivElement>) { const d = drag.current; if (d && d.id === e.pointerId) changeView({ ...d.origin, x: d.origin.x + e.clientX - d.x, y: d.origin.y + e.clientY - d.y }); }
  function endPan() { drag.current = null; setPanning(false); }
  function savePerson(p: Member) {
    const current = mapRef.current;
    commit({ ...current, people: current.people.some(n => n.id === p.id) ? current.people.map(n => n.id === p.id ? p : n) : [...current.people, p] }, "Person saved.");
    setSelected(p.id); setFamily(p.family); setDialog(null);
  }
  function saveConnection(edge: Connection) {
    const current = mapRef.current;
    commit({ ...current, edges: [...current.edges.filter(e => e.id !== edge.id), edge] }, "Connection saved. All families are shown so both endpoints are visible.");
    setFamily(null); setSelected(edge.source); setDialog(null);
  }
  function deletePerson(id: string) {
    uploadSequence.current++;
    const current = mapRef.current, portraits = { ...current.portraits }; delete portraits[id];
    commit({ ...current, people: current.people.filter(p => p.id !== id), edges: current.edges.filter(e => e.source !== id && e.target !== id), portraits }, "Person and their connections deleted. Undo is available.");
    setSelected(null); setFamily(null); setDialog(null);
  }
  async function addPortrait(file?: File) {
    if (!file || !selected) return;
    const id = selected, sequence = ++uploadSequence.current;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 10 * 1024 * 1024) { setNotice("Choose a JPG, PNG, or WebP under 10 MB."); return; }
    try {
      const bitmap = await createImageBitmap(file);
      if (sequence !== uploadSequence.current || !mapRef.current.people.some(p => p.id === id)) { bitmap.close(); return; }
      const canvas = document.createElement("canvas"); canvas.width = 320; canvas.height = 400;
      const ctx = canvas.getContext("2d"); if (!ctx) { bitmap.close(); throw new Error("Canvas unavailable"); }
      const scale = Math.max(320 / bitmap.width, 400 / bitmap.height);
      ctx.fillStyle = "#151b16"; ctx.fillRect(0, 0, 320, 400); ctx.drawImage(bitmap, (320 - bitmap.width * scale) / 2, (400 - bitmap.height * scale) / 2, bitmap.width * scale, bitmap.height * scale); bitmap.close();
      const current = mapRef.current;
      commit({ ...current, portraits: { ...current.portraits, [id]: canvas.toDataURL("image/jpeg", .85) } }, "Portrait saved on this device.");
    } catch { setNotice("This image could not be opened. Try another JPG or PNG."); }
  }
  async function download(format: "svg" | "png" | "json") {
    setExporting(true);
    const next = { ...mapRef.current, title: exportTitle.trim() || "Family connections" };
    try { if (next.title !== mapRef.current.title) commit(next, "Map title saved."); await exportMap(next, format); setDialog(null); setNotice(`${format.toUpperCase()} export prepared with all ${next.people.length} people and ${next.edges.length} connections.`); }
    catch { setNotice("Export failed. Try SVG or JSON for a large map."); }
    finally { setExporting(false); }
  }

  return <div className="family-tree-app ft-editor">
    <header className="ft-header"><div><p className="ft-eyebrow"><Workflow size={13} /> RELATIONAL ATLAS <span>/</span> FAMILY TREE</p><h1>Everything is connected.</h1><p className="ft-intro">Build the connections. Tell the whole story.</p></div>
      <div className="ft-search-wrap"><label className="ft-search"><Search size={15} /><input aria-label="Search characters" placeholder="Find a person…" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === "Escape") setQuery(""); if (e.key === "Enter" && matches[0]) choosePerson(matches[0].id, true); }} />{query && <button aria-label="Clear search" onClick={() => setQuery("")}><X size={13} /></button>}</label>
        {query.trim() && <div className="ft-search-results">{matches.length ? matches.map(p => <button key={p.id} onClick={() => choosePerson(p.id, true)}>{p.name}<ArrowUpRight size={13} /></button>) : <p>No characters found.</p>}</div>}
      </div>
    </header>
    <div className="ft-edit-toolbar"><button disabled={!loaded} onClick={() => setDialog({ type: "person" })}><Plus size={14} /> Add person</button><button disabled={!loaded || map.people.length < 2} onClick={() => setDialog({ type: "connection" })}><Link2 size={14} /> Add connection</button><button disabled={!history.length} onClick={undo} title="Undo last change"><Undo2 size={14} /> Undo</button><button className="ft-export-button" disabled={!loaded} onClick={() => { setExportTitle(map.title); setDialog({ type: "export" }); }}><Download size={14} /> Export map</button></div>
    <nav className="ft-families" aria-label="Choose family"><button aria-pressed={!family} onClick={() => chooseFamily(null)}>All families<span>{map.people.length}</span></button>{families.map(f => <button key={f} aria-pressed={family === f} onClick={() => chooseFamily(f)}>{f}<span>{map.people.filter(p => p.family === f).length}</span></button>)}</nav>
    <div className={`ft-body${person ? " ft-has-selection" : ""}`}>
      <section className="ft-map" aria-label="Family map"><div className="ft-map-heading"><span>{family ? `${family.toUpperCase()} FAMILY` : "ALL FAMILY CONNECTIONS"}</span>{hiddenConnections > 0 && <button onClick={() => chooseFamily(null)}>Show {hiddenConnections} cross-family connections <ArrowUpRight size={11} /></button>}</div>
        <div ref={stageRef} className={`ft-stage${panning ? " is-panning" : ""}`} tabIndex={0} aria-label="Interactive family tree. Drag to pan, scroll to zoom. Arrow keys pan; plus and minus zoom; Home fits the tree." onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={endPan} onPointerCancel={endPan} onLostPointerCapture={endPan} onKeyDown={e => {
          if (e.target !== e.currentTarget) return;
          const offsets: Record<string, [number, number]> = { ArrowLeft: [40, 0], ArrowRight: [-40, 0], ArrowUp: [0, 40], ArrowDown: [0, -40] };
          if (offsets[e.key]) { e.preventDefault(); changeView({ ...viewRef.current, x: viewRef.current.x + offsets[e.key][0], y: viewRef.current.y + offsets[e.key][1] }); }
          if (["Home", "+", "=", "-"].includes(e.key)) { e.preventDefault(); if (e.key === "Home") fit(); else zoomAt(e.key === "-" ? 1 / 1.2 : 1.2); }
        }}>
          {!visiblePeople.length && <div className="ft-empty"><UserRound size={30} /><h2>Start a new branch.</h2><p>Add a person, then connect them to your map.</p><button onClick={() => setDialog({ type: "person" })}>Add person</button></div>}
          <div className="ft-world" style={{ width: layout.width, height: layout.height, transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})` }}>
            {layout.groups.map(g => <div key={g.family} className="ft-family-caption" style={{ left: g.x, width: g.width }}>{g.family}</div>)}
            <svg className="ft-links ft-edit-links" width={layout.width} height={layout.height} aria-hidden="true"><defs><marker id="ft-parent-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0 0L6 3L0 6Z" style={{ fill: "#bca977", stroke: "none" }} /></marker></defs>{map.edges.map((edge, i) => { const g = edgeGeometry(edge, layout.nodes, i); return g ? <g key={edge.id} className={`${g.crossFamily ? "ft-cross-family" : ""}${edge.source === selected || edge.target === selected ? " ft-active-edge" : ""}`}><path d={g.d} className={edge.type === "partner" ? "ft-partner-line" : ""} markerEnd={edge.type === "parent" ? "url(#ft-parent-arrow)" : undefined} /><text x={g.x} y={g.y} textAnchor="middle">{i + 1}</text><title>{[map.people.find(p => p.id === edge.source)?.name, edge.label, map.people.find(p => p.id === edge.target)?.name].join(" — ")}</title></g> : null; })}</svg>
            {layout.nodes.map(({ person: p, x, y }) => <button key={p.id} className={`ft-person${p.id === selected ? " is-selected" : ""}${related.has(p.id) ? " is-related" : ""}`} style={{ left: x, top: y, width: CARD_W, height: CARD_H }} aria-label={`View ${p.name}`} aria-pressed={p.id === selected} onClick={() => choosePerson(p.id)}><Portrait person={p} src={map.portraits[p.id]} /><strong>{p.name}</strong><small>{p.family}</small>{p.id === selected && <span className="ft-node-dot" />}</button>)}
          </div>
        </div>
        <footer className="ft-map-footer"><div className="ft-legend"><span /><small>Parent → child</small><span className="ft-cross-legend" /><small>Across families</small></div><div className="ft-zoom"><button aria-label="Zoom out" onClick={() => zoomAt(1 / 1.2)}><Minus size={14} /></button><output aria-label="Zoom level">{Math.round(view.zoom * 100)}%</output><button aria-label="Zoom in" onClick={() => zoomAt(1.2)}><Plus size={14} /></button><button aria-label="Fit tree" onClick={fit}><Focus size={15} /></button></div></footer><div className="ft-map-hint"><Move size={11} /> Drag to explore · Scroll to zoom · Select a person to edit</div>
      </section>
      {person && <aside className="ft-inspector" aria-label="Character details"><div className="ft-inspector-heading"><span>PERSON FILE</span><button aria-label="Close character details" onClick={() => setSelected(null)}><X size={15} /></button></div>
        <div className="ft-person-actions"><button onClick={() => setDialog({ type: "person", person })}><Pencil size={13} /> Edit person</button><button className="ft-danger" aria-label="Delete person" onClick={() => setDialog({ type: "delete", id: person.id })}><Trash2 size={13} /></button></div>
        <div className="ft-detail-portrait"><Portrait person={person} src={map.portraits[person.id]} /><span>{map.portraits[person.id] ? "PORTRAIT" : "IMAGE PLACEHOLDER"}</span></div>
        <div className="ft-detail-copy"><p className="ft-eyebrow">{person.family} FAMILY · GENERATION {person.generation + 1}</p><h2>{person.name}</h2><p>{person.description || "Add a description using Edit person."}</p></div>
        <button className="ft-upload" onClick={() => uploadRef.current?.click()}><ImagePlus size={14} />{map.portraits[person.id] ? "Replace portrait" : "Add portrait"}</button><input ref={uploadRef} hidden type="file" accept="image/jpeg,image/png,image/webp" aria-label="Upload character portrait" onChange={e => { void addPortrait(e.target.files?.[0]); e.target.value = ""; }} />
        {map.portraits[person.id] && <button className="ft-remove" onClick={() => { uploadSequence.current++; const portraits = { ...mapRef.current.portraits }; delete portraits[person.id]; commit({ ...mapRef.current, portraits }, "Placeholder restored."); }}>Restore placeholder</button>}<p className="ft-local-note">JPG, PNG, WebP · saved on this device</p>
        <div className="ft-relations"><h3>CONNECTIONS <span>{connections.length}</span></h3><button className="ft-add-link" onClick={() => setDialog({ type: "connection" })} disabled={map.people.length < 2}><Plus size={13} /> Connect to another person</button>{connections.map(edge => { const other = map.people.find(p => p.id === (edge.source === selected ? edge.target : edge.source))!; const label = edge.type === "parent" ? edge.source === selected ? "Child" : "Parent" : edge.label; return <div className="ft-connection-row" key={edge.id}><button className="ft-connection-person" onClick={() => choosePerson(other.id, other.family !== person.family)}><span className="ft-edge-number">{map.edges.indexOf(edge) + 1}</span><span><strong>{other.name}</strong><small>{label} · {other.family}</small></span></button><button aria-label={`Edit connection to ${other.name}`} onClick={() => setDialog({ type: "connection", connection: edge })}><Pencil size={12} /></button><button aria-label={`Delete connection to ${other.name}`} onClick={() => commit({ ...mapRef.current, edges: mapRef.current.edges.filter(e => e.id !== edge.id) }, "Connection deleted. Undo is available.")}><X size={12} /></button></div>; })}</div>
      </aside>}
    </div>
    {notice && <div className="ft-status" role="status">{notice}<button aria-label="Dismiss message" onClick={() => setNotice("")}><X size={12} /></button></div>}
    <footer className="ft-bottom"><span><i /> {saved ? "SAVED ON THIS DEVICE" : "UNSAVED CHANGES"}</span><span>{map.people.length} people · {families.length} families · {map.edges.length} connections</span></footer>
    {dialog?.type === "person" && <PersonForm person={dialog.person} family={family ?? families[0] ?? "New family"} families={families} save={savePerson} close={() => setDialog(null)} />}
    {dialog?.type === "connection" && <ConnectionForm map={map} connection={dialog.connection} source={person?.id ?? map.people[0]?.id ?? ""} save={saveConnection} close={() => setDialog(null)} />}
    {dialog?.type === "delete" && <Modal title="Delete person?" close={() => setDialog(null)}><p>Delete <strong>{map.people.find(p => p.id === dialog.id)?.name}</strong> and their {map.edges.filter(e => e.source === dialog.id || e.target === dialog.id).length} connections? Their portrait will also be removed. You can undo this change.</p><div className="ft-form-actions"><button onClick={() => setDialog(null)}>Cancel</button><button className="ft-danger" onClick={() => deletePerson(dialog.id)}>Delete person and connections</button></div></Modal>}
    {dialog?.type === "export" && <Modal title="Export relational map" close={() => { if (!exporting) setDialog(null); }}><label>Map title<input value={exportTitle} maxLength={100} onChange={e => setExportTitle(e.target.value)} /></label><p className="ft-form-hint">Includes every family, person, portrait, and connection, regardless of the current filter or zoom. SVG and PNG include a numbered connection register.</p><div className="ft-export-options"><button disabled={exporting} onClick={() => void download("svg")}><strong>SVG map</strong><small>Scalable vector · print and design tools</small></button><button disabled={exporting} onClick={() => void download("png")}><strong>PNG image</strong><small>High-resolution image · easy to share</small></button><button disabled={exporting} onClick={() => void download("json")}><strong>JSON data</strong><small>All people, relationships, and portraits</small></button></div>{exporting && <p role="status">Preparing your complete map…</p>}</Modal>}
  </div>;
}

