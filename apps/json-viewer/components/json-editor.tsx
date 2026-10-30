import { useRef } from 'react';
import type { JsonValue as J } from '../types';
export function JsonEditor({
  raw,
  update,
  parsed,
  bytes,
}: {
  raw: string;
  update: (s: string) => void;
  parsed: { value: J; error: string };
  bytes: number;
}) {
  const file = useRef<HTMLInputElement>(null);
  return (
    <div className="input-pane">
      <div className="pane-title">
        <span>
          <b className="small-icon">{'{ }'}</b> Input
        </span>
        <span className="subtle">JSON</span>
      </div>
      <div className="input-tools">
        <button
          disabled={!!parsed.error}
          onClick={() => update(JSON.stringify(parsed.value, null, 2))}
        >
          ≡ Format
        </button>
        <button disabled={!!parsed.error} onClick={() => update(JSON.stringify(parsed.value))}>
          ↔ Minify
        </button>
        <div className="spacer" />
        <button onClick={() => file.current?.click()}>↥ Upload</button>
        <button onClick={() => update('')} aria-label="Clear input">
          ×
        </button>
        <input
          ref={file}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) update(await f.text());
            e.target.value = '';
          }}
        />
      </div>
      <div className="editor">
        <div className="line-numbers" aria-hidden="true">
          {raw.split('\n').map((_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>
        <textarea
          aria-label="JSON input"
          spellCheck={false}
          value={raw}
          onChange={(e) => update(e.target.value)}
          placeholder="Paste your JSON here…"
        />
      </div>
      <div className="pane-footer">
        <span className={parsed.error ? 'invalid' : 'valid'}>
          {parsed.error ? '○ Invalid JSON' : '● Valid JSON'}
        </span>
        <span>
          {raw.split('\n').length} lines <b>·</b> {(bytes / 1024).toFixed(2)} KB
        </span>
      </div>
    </div>
  );
}
