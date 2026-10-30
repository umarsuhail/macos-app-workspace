import type { analyze } from '../lib/json';
export function JsonAnalysis({
  stats,
  bytes,
}: {
  stats: ReturnType<typeof analyze>;
  bytes: number;
}) {
  return (
    <div className="analysis">
      <div className="eyebrow">UNDER THE SURFACE</div>
      <h2>Your data, at a glance.</h2>
      <p>A quick breakdown of the current document.</p>
      <div className="metrics">
        {[
          ['Total values', stats.total],
          ['Object keys', stats.keys],
          ['Max depth', stats.depth],
          ['Input size', `${(bytes / 1024).toFixed(2)} KB`],
        ].map(([l, v]) => (
          <div key={l}>
            <strong>{v}</strong>
            <span>{l}</span>
          </div>
        ))}
      </div>
      <h3>Value types</h3>
      {Object.entries(stats.counts).map(([k, v]) => (
        <div className="stat-row" key={k}>
          <span className={'type-dot ' + k} />
          <span>{k}</span>
          <div className="track">
            <i style={{ width: `${(v / stats.total) * 100}%` }} />
          </div>
          <b>{v}</b>
          <small>{Math.round((v / stats.total) * 100)}%</small>
        </div>
      ))}
    </div>
  );
}
