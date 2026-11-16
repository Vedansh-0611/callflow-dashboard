export function formatDuration(seconds) {
  const s = Math.round(seconds || 0);
  const m = Math.floor(s / 60);
  return m ? `${m}m ${String(s % 60).padStart(2, "0")}s` : `${s}s`;
}

export const formatUsd = (value, digits = 2) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value || 0);

export const formatNumber = (value) => new Intl.NumberFormat("en-IN").format(value || 0);

export const formatDateTime = (iso) =>
  new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export const formatTime = (iso) =>
  new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

export const formatDay = (date) =>
  new Date(date + "T00:00:00Z").toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

export const humanize = (text) => (text || "").replace(/[_.]/g, " ");
