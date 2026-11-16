import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatDay } from "../format";

function ChartTooltip({ active, payload, label, format }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-label">{formatDay(label)}</div>
      <div className="chart-tooltip-value">{format(payload[0].value)}</div>
    </div>
  );
}

// One reusable single-series chart: bars for counts, an area for continuous values.
export default function DailyChart({ title, data, dataKey, kind, format, tickFormat, tickStep }) {
  // Optional fixed tick spacing, e.g. one tick per minute for durations.
  const max = Math.max(0, ...(data || []).map((d) => d[dataKey]));
  const ticks = tickStep ? Array.from({ length: Math.ceil(max / tickStep) + 1 }, (_, i) => i * tickStep) : undefined;

  const axisProps = {
    tickLine: false,
    axisLine: false,
    tick: { fill: "var(--text-muted)", fontSize: 12 },
  };

  const common = (
    <>
      <CartesianGrid vertical={false} stroke="var(--grid)" />
      <XAxis dataKey="date" tickFormatter={formatDay} minTickGap={24} {...axisProps} />
      <YAxis width={44} tickFormatter={tickFormat} ticks={ticks} allowDecimals={dataKey !== "calls"} {...axisProps} />
      <Tooltip
        content={<ChartTooltip format={format} />}
        cursor={kind === "bar" ? { fill: "var(--hover)" } : { stroke: "var(--text-muted)", strokeDasharray: "3 3" }}
      />
    </>
  );

  return (
    <div className="card chart-card">
      <h2>{title}</h2>
      <div className="chart-body">
        {data ? (
          <ResponsiveContainer width="100%" height="100%">
            {kind === "bar" ? (
              <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                {common}
                <Bar dataKey={dataKey} fill="var(--series-1)" radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            ) : (
              <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id={`fill-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--series-1)" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="var(--series-1)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                {common}
                <Area
                  type="monotone"
                  dataKey={dataKey}
                  stroke="var(--series-1)"
                  strokeWidth={2}
                  fill={`url(#fill-${dataKey})`}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface)" }}
                />
              </AreaChart>
            )}
          </ResponsiveContainer>
        ) : (
          <div className="skeleton chart-skeleton" />
        )}
      </div>
    </div>
  );
}
