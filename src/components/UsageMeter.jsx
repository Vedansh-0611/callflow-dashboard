import { formatNumber } from "../format";

// Used / allowed with a bar that turns amber at 80% and red at 100%.
export default function UsageMeter({ label, used, limit, unit }) {
  const unlimited = limit == null;
  const pct = unlimited ? 0 : Math.min(100, Math.round((used / limit) * 100));
  const level = pct >= 100 ? "over" : pct >= 80 ? "warn" : "ok";

  return (
    <div className="meter">
      <div className="meter-head">
        <span className="meter-label">{label}</span>
        <span className="meter-value">
          <b>{formatNumber(used)}</b> {unlimited ? unit : `of ${formatNumber(limit)} ${unit}`}
        </span>
      </div>
      <div
        className="meter-track"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
      >
        <span className={`meter-fill meter-${level}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="muted small">{unlimited ? "Unlimited" : `${pct}% used`}</span>
    </div>
  );
}
