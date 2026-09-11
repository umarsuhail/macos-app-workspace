"use client";

import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { BarChart3, ChevronLeft, ChevronRight, Command, Files, LayoutDashboard, Maximize2, Menu, Minus, Moon, Search, StickyNote, Sun, X } from "lucide-react";

const Dashboard = lazy(() => import("@/components/apps/Dashboard"));
const Notes = lazy(() => import("@/components/apps/Notes"));
const FilesApp = lazy(() => import("@/components/apps/FilesApp"));
const Analytics = lazy(() => import("@/components/apps/Analytics"));
type AppId = "dashboard" | "notes" | "files" | "analytics";
const apps = {
  dashboard: { name: "Overview", icon: LayoutDashboard, color: "#635bff", component: Dashboard },
  notes: { name: "Notes", icon: StickyNote, color: "#ffb224", component: Notes },
  files: { name: "Files", icon: Files, color: "#38a6ff", component: FilesApp },
  analytics: { name: "Pulse", icon: BarChart3, color: "#ff627d", component: Analytics },
} satisfies Record<AppId, { name: string; icon: typeof LayoutDashboard; color: string; component: typeof Dashboard }>;

function LoadingApp() { return <div className="app-loading" aria-label="Loading app"><span/><span/><span/></div>; }

export default function Home() {
  const [openApps, setOpenApps] = useState<AppId[]>(["dashboard"]);
  const [active, setActive] = useState<AppId>("dashboard");
  const [minimized, setMinimized] = useState<AppId[]>([]);
  const [fullscreen, setFullscreen] = useState(false);
  const [dark, setDark] = useState(false);
  const [launcherOpen, setLauncherOpen] = useState(false);
  const now = useMemo(() => new Intl.DateTimeFormat("en", { weekday: "short", hour: "numeric", minute: "2-digit" }).format(new Date()), []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setLauncherOpen(v => !v); }
      if (event.key === "Escape") setLauncherOpen(false);
    };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, []);
  function launch(id: AppId) {
    setOpenApps(current => current.includes(id) ? current : [...current, id]);
    setMinimized(current => current.filter(item => item !== id)); setActive(id); setLauncherOpen(false);
  }
  function close(id: AppId) {
    const remaining = openApps.filter(item => item !== id); setOpenApps(remaining);
    setMinimized(items => items.filter(item => item !== id));
    if (active === id && remaining.length) setActive(remaining.at(-1)!);
  }
  const ActiveApp = apps[active].component;
  const ActiveIcon = apps[active].icon;
  return (
    <main className={dark ? "desktop dark" : "desktop"}>
      <div className="wallpaper-glow glow-one"/><div className="wallpaper-glow glow-two"/>
      <header className="menu-bar">
        <div className="menu-left"><button className="brand-mark" onClick={() => setLauncherOpen(v => !v)} aria-label="Open app launcher"><Command size={17}/></button><strong>Workspace</strong><span className="menu-link">File</span><span className="menu-link">View</span><span className="menu-link">Window</span></div>
        <div className="menu-right"><button onClick={() => setDark(v => !v)} aria-label="Toggle theme">{dark ? <Sun size={15}/> : <Moon size={15}/>}</button><span>{now}</span><span className="avatar">US</span></div>
      </header>
      <section className={fullscreen ? "window window-full" : "window"} aria-label={`${apps[active].name} window`}>
        <div className="title-bar">
          <div className="traffic-lights"><button className="traffic close" onClick={() => close(active)} aria-label="Close window"><X size={9}/></button><button className="traffic minimize" onClick={() => setMinimized(v => [...new Set([...v, active])])} aria-label="Minimize window"><Minus size={9}/></button><button className="traffic maximize" onClick={() => setFullscreen(v => !v)} aria-label="Maximize window"><Maximize2 size={8}/></button></div>
          <div className="window-history"><button aria-label="Back"><ChevronLeft size={16}/></button><button aria-label="Forward"><ChevronRight size={16}/></button></div>
          <button className="window-title" onClick={() => setLauncherOpen(true)}><span style={{ background: apps[active].color }}><ActiveIcon size={13}/></span>{apps[active].name}</button>
          <button className="mobile-menu" onClick={() => setLauncherOpen(true)} aria-label="Open apps"><Menu size={18}/></button>
        </div>
        {openApps.length && !minimized.includes(active) ? <div className="app-viewport" key={active}><Suspense fallback={<LoadingApp/>}><ActiveApp/></Suspense></div> : <div className="empty-window"><Command size={26}/><h2>No app open</h2><button onClick={() => setLauncherOpen(true)}>Open an app</button></div>}
      </section>
      {launcherOpen && <div className="launcher" role="dialog" aria-label="App launcher"><div className="launcher-search"><Search size={16}/><span>Jump to an app</span><kbd>⌘ K</kbd></div><div className="launcher-grid">{(Object.keys(apps) as AppId[]).map(id => { const app=apps[id], Icon=app.icon; return <button key={id} onClick={() => launch(id)}><span style={{background:app.color}}><Icon size={22}/></span><strong>{app.name}</strong><small>{openApps.includes(id) ? "Running" : "Open"}</small></button>; })}</div></div>}
      <nav className="dock" aria-label="Applications">{(Object.keys(apps) as AppId[]).map(id => { const app=apps[id], Icon=app.icon, isOpen=openApps.includes(id); return <button key={id} className={active===id&&!minimized.includes(id)?"dock-active":""} onClick={() => launch(id)} aria-label={app.name}><span style={{background:app.color}}><Icon size={23}/></span>{isOpen&&<i/>}</button>; })}<div className="dock-divider"/><button onClick={() => setLauncherOpen(v=>!v)} aria-label="All apps"><span className="launchpad"><span/><span/><span/><span/></span></button></nav>
    </main>
  );
}
