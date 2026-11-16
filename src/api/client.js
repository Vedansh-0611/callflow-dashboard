// One small API surface for the UI. With VITE_API_URL set it talks to the real
// Django API; otherwise it uses the bundled mock data (the GitHub Pages demo).
import * as mock from "./mockApi";

const API_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
const API_KEY = import.meta.env.VITE_API_KEY || "";

export const usingMockData = !API_URL;

async function get(path, params = {}) {
  const query = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== "" && v != null));
  const response = await fetch(`${API_URL}/api/${path}?${query}`, {
    headers: API_KEY ? { "X-API-Key": API_KEY } : {},
  });
  if (!response.ok) throw new Error(`API error ${response.status}`);
  return response.json();
}

export function listCalls(params) {
  if (usingMockData) return mock.listCalls(params);
  return get("calls/", params).then((data) => ({
    ...data,
    // The API returns full URLs; the UI only needs to know whether a page exists.
    next: data.next ? Number(params.page || 1) + 1 : null,
    previous: data.previous ? Number(params.page || 1) - 1 : null,
  }));
}

export function getCall(id) {
  return usingMockData ? mock.getCall(id) : get(`calls/${encodeURIComponent(id)}/`);
}

export function getStats(days) {
  return usingMockData ? mock.getStats(days) : get("stats/", { days });
}

// Agent names used by the seed data in both the API and the mock.
export const AGENTS = ["clinic-receptionist", "lead-qualifier", "loan-reminder", "order-support"];
