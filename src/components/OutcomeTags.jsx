import { humanize } from "../format";

// A ranked list with inline bars reads better than a pie for 6-8 categories.
export default function OutcomeTags({ tags, total }) {
  const entries = Object.entries(tags || {});
  const max = Math.max(1, ...entries.map(([, n]) => n));

  return (
    <div className="card chart-card">
      <h2>Outcome tags</h2>
      <ul className="tag-bars">
        {entries.map(([tag, count]) => (
          <li key={tag} title={`${count} of ${total} calls`}>
            <span className="tag-name">{humanize(tag)}</span>
            <span className="tag-track">
              <span className="tag-fill" style={{ width: `${(count / max) * 100}%` }} />
            </span>
            <span className="tag-count">{count}</span>
          </li>
        ))}
        {!tags && <li className="skeleton chart-skeleton" />}
      </ul>
    </div>
  );
}
