"use client";

import { Suspense, use } from "react";
import { notFound } from "next/navigation";
import { appsById } from "@/lib/app-registry";

// Runs any app from /apps on its own, outside the desktop: /apps/<id>
export default function StandaloneApp({ params }: { params: Promise<{ id: string }> }) {
  const app = appsById[use(params).id];
  if (!app) notFound();
  const App = app.component;
  return (
    <main className="desktop standalone">
      <title>{app.name}</title>
      {app.icon && <link rel="icon" href={app.icon}/>}
      <div className="app-viewport glass"><Suspense fallback={<div className="app-loading" aria-label="Loading app"><span/><span/><span/></div>}><App/></Suspense></div>
    </main>
  );
}
