import { useState } from "react";
import * as api from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { useAsync } from "../useAsync";
import { formatDateTime } from "../format";
import CopyField from "../components/CopyField";
import AdminOnly from "../components/AdminOnly";

const STATUS_PILL = { succeeded: "pill-completed", failed: "pill-failed", pending: "pill-in_progress" };

function DeliveryLog({ endpointId, version }) {
  const { data, loading, error } = useAsync(() => api.listDeliveries(endpointId), [endpointId, version]);
  if (error) return <div className="error">{error.message}</div>;
  if (loading && !data) return <div className="skeleton chart-skeleton small-skeleton" />;
  if (!data.length) return <p className="muted small">No deliveries yet.</p>;
  return (
    <div className="table-scroll">
      <table className="compact">
        <thead>
          <tr>
            <th>Event</th>
            <th>Status</th>
            <th className="num">Attempts</th>
            <th className="num">HTTP</th>
            <th>Sent</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.id} className="static-row">
              <td>
                <div>{d.event_type}</div>
                <div className="mono muted small">{d.event_id}</div>
              </td>
              <td>
                <span className={`pill ${STATUS_PILL[d.status]}`}>{d.status}</span>
                {d.last_error && <div className="muted small">{d.last_error}</div>}
              </td>
              <td className="num">{d.attempts}</td>
              <td className="num">{d.last_status_code ?? "-"}</td>
              <td className="nowrap">{formatDateTime(d.delivered_at || d.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EndpointCard({ endpoint, onChanged }) {
  const [secret, setSecret] = useState(null);
  const [logVersion, setLogVersion] = useState(0);
  const [message, setMessage] = useState(null);

  async function run(action) {
    setMessage(null);
    try {
      await action();
    } catch (err) {
      setMessage({ error: true, text: err.message });
    }
  }

  const toggle = () => run(async () => onChanged(await api.updateEndpoint(endpoint.id, { is_active: !endpoint.is_active })));
  const rotate = () =>
    run(async () => {
      if (!window.confirm("Rotate the signing secret? Your receiver must switch to the new one.")) return;
      setSecret((await api.rotateEndpointSecret(endpoint.id)).secret);
    });
  const ping = () =>
    run(async () => {
      await api.testEndpoint(endpoint.id);
      setMessage({ text: "Ping queued. It is retried with backoff if your endpoint is down." });
      // Give the worker a moment, then show the result in the log.
      setTimeout(() => setLogVersion((v) => v + 1), 1200);
    });
  const remove = () =>
    run(async () => {
      if (!window.confirm(`Delete ${endpoint.url}?`)) return;
      await api.deleteEndpoint(endpoint.id);
      onChanged(null);
    });

  return (
    <section className="card section-card">
      <div className="endpoint-head">
        <div>
          <div className="mono endpoint-url">{endpoint.url}</div>
          <div className="muted small">
            {endpoint.description || "No description"} &middot; {endpoint.events.join(", ")} &middot; added{" "}
            {formatDateTime(endpoint.created_at)}
          </div>
        </div>
        <span className={`pill ${endpoint.is_active ? "pill-completed" : "pill-in_progress"}`}>
          {endpoint.is_active ? "active" : "paused"}
        </span>
      </div>

      {secret && (
        <div className="reveal">
          <b>New signing secret.</b> Shown once; verify <code>X-Webhook-Signature</code> with it.
          <CopyField value={secret} label="Endpoint signing secret" />
        </div>
      )}
      {message && <div className={message.error ? "error" : "notice"}>{message.text}</div>}

      <div className="button-row">
        <button className="button" onClick={ping}>
          Send test ping
        </button>
        <button className="button" onClick={toggle}>
          {endpoint.is_active ? "Pause" : "Resume"}
        </button>
        <button className="button" onClick={rotate}>
          Rotate secret
        </button>
        <button className="button button-danger" onClick={remove}>
          Delete
        </button>
      </div>

      <h3 className="subheading">Recent deliveries</h3>
      <DeliveryLog endpointId={endpoint.id} version={logVersion} />
    </section>
  );
}

function NewEndpointForm({ onCreated }) {
  const [form, setForm] = useState({ url: "", description: "" });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onCreated(await api.createEndpoint({ ...form, events: ["call.summarized"] }));
      setForm({ url: "", description: "" });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="inline-form" onSubmit={submit}>
      <input
        type="url"
        placeholder="https://example.com/webhooks/callflow"
        value={form.url}
        onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
        required
      />
      <input
        placeholder="Description (optional)"
        value={form.description}
        onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
      />
      <button className="button button-primary" disabled={busy}>
        Add endpoint
      </button>
      {error && <div className="error full">{error}</div>}
    </form>
  );
}

export default function WebhooksPage() {
  const { org } = useAuth();
  const [version, setVersion] = useState(0);
  const [created, setCreated] = useState(null);
  const endpoints = useAsync(() => api.listEndpoints(), [version]);
  const reload = () => setVersion((v) => v + 1);

  return (
    <>
      <div className="page-header">
        <div>
          <h2 className="page-title">Webhooks</h2>
          <p className="subtitle">
            Get a signed <code>call.summarized</code> event at your URL as soon as the cost and outcome of a call are ready.
          </p>
        </div>
      </div>

      <AdminOnly>
        <section className="card section-card">
          <h2>Add an endpoint for {org.name}</h2>
          <NewEndpointForm
            onCreated={(endpoint) => {
              setCreated(endpoint);
              reload();
            }}
          />
          {created && (
            <div className="reveal">
              <b>Signing secret for {created.url}.</b> Copy it now; it is not shown again.
              <CopyField value={created.secret} label="Endpoint signing secret" />
              <button className="button button-small" onClick={() => setCreated(null)}>
                Done
              </button>
            </div>
          )}
          <details className="how-to">
            <summary>How to verify our signature</summary>
            <pre className="code-block">{`# Python: reject the request unless this returns True
import hashlib, hmac, time

def is_valid(secret, headers, raw_body, tolerance=300):
    ts = headers["X-Webhook-Timestamp"]
    if abs(time.time() - int(ts)) > tolerance:
        return False
    expected = hmac.new(secret.encode(), f"{ts}.".encode() + raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, headers["X-Webhook-Signature"].removeprefix("sha256="))

# Use X-CallFlow-Delivery (the event id) to ignore retries you already processed.`}</pre>
          </details>
        </section>

        {endpoints.error && <div className="error">{endpoints.error.message}</div>}
        {endpoints.data?.map((endpoint) => (
          <EndpointCard key={endpoint.id} endpoint={endpoint} onChanged={reload} />
        ))}
        {endpoints.data?.length === 0 && (
          <div className="card section-card empty">No endpoints yet. Add one above to receive events.</div>
        )}
      </AdminOnly>
    </>
  );
}
