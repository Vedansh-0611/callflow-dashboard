const ICONS = { completed: "✓", failed: "✕", in_progress: "•" };

export default function StatusPill({ status }) {
  return (
    <span className={`pill pill-${status}`}>
      <span aria-hidden="true">{ICONS[status]}</span> {status.replace("_", " ")}
    </span>
  );
}
