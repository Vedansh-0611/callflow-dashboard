import { formatDuration, formatNumber, formatUsd } from "../format";

export default function KpiCards({ stats, loading }) {
  const t = stats?.totals;
  const successRate = t?.calls ? Math.round((t.completed / t.calls) * 100) : 0;
  const costPerCall = t?.calls ? t.total_cost_usd / t.calls : 0;

  const cards = [
    { label: "Total calls", value: formatNumber(t?.calls), hint: `${t?.failed ?? 0} failed` },
    { label: "Completion rate", value: `${successRate}%`, hint: `${formatNumber(t?.completed)} completed` },
    { label: "Avg duration", value: formatDuration(t?.avg_duration), hint: "per call" },
    { label: "Total cost", value: formatUsd(t?.total_cost_usd), hint: `${formatUsd(costPerCall, 3)} per call` },
    { label: "LLM tokens", value: formatNumber(t?.total_tokens), hint: "prompt + completion" },
  ];

  return (
    <section className="kpis">
      {cards.map((card) => (
        <div key={card.label} className="card kpi">
          <span className="kpi-label">{card.label}</span>
          <span className={`kpi-value ${loading && !stats ? "skeleton" : ""}`}>{stats ? card.value : " "}</span>
          <span className="kpi-hint">{stats ? card.hint : " "}</span>
        </div>
      ))}
    </section>
  );
}
