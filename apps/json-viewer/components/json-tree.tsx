import type { JsonValue as J } from '../types';
import { kind } from '../lib/json';
export function Tree({
  value,
  path,
  label,
  level,
  collapsed,
  toggle,
  select,
  selected,
  query,
}: {
  value: J;
  path: string;
  label: string;
  level: number;
  collapsed: Set<string>;
  toggle: (s: string) => void;
  select: (p: string, v: J) => void;
  selected: string;
  query: string;
}) {
  const container = value !== null && typeof value === 'object';
  const entries = container ? Object.entries(value) : [];
  const array = Array.isArray(value);
  const match =
    query &&
    `${label} ${container ? '' : String(value)}`.toLowerCase().includes(query.toLowerCase());
  return (
    <div>
      <div
        className={`tree-row ${selected === path ? 'selected' : ''} ${match ? 'match' : ''}`}
        style={{ paddingLeft: 14 + level * 22 }}
      >
        <button
          className="chevron"
          aria-label={collapsed.has(path) ? 'Expand ' + label : 'Collapse ' + label}
          onClick={() => container && toggle(path)}
          disabled={!container}
        >
          {container ? (collapsed.has(path) ? '▸' : '▾') : '·'}
        </button>
        <button className="node" onClick={() => select(path, value)} title={'Select ' + path}>
          <span className="key">{label}</span>
          <span className="colon">: </span>
          {container ? (
            <>
              <span className="bracket">{array ? '[' : '{'}</span>
              <span className="hint">
                {entries.length} {array ? 'items' : 'keys'}
              </span>
              {collapsed.has(path) && <span className="bracket">{array ? ']' : '}'}</span>}
            </>
          ) : (
            <span className={kind(value)}>{JSON.stringify(value)}</span>
          )}
        </button>
        <span className="type-label">{kind(value)}</span>
      </div>
      {container && !collapsed.has(path) && (
        <>
          <div className="branches">
            {entries.map(([k, v]) => (
              <Tree
                key={k}
                value={v}
                label={array ? k : k}
                path={path + '/' + k.replace(/~/g, '~0').replace(/\//g, '~1')}
                level={level + 1}
                collapsed={collapsed}
                toggle={toggle}
                select={select}
                selected={selected}
                query={query}
              />
            ))}
          </div>
          <div className="tree-close" style={{ paddingLeft: 39 + level * 22 }}>
            {array ? ']' : '}'}
          </div>
        </>
      )}
    </div>
  );
}
