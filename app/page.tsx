"use client";

import { Suspense, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { AnimatePresence, motion, useAnimate, useMotionValue, useSpring, useTransform, type MotionValue } from "motion/react";
import { Command, Maximize2, Minus, Moon, Search, Sun, X } from "lucide-react";
import { AppIcon, apps, appsById } from "@/lib/app-registry";

type AppId = string;

type Point = { x: number; y: number };
// dock: offset from the window's centre to its dock icon, used to zoom in from / minimize into the dock
type Win = Point & { w: number; h: number; minimized: boolean; maximized: boolean; dock: Point };
type Drag = { id: AppId; mode: "move" | "resize"; startX: number; startY: number; origin: Win };
const MENU_BAR = 34, MIN_W = 420, MIN_H = 300;
const spring = { type: "spring", stiffness: 380, damping: 34, mass: .9 } as const;
const genie = { type: "spring", stiffness: 260, damping: 30 } as const;

function LoadingApp() { return <div className="app-loading" aria-label="Loading app"><span/><span/><span/></div>; }
const formatTime = () => new Intl.DateTimeFormat("en", { weekday: "short", hour: "numeric", minute: "2-digit" }).format(new Date());

function DockIcon({ mouseX, bounce, iconRef, children, ...props }: { mouseX: MotionValue<number>; bounce?: number; iconRef?: (el: HTMLElement | null) => void; children: React.ReactNode } & Omit<React.ComponentProps<typeof motion.button>, "children">) {
  const [scope, animate] = useAnimate<HTMLButtonElement>();
  const distance = useTransform(mouseX, x => { const box = scope.current?.getBoundingClientRect(); return box ? x - box.x - box.width / 2 : Infinity; });
  const size = useSpring(useTransform(distance, [-150, 0, 150], [48, 74, 48]), { stiffness: 420, damping: 28, mass: .2 });
  useEffect(() => { if (bounce) animate(scope.current, { y: [0, -26, 0, -12, 0] }, { duration: .75, ease: "easeOut" }); }, [bounce, animate, scope]);
  useEffect(() => { iconRef?.(scope.current); });
  return <motion.button ref={scope} style={{ width: size, height: size }} {...props}>{children}</motion.button>;
}

export default function Home() {
  const [windows, setWindows] = useState<Partial<Record<AppId, Win>>>({});
  const [stack, setStack] = useState<AppId[]>([]); // open windows, back to front
  const [focused, setFocused] = useState<AppId | null>(null);
  const [selectedIcon, setSelectedIcon] = useState<AppId | null>(null);
  const [dark, setDark] = useState(false);
  const [launcherOpen, setLauncherOpen] = useState(false);
  const [now, setNow] = useState(formatTime);
  const [viewport, setViewport] = useState({ w: 1440, h: 900 });
  const [dragging, setDragging] = useState(false);
  const [bounces, setBounces] = useState<Partial<Record<AppId, number>>>({});
  const drag = useRef<Drag | null>(null);
  const dockIcons = useRef<Partial<Record<AppId, HTMLElement | null>>>({});
  const windowEls = useRef<Partial<Record<AppId, HTMLElement | null>>>({});
  const dockMouseX = useMotionValue(Infinity);
  useEffect(() => { const timer = setInterval(() => setNow(formatTime()), 15000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    onResize(); window.addEventListener("resize", onResize); return () => window.removeEventListener("resize", onResize);
  }, []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setLauncherOpen(v => !v); }
      if (event.key === "Escape") setLauncherOpen(false);
    };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, []);

  function dockOffset(id: AppId, box: { x: number; y: number; w: number; h: number }): Point {
    const icon = dockIcons.current[id]?.getBoundingClientRect();
    if (!icon) return { x: 0, y: window.innerHeight / 2 };
    return { x: icon.x + icon.width / 2 - (box.x + box.w / 2), y: icon.y + icon.height / 2 - (box.y + box.h / 2) };
  }
  function measured(id: AppId, win: Win) {
    const box = windowEls.current[id]?.getBoundingClientRect();
    return box ? { x: box.x, y: box.y, w: box.width, h: box.height } : win;
  }
  function update(id: AppId, change: (win: Win) => Win) { setWindows(current => current[id] ? { ...current, [id]: change(current[id]) } : current); }
  function focus(id: AppId) { if (focused !== id || stack.at(-1) !== id) { setStack(s => [...s.filter(item => item !== id), id]); setFocused(id); } }
  function nextFocus(exclude: AppId) { return [...stack].reverse().find(id => id !== exclude && windows[id] && !windows[id].minimized) ?? null; }
  function launch(id: AppId) {
    const existing = windows[id];
    if (existing) update(id, win => ({ ...win, minimized: false }));
    else {
      const offset = Object.keys(windows).length * 28;
      const w = Math.min(1040, window.innerWidth - 120), h = Math.min(680, window.innerHeight - 160);
      const x = Math.max(10, (window.innerWidth - w) / 2 - 56 + offset), y = Math.max(MENU_BAR + 10, (window.innerHeight - h) / 2 - 40 + offset);
      setWindows(current => ({ ...current, [id]: { x, y, w, h, minimized: false, maximized: false, dock: dockOffset(id, { x, y, w, h }) } }));
      setBounces(b => ({ ...b, [id]: (b[id] ?? 0) + 1 }));
    }
    setStack(s => [...s.filter(item => item !== id), id]); setFocused(id); setLauncherOpen(false); setSelectedIcon(null);
  }
  function close(id: AppId) {
    setWindows(current => { const next = { ...current }; delete next[id]; return next; });
    setStack(s => s.filter(item => item !== id));
    if (focused === id) setFocused(nextFocus(id));
  }
  function minimize(id: AppId) { update(id, win => ({ ...win, minimized: true, dock: dockOffset(id, measured(id, win)) })); if (focused === id) setFocused(nextFocus(id)); }
  function toggleMaximize(id: AppId) { update(id, win => ({ ...win, maximized: !win.maximized })); focus(id); }

  function startDrag(event: ReactPointerEvent<HTMLElement>, id: AppId, mode: Drag["mode"]) {
    const win = windows[id];
    if (!win || event.button !== 0 || win.maximized || (event.target as HTMLElement).closest("button")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { id, mode, startX: event.clientX, startY: event.clientY, origin: win }; setDragging(true);
  }
  function onDrag(event: ReactPointerEvent<HTMLElement>) {
    const current = drag.current; if (!current) return;
    const dx = event.clientX - current.startX, dy = event.clientY - current.startY, o = current.origin;
    update(current.id, win => current.mode === "move"
      ? { ...win, x: Math.min(Math.max(o.x + dx, 100 - o.w), window.innerWidth - 100), y: Math.min(Math.max(o.y + dy, MENU_BAR), window.innerHeight - 60) }
      : { ...win, w: Math.max(MIN_W, o.w + dx), h: Math.max(MIN_H, o.h + dy) });
  }
  const endDrag = () => { drag.current = null; setDragging(false); };
  const dragHandlers = { onPointerMove: onDrag, onPointerUp: endDrag, onPointerCancel: endDrag };

  return (
    <main className={dark ? "desktop dark" : "desktop"} onPointerDown={event => { if (event.target === event.currentTarget) { setFocused(null); setSelectedIcon(null); setLauncherOpen(false); } }}>
      <div className="wallpaper-glow glow-one"/><div className="wallpaper-glow glow-two"/><div className="wallpaper-glow glow-three"/>
      <header className="menu-bar glass">
        <div className="menu-left"><button className="brand-mark" onClick={() => setLauncherOpen(v => !v)} aria-label="Open app launcher"><Command size={17}/></button><AnimatePresence mode="popLayout" initial={false}><motion.strong key={focused ?? "desktop"} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} transition={{ duration: .16 }}>{focused ? appsById[focused].name : "Workspace"}</motion.strong></AnimatePresence><span className="menu-link">File</span><span className="menu-link">Edit</span><span className="menu-link">View</span><span className="menu-link">Window</span></div>
        <div className="menu-right"><motion.button whileTap={{ scale: .85, rotate: -20 }} onClick={() => setDark(v => !v)} aria-label="Toggle theme">{dark ? <Sun size={15}/> : <Moon size={15}/>}</motion.button><span suppressHydrationWarning>{now}</span><span className="avatar">US</span></div>
      </header>
      <div className="desktop-icons">{apps.map(app => { const id = app.id; return <motion.button key={id} whileTap={{ scale: .94 }} className={selectedIcon === id ? "selected" : ""} onClick={() => { setSelectedIcon(id); setFocused(null); }} onDoubleClick={() => launch(id)} onKeyDown={event => event.key === "Enter" && launch(id)} aria-label={`Open ${app.name}`}><AppIcon app={app}/><small>{app.name}</small></motion.button>; })}</div>
      <div className="window-layer">
        <AnimatePresence>
          {apps.filter(app => windows[app.id]).map(app => {
            const id = app.id, win = windows[id]!, App = app.component;
            const className = ["window", "glass", focused === id && "window-focused", win.maximized && "window-max", win.minimized && "window-min"].filter(Boolean).join(" ");
            const frame = win.maximized ? { left: 8, top: MENU_BAR + 8, width: viewport.w - 16, height: viewport.h - MENU_BAR - 16 } : { left: win.x, top: win.y, width: win.w, height: win.h };
            const intoDock = { x: win.dock.x, y: win.dock.y, scale: .06, opacity: 0, filter: "blur(6px)" };
            return (
              <motion.section key={id} ref={el => { windowEls.current[id] = el; }} className={className} style={{ zIndex: stack.indexOf(id) + 1, transformOrigin: "50% 50%" }}
                initial={{ ...intoDock, ...frame }}
                animate={win.minimized ? { ...intoDock, ...frame, transitionEnd: { visibility: "hidden" } } : { x: 0, y: 0, scale: 1, opacity: 1, filter: "blur(0px)", visibility: "visible", ...frame }}
                exit={{ scale: .9, opacity: 0, filter: "blur(4px)", transition: { duration: .18, ease: [.4, 0, 1, 1] } }}
                transition={{ ...genie, left: dragging ? { duration: 0 } : spring, top: dragging ? { duration: 0 } : spring, width: dragging ? { duration: 0 } : spring, height: dragging ? { duration: 0 } : spring, opacity: { duration: .22 } }}
                onPointerDown={() => focus(id)} aria-label={`${app.name} window`} aria-hidden={win.minimized}>
                <div className="title-bar" onPointerDown={event => startDrag(event, id, "move")} onDoubleClick={event => !(event.target as HTMLElement).closest("button") && toggleMaximize(id)} {...dragHandlers}>
                  <div className="traffic-lights"><button className="traffic close" onClick={() => close(id)} aria-label="Close window"><X size={9}/></button><button className="traffic minimize" onClick={() => minimize(id)} aria-label="Minimize window"><Minus size={9}/></button><button className="traffic maximize" onClick={() => toggleMaximize(id)} aria-label="Maximize window"><Maximize2 size={8}/></button></div>
                  <div className="window-title"><AppIcon app={app}/>{app.name}</div>
                </div>
                <div className="app-viewport"><Suspense fallback={<LoadingApp/>}><App/></Suspense></div>
                <div className="resize-handle" onPointerDown={event => startDrag(event, id, "resize")} {...dragHandlers}/>
              </motion.section>
            );
          })}
        </AnimatePresence>
      </div>
      <AnimatePresence>
        {launcherOpen && <motion.div className="launcher glass" role="dialog" aria-label="App launcher" initial={{ opacity: 0, scale: .92, filter: "blur(10px)" }} animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }} exit={{ opacity: 0, scale: .95, filter: "blur(8px)", transition: { duration: .14 } }} transition={spring}>
          <div className="launcher-search"><Search size={16}/><span>Jump to an app</span><kbd>⌘ K</kbd></div>
          <div className="launcher-grid">{apps.map((app, index) => { const id = app.id; return <motion.button key={id} onClick={() => launch(id)} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: .03 * index }} whileHover={{ y: -3 }} whileTap={{ scale: .94 }}><AppIcon app={app}/><strong>{app.name}</strong><small>{windows[id] ? "Running" : "Open"}</small></motion.button>; })}</div>
        </motion.div>}
      </AnimatePresence>
      <nav className="dock glass" aria-label="Applications" onMouseMove={event => dockMouseX.set(event.clientX)} onMouseLeave={() => dockMouseX.set(Infinity)}>
        {apps.map(app => { const id = app.id; return <DockIcon key={id} mouseX={dockMouseX} bounce={bounces[id]} iconRef={el => { dockIcons.current[id] = el; }} onClick={() => launch(id)} aria-label={app.name} title={app.name}><AppIcon app={app}/><AnimatePresence>{windows[id]&&<motion.i initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}/>}</AnimatePresence></DockIcon>; })}
        <div className="dock-divider"/>
        <DockIcon mouseX={dockMouseX} onClick={() => setLauncherOpen(v=>!v)} aria-label="All apps" title="All apps"><span className="launchpad"><span/><span/><span/><span/></span></DockIcon>
      </nav>
    </main>
  );
}
