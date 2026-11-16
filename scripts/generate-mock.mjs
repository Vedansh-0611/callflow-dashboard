// Generates src/mock/calls.json: fake calls with event timelines, in the same
// shape the callflow-analytics-api returns. Seeded, so the output is stable.
import { writeFileSync } from "node:fs";

let seed = 20260611;
function rand() {
  // mulberry32: tiny deterministic PRNG
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const int = (min, max) => Math.floor(rand() * (max - min + 1)) + min;
const pick = (list) => list[Math.floor(rand() * list.length)];

const AGENTS = ["clinic-receptionist", "loan-reminder", "order-support", "lead-qualifier"];
const MODELS = ["gpt-4o-mini", "gpt-4o", "claude-haiku"];
const PRICES = { "gpt-4o-mini": [0.15, 0.6], "gpt-4o": [2.5, 10], "claude-haiku": [0.8, 4] };
const END_REASONS = [
  ...Array(12).fill("completed"), ...Array(4).fill("customer_hangup"),
  "transferred", "transferred", "voicemail", "voicemail", "error",
];
const TOOLS = ["book_appointment", "lookup_order", "send_sms", "check_balance", "transfer_to_human"];
const AGENT_LINES = [
  "Hi, thanks for calling. How can I help you today?",
  "Sure, let me check that for you.",
  "I found two open slots tomorrow, 11 AM or 4 PM.",
  "Done. You will get a confirmation SMS shortly.",
  "Is there anything else I can help with?",
];
const CALLER_LINES = [
  "Hi, I wanted to book an appointment.",
  "Can you tell me the status of my order?",
  "Tomorrow works. Let's do 4 PM.",
  "No, that's all. Thank you!",
  "Can I speak to a person please?",
];

const END = Date.parse("2026-11-15T18:00:00Z");
const DAYS = 30;
const calls = [];

for (let n = 0; n < 300; n++) {
  const id = "call_" + Array.from({ length: 12 }, () => Math.floor(rand() * 16).toString(16)).join("");
  const started = END - int(0, DAYS - 1) * 86400000 - int(0, 10 * 60) * 60000;
  const endReason = pick(END_REASONS);
  const short = endReason === "voicemail" || endReason === "error" || rand() < 0.1;
  const duration = short ? int(4, 14) : int(30, 420);
  const model = pick(MODELS);
  const promptTokens = short ? 0 : int(800, 6000);
  const completionTokens = Math.floor(promptTokens / int(4, 8));
  const at = (sec) => new Date(started + sec * 1000).toISOString();

  const events = [];
  let evt = 0;
  const push = (type, sec, data) => events.push({ event_id: `${id}_evt_${++evt}`, type, occurred_at: at(sec), data });

  push("call.started", 0, {
    agent_id: pick(AGENTS),
    direction: rand() < 0.66 ? "inbound" : "outbound",
    from: "+9198" + int(10000000, 99999999),
    to: "+918000000000",
  });
  const turns = short ? 0 : int(2, 5);
  const step = duration / (turns * 2 + 2);
  let clock = 0;
  const tools = [];
  for (let i = 0; i < turns; i++) {
    clock += step;
    push("transcript.chunk", Math.round(clock), { speaker: "agent", text: AGENT_LINES[i % 5] });
    clock += step;
    push("transcript.chunk", Math.round(clock), { speaker: "caller", text: CALLER_LINES[i % 5] });
    if (i === 1 && rand() < 0.6) {
      const tool = { name: pick(TOOLS), success: rand() > 0.15, latency_ms: int(80, 900) };
      tools.push(tool);
      push("tool.called", Math.round(clock), tool);
    }
  }
  push("call.ended", duration, {
    duration_seconds: duration,
    end_reason: endReason,
    usage: { model, prompt_tokens: promptTokens, completion_tokens: completionTokens },
  });

  // Same rules as the API's outcome tagging.
  const tags = [];
  if (duration < 15) tags.push("short_call");
  const reasonTag = { transferred: "transferred", voicemail: "voicemail", customer_hangup: "customer_hung_up", error: "error" };
  if (reasonTag[endReason]) tags.push(reasonTag[endReason]);
  if (tools.length) tags.push("tool_used");
  if (tools.some((t) => !t.success)) tags.push("tool_failed");
  if (tools.some((t) => t.name === "book_appointment" && t.success)) tags.push("booking_made");
  if (endReason === "completed" && !tags.includes("short_call")) tags.push("resolved");

  const [inPrice, outPrice] = PRICES[model];
  const cost = (promptTokens * inPrice + completionTokens * outPrice) / 1e6 + Math.ceil(duration / 60) * 0.01;
  const start = events[0].data;

  calls.push({
    id,
    agent_id: start.agent_id,
    direction: start.direction,
    from_number: start.from,
    to_number: start.to,
    status: endReason === "error" ? "failed" : "completed",
    started_at: at(0),
    ended_at: at(duration),
    duration_seconds: duration,
    end_reason: endReason,
    llm_model: model,
    total_tokens: promptTokens + completionTokens,
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    cost_usd: Math.round(cost * 10000) / 10000,
    outcome_tags: tags,
    transcript_turns: turns * 2,
    tool_calls: tools.length,
    events,
  });
}

calls.sort((a, b) => b.started_at.localeCompare(a.started_at));
writeFileSync(new URL("../src/mock/calls.json", import.meta.url), JSON.stringify(calls));
console.log(`wrote ${calls.length} calls`);
