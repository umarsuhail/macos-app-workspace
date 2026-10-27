/// <reference types="vite/client" />
import { lazy, type ComponentType, type LazyExoticComponent, type ReactNode } from "react";
import type { Metadata } from "next";

// Every folder in /apps with a page.tsx is an app — drop one in and it appears in the dock.
//   apps/<id>/page.tsx     default export renders the app; loaded only when first opened
//   apps/<id>/favicon.ico  icon for the dock, launcher, desktop and title bar
//   apps/<id>/layout.tsx   optional: `metadata.title` names the app, default export wraps the page
type PageModule = { default: ComponentType };
type LayoutModule = { default?: ComponentType<{ children: ReactNode }>; metadata?: Metadata };

const pages = import.meta.glob<PageModule>("/apps/*/page.tsx");
const icons = import.meta.glob<string>("/apps/*/favicon.ico", { eager: true, query: "?url", import: "default" });
const layouts = import.meta.glob<LayoutModule>("/apps/*/layout.tsx", { eager: true });

export type AppDefinition = { id: string; name: string; description?: string; icon?: string; color: string; component: LazyExoticComponent<ComponentType> };

const folderOf = (path: string) => path.split("/").at(-2)!;
const titleCase = (id: string) => id.split(/[-_\s]+/).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
function titleOf(metadata?: Metadata) {
  const title = metadata?.title;
  if (!title) return undefined;
  if (typeof title === "string") return title;
  return "absolute" in title ? title.absolute : title.default;
}
// Fallback tile colour for apps that ship without a favicon.ico.
function colorOf(id: string) { let hash = 0; for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) | 0; return `hsl(${Math.abs(hash) % 360} 72% 58%)`; }

function definitionOf(path: string): AppDefinition {
  const id = folderOf(path), dir = `/apps/${id}`, layout = layouts[`${dir}/layout.tsx`];
  const component = lazy(async () => {
    const { default: Page } = await pages[path]();
    const Layout = layout?.default;
    return { default: Layout ? function LayoutPage() { return <Layout><Page/></Layout>; } : Page };
  });
  const description = layout?.metadata?.description ?? undefined;
  return { id, name: titleOf(layout?.metadata) ?? titleCase(id), description, icon: icons[`${dir}/favicon.ico`], color: colorOf(id), component };
}

export const apps: AppDefinition[] = Object.keys(pages).map(definitionOf).sort((a, b) => a.name.localeCompare(b.name));
export const appsById: Record<string, AppDefinition> = Object.fromEntries(apps.map(app => [app.id, app]));

export function AppIcon({ app }: { app: AppDefinition }) {
  return app.icon
    // eslint-disable-next-line @next/next/no-img-element -- tiny .ico assets; next/image can't optimise them
    ? <span className="tile"><img src={app.icon} alt="" draggable={false}/></span>
    : <span className="tile tile-fallback" style={{ background: app.color }}><b>{app.name.charAt(0)}</b></span>;
}
