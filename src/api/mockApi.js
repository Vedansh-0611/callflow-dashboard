// In-browser stand-in for callflow-analytics-api, used by the GitHub Pages demo.
// It mirrors the real endpoints' filters, pagination, response shapes and error
// bodies, and keeps API keys, endpoints and plan changes in memory.
import { currentOrgSlug } from "./session";

const DAY = 86400000;

// Two demo workspaces so the org switcher has something to switch between.
// Each one owns some of the mock agents, so their numbers differ.
const ORGS = [
  {
    id: 1,
    name: "Acme Health",
    slug: "acme-health",
    role: "owner",
    agents: ["clinic-receptionist", "order-support", "lead-qualifier"],
  },
  { id: 2, name: "Northwind Lending", slug: "northwind-lending", role: "admin", agents: ["loan-reminder"] },
];

const PLANS = [
  {
    code: "free",
    name: "Free",
    price_cents_per_month: 0,
    monthly_call_limit: 500,
    monthly_minute_limit: 1000,
    api_requests_per_minute: 60,
    max_api_keys: 2,
    max_webhook_endpoints: 1,
  },
  {
    code: "pro",
    name: "Pro",
    price_cents_per_month: 4900,
    monthly_call_limit: 50000,
    monthly_minute_limit: 100000,
    api_requests_per_minute: 600,
    max_api_keys: 20,
    max_webhook_endpoints: 10,
  },
];

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
let callsPromise;
const allCalls = () => (callsPromise ??= import("../mock/calls.json").then((m) => shiftDates(m.default)));
const delay = (value, ms = 150) => new Promise((resolve) => setTimeout(() => resolve(value), ms));
const clone = (value) => JSON.parse(JSON.stringify(value));

function apiError(status, body) {
  const error = new Error(body.detail || Object.values(body)[0]?.[0] || "Request failed");
  error.status = status;
  error.body = body;
  return error;
}

const currentOrg = () => ORGS.find((o) => o.slug === currentOrgSlug()) || ORGS[0];

async function orgCalls() {
  const { agents } = currentOrg();
  return (await allCalls()).filter((c) => agents.includes(c.agent_id));
}

// --- per-org state, kept in memory --------------------------------------------

let nextId = 100;
const randomHex = (bytes) =>
  Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (b) => b.toString(16).padStart(2, "0")).join("");
const ago = (ms) => new Date(Date.now() - ms).toISOString();

function initialState(org) {
  return {
    plan: "free",
    webhookSecret: `whsec_${randomHex(24)}`,
    previousSecretExpiresAt: null,
    apiKeys: [
      {
        id: nextId++,
        name: "Production ingest",
        prefix: `cf_${randomHex(4)}`,
        created_by: "demo@callflow.dev",
        created_at: ago(20 * DAY),
        last_used_at: ago(4 * 60000),
        revoked_at: null,
      },
    ],
    endpoints:
      org.slug === "acme-health"
        ? [
            {
              id: nextId++,
              url: "https://hooks.acme-health.example/callflow",
              description: "CRM sync",
              events: ["call.summarized"],
              is_active: true,
              created_at: ago(9 * DAY),
              secret: `whsec_${randomHex(24)}`,
            },
          ]
        : [],
    deliveries: {},
  };
}

const states = {};
function state() {
  const org = currentOrg();
  states[org.slug] ??= initialState(org);
  return states[org.slug];
}

const currentPlan = () => PLANS.find((p) => p.code === state().plan);

function limitError(limit, used, allowed, message) {
  return apiError(402, { detail: message, code: "plan_limit_exceeded", limit, plan: state().plan, used, allowed });
}

// --- auth -----------------------------------------------------------------------

const DEMO_USER = { id: 1, email: "demo@callflow.dev", name: "Demo User" };
const me = () => ({ ...DEMO_USER, organizations: ORGS.map(({ id, name, slug, role }) => ({ id, name, slug, role })) });
const tokens = (user) => ({ access: "demo-access-token", refresh: "demo-refresh-token", user });

export const getMe = () => delay(me());
// Demo mode: any email and password signs in to the demo workspaces.
export const login = (email) => delay(tokens({ ...me(), email: email || DEMO_USER.email }), 300);
export const signup = ({ email, name }) => delay(tokens({ ...me(), email, name }), 300);

export function createOrg(name) {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "org";
  const org = { id: nextId++, name, slug: `${base}-${randomHex(2)}`, role: "owner", agents: [] };
  ORGS.push(org);
  return delay({ id: org.id, name: org.name, slug: org.slug, created_at: new Date().toISOString() });
}

// --- analytics ------------------------------------------------------------------

function withoutEvents({ events, prompt_tokens, completion_tokens, transcript_turns, tool_calls, ...call }) {
  return call;
}

export async function listCalls(params = {}) {
  const calls = await orgCalls();
  const { status, agent_id, direction, search, started_after, ordering = "-started_at" } = params;
  const page = Number(params.page || 1);
  const pageSize = Number(params.page_size || 20);

  let rows = calls.filter(
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
  const call = (await orgCalls()).find((c) => c.id === id);
  if (!call) throw apiError(404, { detail: "No Call matches the given query." });
  return delay(call);
}

export async function getStats(days = 14) {
  const calls = await orgCalls();
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const first = new Date(today.getTime() - (days - 1) * DAY);
  const inRange = calls.filter((c) => Date.parse(c.started_at) >= first.getTime());

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

// --- API keys and the inbound signing secret ------------------------------------

export const listApiKeys = () => delay(clone(state().apiKeys));

export function createApiKey(name) {
  const s = state();
  const plan = currentPlan();
  const active = s.apiKeys.filter((k) => !k.revoked_at).length;
  if (active >= plan.max_api_keys) {
    const message = `The ${plan.name} plan allows ${plan.max_api_keys} API keys. Revoke one or upgrade the plan.`;
    return Promise.reject(limitError("api_keys", active, plan.max_api_keys, message));
  }
  const publicPart = randomHex(4);
  const key = {
    id: nextId++,
    name,
    prefix: `cf_${publicPart}`,
    created_by: DEMO_USER.email,
    created_at: new Date().toISOString(),
    last_used_at: null,
    revoked_at: null,
  };
  s.apiKeys.unshift(key);
  return delay({ ...key, key: `cf_${publicPart}_${randomHex(20)}` });
}

export function revokeApiKey(id) {
  const key = state().apiKeys.find((k) => k.id === id);
  if (key) key.revoked_at = new Date().toISOString();
  return delay(null);
}

export const getWebhookSecret = () =>
  delay({ webhook_secret: state().webhookSecret, previous_secret_expires_at: state().previousSecretExpiresAt });

export function rotateWebhookSecret() {
  const s = state();
  s.webhookSecret = `whsec_${randomHex(24)}`;
  s.previousSecretExpiresAt = new Date(Date.now() + DAY).toISOString();
  return getWebhookSecret();
}

// --- outbound webhook endpoints ---------------------------------------------------

const withoutSecret = ({ secret, ...endpoint }) => endpoint;
const findEndpoint = (id) => state().endpoints.find((e) => e.id === id);

export const listEndpoints = () => delay(state().endpoints.map(withoutSecret));

export function createEndpoint({ url, description = "", events = ["call.summarized"] }) {
  const s = state();
  const plan = currentPlan();
  if (!/^https:\/\//.test(url)) {
    return Promise.reject(apiError(400, { url: ["Webhook URLs must use https."] }));
  }
  if (s.endpoints.length >= plan.max_webhook_endpoints) {
    const message = `The ${plan.name} plan allows ${plan.max_webhook_endpoints} webhook endpoints. Remove one or upgrade the plan.`;
    return Promise.reject(limitError("webhook_endpoints", s.endpoints.length, plan.max_webhook_endpoints, message));
  }
  const endpoint = {
    id: nextId++,
    url,
    description,
    events,
    is_active: true,
    created_at: new Date().toISOString(),
    secret: `whsec_${randomHex(24)}`,
  };
  s.endpoints.push(endpoint);
  return delay(clone(endpoint));
}

export function updateEndpoint(id, data) {
  const endpoint = findEndpoint(id);
  Object.assign(endpoint, data);
  return delay(withoutSecret(endpoint));
}

export function deleteEndpoint(id) {
  const s = state();
  s.endpoints = s.endpoints.filter((e) => e.id !== id);
  return delay(null);
}

export function rotateEndpointSecret(id) {
  const endpoint = findEndpoint(id);
  endpoint.secret = `whsec_${randomHex(24)}`;
  return delay(clone(endpoint));
}

async function seedDeliveries() {
  // A believable history: recent summaries, one of which needed retries.
  const calls = (await orgCalls()).slice(0, 8);
  return calls.map((call, i) => ({
    id: nextId++,
    event_id: `call.summarized.${call.id}`,
    event_type: "call.summarized",
    status: "succeeded",
    attempts: i === 2 ? 3 : 1,
    last_status_code: 200,
    last_error: "",
    next_retry_at: null,
    created_at: call.ended_at,
    delivered_at: new Date(Date.parse(call.ended_at) + (i === 2 ? 95000 : 400)).toISOString(),
  }));
}

export async function listDeliveries(id) {
  const s = state();
  s.deliveries[id] ??= await seedDeliveries();
  return delay(clone(s.deliveries[id]));
}

export async function testEndpoint(id) {
  await listDeliveries(id);
  const now = new Date().toISOString();
  const delivery = {
    id: nextId++,
    event_id: `evt_ping_${randomHex(8)}`,
    event_type: "ping",
    status: "succeeded",
    attempts: 1,
    last_status_code: 200,
    last_error: "",
    next_retry_at: null,
    created_at: now,
    delivered_at: now,
  };
  state().deliveries[id].unshift(delivery);
  return delay(clone(delivery), 400);
}

// --- billing ------------------------------------------------------------------------

async function usageThisMonth() {
  const now = new Date();
  const monthStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
  const calls = (await orgCalls()).filter((c) => Date.parse(c.started_at) >= monthStart);
  return {
    period: new Date(monthStart).toISOString().slice(0, 10),
    calls: calls.length,
    billed_minutes: calls.reduce((sum, c) => sum + Math.ceil(c.duration_seconds / 60), 0),
  };
}

export async function getBilling() {
  const usage = await usageThisMonth();
  const start = new Date(usage.period);
  const lastMonth = {
    period: new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() - 1, 1)).toISOString().slice(0, 10),
    calls: Math.round(usage.calls * 1.6) + 12,
    billed_minutes: Math.round(usage.billed_minutes * 1.6) + 30,
  };
  return delay({ plan: currentPlan(), status: "active", usage, history: [usage, lastMonth], plans: PLANS });
}

export async function changePlan(code) {
  state().plan = code;
  const overview = await getBilling();
  return { result: { status: "active", plan: code, redirect_url: null }, ...overview };
}
