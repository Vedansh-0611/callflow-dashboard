// One API surface for the UI. With VITE_API_URL set it talks to the Django API;
// otherwise it uses the in-browser mock (the GitHub Pages demo). Pages never
// know which one they are using.
import * as mock from "./mockApi";
import { API_URL, del, get, patch, post, request } from "./http";

export const DEMO_MODE = !API_URL;
const real = !DEMO_MODE;

// --- auth & orgs --------------------------------------------------------------
export const login = (email, password) =>
  real ? request("POST", "auth/login/", { body: { email, password }, auth: false }) : mock.login(email);
export const signup = (form) =>
  real ? request("POST", "auth/signup/", { body: form, auth: false }) : mock.signup(form);
export const getMe = () => (real ? get("auth/me/") : mock.getMe());
export const createOrg = (name) => (real ? post("orgs/", { name }) : mock.createOrg(name));

// --- analytics ----------------------------------------------------------------
export function listCalls(params) {
  if (!real) return mock.listCalls(params);
  return get("calls/", params).then((data) => ({
    ...data,
    // The API returns full URLs; the UI only needs to know whether a page exists.
    next: data.next ? Number(params.page || 1) + 1 : null,
    previous: data.previous ? Number(params.page || 1) - 1 : null,
  }));
}
export const getCall = (id) => (real ? get(`calls/${encodeURIComponent(id)}/`) : mock.getCall(id));
export const getStats = (days) => (real ? get("stats/", { days }) : mock.getStats(days));

// --- API keys and the inbound signing secret ----------------------------------
export const listApiKeys = () => (real ? get("api-keys/") : mock.listApiKeys());
export const createApiKey = (name) => (real ? post("api-keys/", { name }) : mock.createApiKey(name));
export const revokeApiKey = (id) => (real ? del(`api-keys/${id}/`) : mock.revokeApiKey(id));
export const getWebhookSecret = () => (real ? get("orgs/current/webhook-secret/") : mock.getWebhookSecret());
export const rotateWebhookSecret = () =>
  real ? post("orgs/current/webhook-secret/") : mock.rotateWebhookSecret();

// --- outbound webhook endpoints -----------------------------------------------
export const listEndpoints = () => (real ? get("webhook-endpoints/") : mock.listEndpoints());
export const createEndpoint = (data) => (real ? post("webhook-endpoints/", data) : mock.createEndpoint(data));
export const updateEndpoint = (id, data) =>
  real ? patch(`webhook-endpoints/${id}/`, data) : mock.updateEndpoint(id, data);
export const deleteEndpoint = (id) => (real ? del(`webhook-endpoints/${id}/`) : mock.deleteEndpoint(id));
export const rotateEndpointSecret = (id) =>
  real ? post(`webhook-endpoints/${id}/rotate-secret/`) : mock.rotateEndpointSecret(id);
export const testEndpoint = (id) => (real ? post(`webhook-endpoints/${id}/test/`) : mock.testEndpoint(id));
export const listDeliveries = (id) =>
  real ? get(`webhook-endpoints/${id}/deliveries/`) : mock.listDeliveries(id);

// --- billing ------------------------------------------------------------------
export const getBilling = () => (real ? get("billing/") : mock.getBilling());
export const changePlan = (plan) => (real ? post("billing/change-plan/", { plan }) : mock.changePlan(plan));

export const API_BASE = API_URL || "https://your-callflow-api.onrender.com";

// Agent names used by the seed data in both the API and the mock.
export const AGENTS = ["clinic-receptionist", "lead-qualifier", "loan-reminder", "order-support"];
