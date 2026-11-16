import { useEffect } from "react";
import { getCall } from "../api/client";
import { useAsync } from "../useAsync";
import { formatDateTime, formatDuration, formatNumber, formatTime, formatUsd, humanize } from "../format";
import StatusPill from "./StatusPill";

function EventBody({ event }) {
  const d = event.data;
  switch (event.type) {
    case "call.started":
      return (
        <span>
          {d.direction} call to <b>{d.agent_id}</b> from {d.from}
        </span>
      );
    case "transcript.chunk":
      return (
        <span>
          <b className="speaker">{d.speaker}:</b> {d.text}
        </span>
      );
    case "tool.called":
      return (
        <span>
          <code>{d.name}</code> {d.success ? "succeeded" : "failed"} in {d.latency_ms} ms
        </span>
      );
    case "call.ended":
      return (
        <span>
          {humanize(d.end_reason)} after {formatDuration(d.duration_seconds)} &middot;{" "}
          {formatNumber((d.usage?.prompt_tokens || 0) + (d.usage?.completion_tokens || 0))} tokens
        </span>
      );
    default:
      return <code>{JSON.stringify(d)}</code>;
  }
}

export default function CallDrawer({ callId, onClose }) {
  const { data: call, loading, error } = useAsync(() => (callId ? getCall(callId) : Promise.resolve(null)), [callId]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!callId) return null;

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Call details">
        <div className="drawer-header">
          <div>
            <div className="mono">{callId}</div>
            {call && <div className="muted small">{formatDateTime(call.started_at)}</div>}
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>

        {loading && <div className="skeleton chart-skeleton" />}
        {error && <div className="error">{error.message}</div>}

        {call && !loading && (
          <>
            <dl className="facts">
              <div>
                <dt>Status</dt>
                <dd>
                  <StatusPill status={call.status} />
                </dd>
              </div>
              <div>
                <dt>Agent</dt>
                <dd>{call.agent_id}</dd>
              </div>
              <div>
                <dt>Duration</dt>
                <dd>{formatDuration(call.duration_seconds)}</dd>
              </div>
              <div>
                <dt>Cost</dt>
                <dd>{formatUsd(call.cost_usd, 4)}</dd>
              </div>
              <div>
                <dt>Model</dt>
                <dd>{call.llm_model || "-"}</dd>
              </div>
              <div>
                <dt>Tokens</dt>
                <dd>
                  {formatNumber(call.prompt_tokens)} in / {formatNumber(call.completion_tokens)} out
                </dd>
              </div>
            </dl>

            <div className="tags drawer-tags">
              {call.outcome_tags.map((t) => (
                <span key={t} className="tag">
                  {humanize(t)}
                </span>
              ))}
            </div>

            <h3>Event timeline</h3>
            <ol className="timeline">
              {call.events.map((event) => (
                <li key={event.event_id} className={`timeline-item type-${event.type.replace(".", "-")}`}>
                  <span className="timeline-dot" />
                  <div>
                    <div className="timeline-meta">
                      <span className="timeline-type">{event.type}</span>
                      <span className="muted">{formatTime(event.occurred_at)}</span>
                    </div>
                    <div className="timeline-body">
                      <EventBody event={event} />
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </>
        )}
      </aside>
    </div>
  );
}
