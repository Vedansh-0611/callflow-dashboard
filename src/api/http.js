// Thin fetch wrapper for the real API: adds the JWT and X-Organization headers,
// refreshes an expired access token once, and turns error bodies into messages.
import { clearSession, getSession, updateSession } from "./session";

export const API_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(status, body) {
    super(messageFrom(status, body));
    this.status = status;
    this.body = body;
  }
}

function messageFrom(status, body) {
  if (body?.detail) return body.detail;
  if (body && typeof body === "object") {
    // DRF validation errors: {"field": ["message"]}
    const [field, errors] = Object.entries(body)[0] || [];
    if (field) return `${field}: ${[].concat(errors).join(" ")}`;
  }
  return `Request failed (${status})`;
}

let refreshing = null;

async function refreshAccessToken() {
  const refresh = getSession()?.refresh;
  if (!refresh) return false;
  // Several requests can fail at once; share one refresh call between them.
  refreshing ??= fetch(`${API_URL}/api/auth/refresh/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh }),
  })
    .then(async (res) => {
      if (!res.ok) return false;
      updateSession({ access: (await res.json()).access });
      return true;
    })
    .catch(() => false)
    .finally(() => (refreshing = null));
  return refreshing;
}

export async function request(method, path, { params, body, auth = true } = {}, retried = false) {
  const query = params
    ? "?" + new URLSearchParams(Object.entries(params).filter(([, v]) => v !== "" && v != null))
    : "";
  const session = getSession();
  const headers = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth && session?.access) headers.Authorization = `Bearer ${session.access}`;
  if (auth && session?.org) headers["X-Organization"] = session.org;

  const res = await fetch(`${API_URL}/api/${path}${query}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (res.status === 401 && auth && !retried) {
    if (await refreshAccessToken()) return request(method, path, { params, body, auth }, true);
    clearSession();
    window.dispatchEvent(new Event("callflow:signed-out"));
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data);
  return data;
}

export const get = (path, params) => request("GET", path, { params });
export const post = (path, body = {}) => request("POST", path, { body });
export const patch = (path, body) => request("PATCH", path, { body });
export const del = (path) => request("DELETE", path);
