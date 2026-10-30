"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { connectionError, relationNames, type Connection, type FamilyMap, type Member, type Relation } from "./model";

export function Modal({ title, close, children }: { title: string; close: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => dialog?.close(); }, []);
  return <dialog ref={ref} className="ft-dialog" aria-label={title} onCancel={e => { e.preventDefault(); close(); }} onClick={e => { if (e.target === e.currentTarget) close(); }}>
    <div className="ft-dialog-inner"><header><h2>{title}</h2><button type="button" aria-label="Close dialog" onClick={close}><X size={17} /></button></header>{children}</div>
  </dialog>;
}

export function PersonForm({ person, family, families, save, close }: { person?: Member; family: string; families: string[]; save: (p: Member) => void; close: () => void }) {
  const [draft, setDraft] = useState<Member>(person ?? { id: crypto.randomUUID(), name: "", family, generation: 1, description: "", role: "" });
  const [error, setError] = useState("");
  return <Modal title={person ? "Edit person" : "Add person"} close={close}><form onSubmit={e => { e.preventDefault(); if (!draft.name.trim() || !draft.family.trim()) { setError("Enter a name and family."); return; } save({ ...draft, name: draft.name.trim(), family: draft.family.trim(), description: draft.description.trim() }); }}>
    <label>Name<input aria-label="Name" autoFocus required maxLength={50} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} /></label>
    <label>Family<input aria-label="Family" required list="ft-family-options" maxLength={40} value={draft.family} onChange={e => setDraft({ ...draft, family: e.target.value })} /><datalist id="ft-family-options">{families.map(f => <option key={f} value={f} />)}</datalist></label>
    <p className="ft-form-hint">Choose an existing family or enter a new one.</p>
    <label>Generation<select aria-label="Generation" value={draft.generation} onChange={e => setDraft({ ...draft, generation: Number(e.target.value) })}>{Array.from({ length: 10 }, (_, i) => <option key={i} value={i}>Generation {i + 1}{i === 0 ? " · top row" : ""}</option>)}</select></label>
    <label>Description<textarea aria-label="Description" rows={3} maxLength={1000} value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} /></label>
    <p className="ft-form-hint">Generation sets the map row. Connections are added separately.</p>
    {error && <p role="alert">{error}</p>}<div className="ft-form-actions"><button type="button" onClick={close}>Cancel</button><button className="ft-primary" type="submit">Save person</button></div>
  </form></Modal>;
}

export function ConnectionForm({ map, connection, source, save, close }: { map: FamilyMap; connection?: Connection; source: string; save: (e: Connection) => void; close: () => void }) {
  const [draft, setDraft] = useState<Connection>(connection ?? { id: crypto.randomUUID(), source, target: map.people.find(p => p.id !== source && p.family !== map.people.find(n => n.id === source)?.family)?.id ?? map.people.find(p => p.id !== source)?.id ?? "", type: "partner", label: "Partner" });
  const [filter, setFilter] = useState("");
  const [error, setError] = useState("");
  return <Modal title={connection ? "Edit connection" : "Add connection"} close={close}><form onSubmit={e => {
    e.preventDefault();
    const edge = { ...draft, label: draft.type === "custom" ? draft.label.trim() : relationNames[draft.type] };
    const problem = connectionError(map.edges, edge);
    if (problem || !edge.source || !edge.target || !edge.label) { setError(problem || "Choose both people and enter a relationship label."); return; }
    save(edge);
  }}>
    <label>From person<select aria-label="From person" value={draft.source} onChange={e => { const source = e.target.value; setDraft({ ...draft, source, target: draft.target === source ? "" : draft.target }); }}>{map.people.map(p => <option key={p.id} value={p.id}>{p.name} · {p.family}</option>)}</select></label>
    <label>Target family<select aria-label="Target family" value={filter} onChange={e => { setFilter(e.target.value); setDraft({ ...draft, target: "" }); }}><option value="">All families</option>{[...new Set(map.people.map(p => p.family))].map(f => <option key={f}>{f}</option>)}</select></label>
    <label>To person<select aria-label="To person" required value={draft.target} onChange={e => setDraft({ ...draft, target: e.target.value })}><option value="">Choose a person</option>{map.people.filter(p => p.id !== draft.source && (!filter || p.family === filter)).map(p => <option key={p.id} value={p.id}>{p.name} · {p.family}</option>)}</select></label>
    <label>Relationship<select aria-label="Relationship" value={draft.type} onChange={e => { const type = e.target.value as Relation; setDraft({ ...draft, type, label: relationNames[type] }); }}>{Object.entries(relationNames).map(([type, name]) => <option key={type} value={type}>{name}</option>)}</select></label>
    {draft.type === "custom" && <label>Connection label<input aria-label="Connection label" required maxLength={60} value={draft.label} onChange={e => setDraft({ ...draft, label: e.target.value })} /></label>}
    <p className="ft-form-hint">{draft.type === "parent" ? "Direction: From person is a parent of To person. The arrow points to the child." : "This is a mutual connection between the two people."} Connections can span any families.</p>
    {error && <p role="alert" className="ft-error">{error}</p>}<div className="ft-form-actions"><button type="button" onClick={close}>Cancel</button><button className="ft-primary" type="submit">Save connection</button></div>
  </form></Modal>;
}


