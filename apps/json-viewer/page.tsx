'use client';
import { useMemo, useState } from 'react';
import type { JsonValue as J } from './types';
import { example, analyze } from './lib/json';
import { Tree } from './components/json-tree';
import { JsonAnalysis } from './components/json-analysis';
import { NodeInspector } from './components/node-inspector';
import { JsonEditor } from './components/json-editor';
import './json-viewer.css';
export default function JsonViewer() {
  const [raw, setRaw] = useState(JSON.stringify(example, null, 2));
  const [tab, setTab] = useState('Tree view');
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState(new Set<string>());
  const [selection, setSelection] = useState<{ path: string; value: J } | null>(null);
  const [notice, setNotice] = useState('');
  const parsed = useMemo(() => {
    try {
      return { value: JSON.parse(raw) as J, error: '' };
    } catch (e) {
      return { value: null, error: (e as Error).message };
    }
  }, [raw]);
  const stats = useMemo(() => analyze(parsed.value), [parsed.value]);
  const bytes = new TextEncoder().encode(raw).length;
  function update(s: string) {
    setRaw(s);
    setSelection(null);
  }
  function toast(s: string) {
    setNotice(s);
    setTimeout(() => setNotice(''), 2500);
  }
  async function copy(v: string) {
    try {
      await navigator.clipboard.writeText(v);
      toast('Copied to clipboard');
    } catch {
      toast('Clipboard unavailable. Select text and copy manually.');
    }
  }
  function download(v: J, name = 'data.json') {
    const u = URL.createObjectURL(
      new Blob([JSON.stringify(v, null, 2)], { type: 'application/json' }),
    );
    const a = document.createElement('a');
    a.href = u;
    a.download = name;
    a.click();
    URL.revokeObjectURL(u);
  }
  function collapseAll() {
    const paths = new Set<string>();
    function walk(v: J, p: string) {
      if (v !== null && typeof v === 'object') {
        paths.add(p);
        Object.entries(v).forEach(([k, x]) =>
          walk(x, p + '/' + k.replace(/~/g, '~0').replace(/\//g, '~1')),
        );
      }
    }
    walk(parsed.value, '');
    setCollapsed(paths);
  }
  return (
    <div className="json-viewer">
      <div className="json-viewer-scroll">
        <section className="intro">
          <div className="eyebrow">YOUR EVERYDAY JSON WORKSPACE</div>
          <h1>
            Complex data. <span>Clearly simple.</span>
          </h1>
          <p>Paste, explore, and understand your JSON. No noise, just structure.</p>
        </section>
        <div className="workspace-bar">
          <div>
            <span className="workspace-dot" />
            Untitled workspace <span className="badge">JSON</span>
          </div>
          <button
            onClick={() => {
              update(JSON.stringify(example, null, 2));
              setCollapsed(new Set());
            }}
          >
            ↺ Load sample
          </button>
        </div>
        <section className="workspace">
          <JsonEditor raw={raw} update={update} parsed={parsed} bytes={bytes} />
          <div className="output-pane">
            <div className="pane-title tabs">
              <div role="tablist" aria-label="JSON output views">
                {['Tree view', 'Code', 'Analysis'].map((t) => (
                  <button
                    role="tab"
                    aria-selected={tab === t}
                    className={tab === t ? 'active' : ''}
                    key={t}
                    onClick={() => setTab(t)}
                  >
                    {t === 'Tree view' ? '⌘' : t === 'Code' ? '⟨ ⟩' : '◴'} {t}
                  </button>
                ))}
              </div>
              <button
                disabled={!!parsed.error}
                onClick={() => copy(JSON.stringify(parsed.value, null, 2))}
              >
                ▣ Copy
              </button>
            </div>
            <div className="output-tools">
              <label className="search">
                <span>⌕</span>
                <input
                  aria-label="Search keys and values"
                  placeholder="Find a key or value…"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setCollapsed(new Set());
                    setTab('Tree view');
                  }}
                />
                <kbd>⌕</kbd>
              </label>
              <button title="Expand all" onClick={() => setCollapsed(new Set())}>
                Expand all
              </button>
              <button title="Collapse all" onClick={collapseAll}>
                Collapse
              </button>
            </div>
            <div className="result">
              {parsed.error ? (
                <div className="error">
                  <span>!</span>
                  <h3>Let’s straighten this out</h3>
                  <p>{parsed.error}</p>
                  <small>Your input stays here while you fix it.</small>
                </div>
              ) : tab === 'Tree view' ? (
                <Tree
                  value={parsed.value}
                  path=""
                  label="root"
                  level={0}
                  collapsed={collapsed}
                  toggle={(p) =>
                    setCollapsed((s) => {
                      const n = new Set(s);
                      if (n.has(p)) n.delete(p);
                      else n.add(p);
                      return n;
                    })
                  }
                  select={(path, value) => setSelection({ path, value })}
                  selected={selection?.path ?? '__none'}
                  query={query}
                />
              ) : tab === 'Code' ? (
                <pre className="code">{JSON.stringify(parsed.value, null, 2)}</pre>
              ) : (
                <JsonAnalysis stats={stats} bytes={bytes} />
              )}
            </div>
            {selection && !parsed.error && (
              <NodeInspector
                selection={selection}
                onClose={() => setSelection(null)}
                copy={copy}
                download={download}
              />
            )}
            <div className="pane-footer">
              <span>
                {tab === 'Tree view'
                  ? 'Click any node to select & inspect'
                  : tab === 'Analysis'
                    ? 'Analysis updates as you type'
                    : 'Formatted with 2-space indentation'}
              </span>
              <button disabled={!!parsed.error} onClick={() => download(parsed.value)}>
                ↓ Download JSON
              </button>
            </div>
          </div>
        </section>
      </div>
      {notice && (
        <div role="status" className="toast">
          ✓ {notice}
        </div>
      )}
    </div>
  );
}
