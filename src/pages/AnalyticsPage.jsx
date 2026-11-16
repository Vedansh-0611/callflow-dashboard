import { useState } from "react";
import { getStats } from "../api/client";
import { useAsync } from "../useAsync";
import KpiCards from "../components/KpiCards";
import DailyChart from "../components/DailyChart";
import OutcomeTags from "../components/OutcomeTags";
import CallsTable from "../components/CallsTable";
import CallDrawer from "../components/CallDrawer";
import { formatDuration, formatUsd } from "../format";

const RANGES = [7, 14, 30];

export default function AnalyticsPage() {
  const [days, setDays] = useState(14);
  const [selectedCallId, setSelectedCallId] = useState(null);
  const stats = useAsync(() => getStats(days), [days]);

  return (
    <>
      <div className="page-header">
        <div>
          <h2 className="page-title">Analytics</h2>
          <p className="subtitle">Volume, duration, cost and outcomes of your voice-agent calls.</p>
        </div>
        <div className="segmented" role="group" aria-label="Date range">
          {RANGES.map((r) => (
            <button key={r} className={r === days ? "active" : ""} onClick={() => setDays(r)}>
              {r}d
            </button>
          ))}
        </div>
      </div>

      {stats.error && <div className="error">Could not load stats: {stats.error.message}</div>}

      <KpiCards stats={stats.data} loading={stats.loading} />

      <section className="grid-charts">
        <DailyChart
          title="Calls per day"
          data={stats.data?.per_day}
          dataKey="calls"
          kind="bar"
          format={(v) => `${v} calls`}
        />
        <DailyChart
          title="Cost per day"
          data={stats.data?.per_day}
          dataKey="cost_usd"
          kind="area"
          format={(v) => formatUsd(v)}
          tickFormat={(v) => `$${v.toFixed(2)}`}
        />
        <DailyChart
          title="Average duration"
          data={stats.data?.per_day}
          dataKey="avg_duration"
          kind="area"
          format={(v) => formatDuration(v)}
          tickFormat={(v) => `${v / 60}m`}
          tickStep={60}
        />
        <OutcomeTags tags={stats.data?.outcome_tags} total={stats.data?.totals.calls} />
      </section>

      <CallsTable days={days} onSelect={setSelectedCallId} />

      <CallDrawer callId={selectedCallId} onClose={() => setSelectedCallId(null)} />
    </>
  );
}
