import { useState } from "react";
import * as api from "../api/client";
import { isAdmin, useAuth } from "../auth/AuthContext";
import { useAsync } from "../useAsync";
import { formatNumber } from "../format";
import UsageMeter from "../components/UsageMeter";

const price = (cents) => `$${cents / 100}/mo`;
// unit is [singular, plural], e.g. ["API key", "API keys"]
const limit = (value, [one, many]) =>
  value == null ? `Unlimited ${many}` : `${formatNumber(value)} ${value === 1 ? one : many}`;
const monthName = (period) =>
  new Date(period + "T00:00:00Z").toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });

function resetDate(period) {
  const start = new Date(period + "T00:00:00Z");
  const next = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
  return next.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
}

export default function BillingPage() {
  const { org } = useAuth();
  const [version, setVersion] = useState(0);
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(null);
  const { data, error } = useAsync(() => api.getBilling(), [version]);

  async function switchTo(plan) {
    setBusy(plan.code);
    setMessage(null);
    try {
      const response = await api.changePlan(plan.code);
      if (response.result.redirect_url) {
        // A real payment provider sends the user to its checkout page.
        window.location.href = response.result.redirect_url;
        return;
      }
      setMessage(`${org.name} is now on the ${plan.name} plan.`);
      setVersion((v) => v + 1);
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h2 className="page-title">Usage & plan</h2>
          <p className="subtitle">Metered per calendar month (UTC). New calls past a limit get HTTP 402.</p>
        </div>
      </div>

      {error && <div className="error">{error.message}</div>}
      {message && <div className="notice">{message}</div>}

      {data && (
        <>
          <section className="card section-card">
            <div className="plan-head">
              <div>
                <span className="kpi-label">Current plan</span>
                <div className="plan-name">
                  {data.plan.name} <span className="muted">{price(data.plan.price_cents_per_month)}</span>
                </div>
              </div>
              <span className="muted small">
                {monthName(data.usage.period)} &middot; resets {resetDate(data.usage.period)}
              </span>
            </div>
            <div className="meters">
              <UsageMeter label="Calls" used={data.usage.calls} limit={data.plan.monthly_call_limit} unit="calls" />
              <UsageMeter
                label="Call minutes"
                used={data.usage.billed_minutes}
                limit={data.plan.monthly_minute_limit}
                unit="minutes"
              />
            </div>
            <p className="muted small">
              API rate limit: {data.plan.api_requests_per_minute} requests per minute per key (HTTP 429 beyond that).
            </p>
          </section>

          <section className="plans">
            {data.plans.map((plan) => {
              const current = plan.code === data.plan.code;
              return (
                <div key={plan.code} className={`card plan-card ${current ? "plan-current" : ""}`}>
                  <div className="plan-card-head">
                    <h2>{plan.name}</h2>
                    <span className="plan-price">{price(plan.price_cents_per_month)}</span>
                  </div>
                  <ul>
                    <li>{limit(plan.monthly_call_limit, ["call / month", "calls / month"])}</li>
                    <li>{limit(plan.monthly_minute_limit, ["call minute / month", "call minutes / month"])}</li>
                    <li>{plan.api_requests_per_minute} API requests / minute</li>
                    <li>{limit(plan.max_api_keys, ["API key", "API keys"])}</li>
                    <li>{limit(plan.max_webhook_endpoints, ["webhook endpoint", "webhook endpoints"])}</li>
                  </ul>
                  {current ? (
                    <span className="badge">Current plan</span>
                  ) : (
                    <button
                      className="button button-primary"
                      disabled={!isAdmin(org) || busy === plan.code}
                      onClick={() => switchTo(plan)}
                      title={isAdmin(org) ? "" : "Only owners and admins can change plans"}
                    >
                      {busy === plan.code ? "Switching..." : `Switch to ${plan.name}`}
                    </button>
                  )}
                </div>
              );
            })}
          </section>
          <p className="muted small">
            Billing runs through a provider interface. This build uses a fake provider that switches plans
            instantly, with no payment.
          </p>

          <section className="card section-card">
            <h2>Usage history</h2>
            <div className="table-scroll">
              <table className="compact">
                <thead>
                  <tr>
                    <th>Month</th>
                    <th className="num">Calls</th>
                    <th className="num">Billed minutes</th>
                  </tr>
                </thead>
                <tbody>
                  {data.history.map((row) => (
                    <tr key={row.period} className="static-row">
                      <td>{monthName(row.period)}</td>
                      <td className="num">{formatNumber(row.calls)}</td>
                      <td className="num">{formatNumber(row.billed_minutes)}</td>
                    </tr>
                  ))}
                  {data.history.length === 0 && (
                    <tr>
                      <td colSpan={3} className="empty">
                        No usage yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </>
  );
}
