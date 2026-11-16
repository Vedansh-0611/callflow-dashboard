// In-browser stand-in for callflow-analytics-api, backed by bundled JSON.
// It mirrors the real endpoints' filters, pagination and response shapes.

const DAY = 86400000;

// Shift every timestamp so the newest mock call ended about 30 minutes ago.
// That keeps the demo looking current no matter when it is opened.
function shiftDates(calls) {
  const newest = Math.max(...calls.map((c) => Date.parse(c.ended_at)));
  const offset = Date.now() - 30 * 60000 - newest;
  const shift = (iso) => new Date(Date.parse(iso) + offset).toISOString();
  return calls.map((c) => ({
    ...c,
    started_at: shift(c.started_at),
    ended_at: shift(c.ended_at),
    events: c.events.map((e) => ({ ...e, occurred_at: shift(e.occurred_at) })),
  }));
}

// The JSON is loaded lazily, so it is a separate chunk and never downloaded
// when the dashboard points at the real API.
const callsPromise = import("../mock/calls.json").then((module) => shiftDates(module.default));
const delay = (value) => new Promise((resolve) => setTimeout(() => resolve(value), 150));

function withoutEvents({ events, prompt_tokens, completion_tokens, transcript_turns, tool_calls, ...call }) {
  return call;
}

export async function listCalls(params = {}) {
  const allCalls = await callsPromise;
  const { status, agent_id, direction, search, started_after, ordering = "-started_at" } = params;
  const page = Number(params.page || 1);
  const pageSize = Number(params.page_size || 20);

  let rows = allCalls.filter(
    (c) =>
      (!status || c.status === status) &&
      (!agent_id || c.agent_id === agent_id) &&
      (!direction || c.direction === direction) &&
      (!started_after || c.started_at >= started_after) &&
      (!search || [c.id, c.from_number, c.to_number].some((v) => v.includes(search)))
  );

  const desc = ordering.startsWith("-");
  const field = ordering.replace("-", "");
  rows = [...rows].sort((a, b) => (a[field] > b[field] ? 1 : a[field] < b[field] ? -1 : 0) * (desc ? -1 : 1));

  const start = (page - 1) * pageSize;
  return delay({
    count: rows.length,
    next: start + pageSize < rows.length ? page + 1 : null,
    previous: page > 1 ? page - 1 : null,
    results: rows.slice(start, start + pageSize).map(withoutEvents),
  });
}

export async function getCall(id) {
  const call = (await callsPromise).find((c) => c.id === id);
  if (!call) throw new Error("Call not found");
  return delay(call);
}

export async function getStats(days = 14) {
  const allCalls = await callsPromise;
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const first = new Date(today.getTime() - (days - 1) * DAY);
  const inRange = allCalls.filter((c) => Date.parse(c.started_at) >= first.getTime());

  const perDay = Array.from({ length: days }, (_, i) => {
    const date = new Date(first.getTime() + i * DAY).toISOString().slice(0, 10);
    const dayCalls = inRange.filter((c) => c.started_at.startsWith(date));
    const total = dayCalls.reduce((sum, c) => sum + c.duration_seconds, 0);
    return {
      date,
      calls: dayCalls.length,
      avg_duration: dayCalls.length ? Math.round((total / dayCalls.length) * 10) / 10 : 0,
      cost_usd: Math.round(dayCalls.reduce((sum, c) => sum + c.cost_usd, 0) * 10000) / 10000,
    };
  });

  const tags = {};
  inRange.forEach((c) => c.outcome_tags.forEach((t) => (tags[t] = (tags[t] || 0) + 1)));
  const sortedTags = Object.fromEntries(Object.entries(tags).sort((a, b) => b[1] - a[1]));
  const totalDuration = inRange.reduce((sum, c) => sum + c.duration_seconds, 0);

  return delay({
    range: { from: perDay[0].date, to: perDay[days - 1].date, days },
    totals: {
      calls: inRange.length,
      completed: inRange.filter((c) => c.status === "completed").length,
      failed: inRange.filter((c) => c.status === "failed").length,
      avg_duration: inRange.length ? Math.round((totalDuration / inRange.length) * 10) / 10 : 0,
      total_cost_usd: Math.round(inRange.reduce((sum, c) => sum + c.cost_usd, 0) * 10000) / 10000,
      total_tokens: inRange.reduce((sum, c) => sum + c.total_tokens, 0),
    },
    per_day: perDay,
    outcome_tags: sortedTags,
  });
}
