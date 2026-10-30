import type { JsonValue as J } from '../types';
import { kind } from '../lib/json';
export function NodeInspector({
  selection,
  onClose,
  copy,
  download,
}: {
  selection: { path: string; value: J };
  onClose: () => void;
  copy: (s: string) => void;
  download: (v: J, name?: string) => void;
}) {
  return (
    <aside className="selection">
      <div>
        <span className="eyebrow">SELECTED NODE</span>
        <button aria-label="Close selection" onClick={onClose}>
          ×
        </button>
      </div>
      <code>{selection.path || 'root'}</code>
      <span className="subtle">
        {kind(selection.value)} · {new TextEncoder().encode(JSON.stringify(selection.value)).length}{' '}
        bytes
      </span>
      <pre>{JSON.stringify(selection.value, null, 2)}</pre>
      <div>
        <button onClick={() => copy(JSON.stringify(selection.value, null, 2))}>Copy value</button>
        <button onClick={() => copy(selection.path)}>Copy pointer</button>
        <button onClick={() => download(selection.value, 'selection.json')}>Download</button>
      </div>
    </aside>
  );
}
