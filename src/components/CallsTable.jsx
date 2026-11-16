import { useEffect, useState } from "react";
import { AGENTS, listCalls } from "../api/client";
import { useAsync } from "../useAsync";
import { formatDateTime, formatDuration, formatUsd, humanize } from "../format";
import StatusPill from "./StatusPill";

const PAGE_SIZE = 12;
const EMPTY_FILTERS = { search: "", status: "", agent_id: "", direction: "" };

export default function CallsTable({ days, onSelect }) {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [ordering, setOrdering] = useState("-started_at");
  const [page, setPage] = useState(1);

  // Any filter change goes back to page 1.
  useEffect(() => setPage(1), [filters, ordering, days]);

  // Same window as the stats endpoint: from 00:00 UTC, (days - 1) days ago.
  const firstDay = new Date();
  firstDay.setUTCHours(0, 0, 0, 0);
  const startedAfter = new Date(firstDay.getTime() - (days - 1) * 86400000).toISOString();
  const { data, loading, error } = useAsync(
    () => listCalls({ ...filters, ordering, page, page_size: PAGE_SIZE, started_after: startedAfter }),
    [filters, ordering, page, days]
  );

  const update = (key) => (e) => setFilters((f) => ({ ...f, [key]: e.target.value }));
  const sortBy = (field) => setOrdering((o) => (o === `-${field}` ? field : `-${field}`));
  const arrow = (field) => (ordering === `-${field}` ? " ↓" : ordering === field ? " ↑" : "");
  const totalPages = data ? Math.max(1, Math.ceil(data.count / PAGE_SIZE)) : 1;

  return (
    <section className="card table-card">
      <div className="table-header">
        <h2>Calls</h2>
        <div className="filters">
          <input type="search" placeholder="Search id or number" value={filters.search} onChange={update("search")} />
          <select value={filters.status} onChange={update("status")} aria-label="Status">
            <option value="">All statuses</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
          </select>
          <select value={filters.agent_id} onChange={update("agent_id")} aria-label="Agent">
            <option value="">All agents</option>
            {AGENTS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <select value={filters.direction} onChange={update("direction")} aria-label="Direction">
            <option value="">Both directions</option>
            <option value="inbound">Inbound</option>
            <option value="outbound">Outbound</option>
          </select>
        </div>
      </div>

      {error && <div className="error">Could not load calls: {error.message}</div>}

      <div className="table-scroll">
        <table className={loading ? "is-loading" : ""}>
          <thead>
            <tr>
              <th>
                <button onClick={() => sortBy("started_at")}>Started{arrow("started_at")}</button>
              </th>
              <th>Call</th>
              <th>Agent</th>
              <th className="num">
                <button onClick={() => sortBy("duration_seconds")}>Duration{arrow("duration_seconds")}</button>
              </th>
              <th className="num">
                <button onClick={() => sortBy("cost_usd")}>Cost{arrow("cost_usd")}</button>
              </th>
              <th>Status</th>
              <th>Outcome</th>
            </tr>
          </thead>
          <tbody>
            {data?.results.map((call) => (
              <tr key={call.id} onClick={() => onSelect(call.id)} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && onSelect(call.id)}>
                <td className="nowrap">{formatDateTime(call.started_at)}</td>
                <td>
                  <div className="mono">{call.id}</div>
                  <div className="muted small">
                    {call.direction} &middot; {call.from_number}
                  </div>
                </td>
                <td>{call.agent_id}</td>
                <td className="num">{formatDuration(call.duration_seconds)}</td>
                <td className="num">{formatUsd(call.cost_usd, 4)}</td>
                <td>
                  <StatusPill status={call.status} />
                </td>
                <td>
                  <div className="tags">
                    {call.outcome_tags.slice(0, 2).map((t) => (
                      <span key={t} className="tag">
                        {humanize(t)}
                      </span>
                    ))}
                    {call.outcome_tags.length > 2 && <span className="tag">+{call.outcome_tags.length - 2}</span>}
                  </div>
                </td>
              </tr>
            ))}
            {data && data.results.length === 0 && (
              <tr>
                <td colSpan={7} className="empty">
                  No calls match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="pagination">
        <span className="muted">{data ? `${data.count} calls` : "Loading..."}</span>
        <div>
          <button disabled={!data?.previous} onClick={() => setPage((p) => p - 1)}>
            Previous
          </button>
          <span className="muted">
            Page {page} of {totalPages}
          </span>
          <button disabled={!data?.next} onClick={() => setPage((p) => p + 1)}>
            Next
          </button>
        </div>
      </div>
    </section>
  );
}
