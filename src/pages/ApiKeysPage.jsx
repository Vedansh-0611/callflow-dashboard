import { useState } from "react";
import * as api from "../api/client";
import { isAdmin, useAuth } from "../auth/AuthContext";
import { useAsync } from "../useAsync";
import { formatDateTime } from "../format";
import CopyField from "../components/CopyField";
import AdminOnly from "../components/AdminOnly";

const relative = (iso) => (iso ? formatDateTime(iso) : "Never");

function NewKeyForm({ onCreated }) {
  const [name, setName] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onCreated(await api.createApiKey(name.trim()));
      setName("");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="inline-form" onSubmit={submit}>
      <input placeholder="Key name, e.g. Production ingest" value={name} onChange={(e) => setName(e.target.value)} required />
      <button className="button button-primary" disabled={busy}>
        Create key
      </button>
      {error && <div className="error full">{error}</div>}
    </form>
  );
}

function IngestionSecret() {
  const [version, setVersion] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const { data, error } = useAsync(() => api.getWebhookSecret(), [version]);

  async function rotate() {
    if (!window.confirm("Rotate the signing secret? The old one keeps working for 24 hours.")) return;
    await api.rotateWebhookSecret();
    setRevealed(true);
    setVersion((v) => v + 1);
  }

  return (
    <section className="card section-card">
      <h2>Webhook signing secret</h2>
      <p className="muted">
        Your telephony provider signs each webhook with this secret (HMAC-SHA256 over{" "}
        <code>timestamp.body</code>). Requests with a wrong or stale signature are rejected.
      </p>
      {error && <div className="error">{error.message}</div>}
      {data && (
        <>
          {revealed ? (
            <CopyField value={data.webhook_secret} label="Webhook signing secret" />
          ) : (
            <div className="copy-field">
              <code>whsec_••••••••••••••••••••</code>
              <button className="button button-small" onClick={() => setRevealed(true)}>
                Reveal
              </button>
            </div>
          )}
          {data.previous_secret_expires_at && (
            <p className="muted small">
              The previous secret is accepted until {formatDateTime(data.previous_secret_expires_at)}.
            </p>
          )}
          <button className="button" onClick={rotate}>
            Rotate secret
          </button>
        </>
      )}
    </section>
  );
}

export default function ApiKeysPage() {
  const { org } = useAuth();
  const [version, setVersion] = useState(0);
  const [created, setCreated] = useState(null);
  const keys = useAsync(() => (isAdmin(org) ? api.listApiKeys() : Promise.resolve([])), [version]);

  async function revoke(key) {
    if (!window.confirm(`Revoke "${key.name}"? Requests using it will start failing right away.`)) return;
    await api.revokeApiKey(key.id);
    setVersion((v) => v + 1);
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h2 className="page-title">API keys</h2>
          <p className="subtitle">Server-to-server credentials for sending webhooks and reading data.</p>
        </div>
      </div>

      <AdminOnly>
        <section className="card section-card">
          <h2>Keys for {org.name}</h2>
          <NewKeyForm
            onCreated={(key) => {
              setCreated(key);
              setVersion((v) => v + 1);
            }}
          />

          {created && (
            <div className="reveal">
              <b>Copy your new key now.</b> It is stored hashed, so this is the only time it is shown.
              <CopyField value={created.key} label="New API key" />
              <button className="button button-small" onClick={() => setCreated(null)}>
                I have saved it
              </button>
            </div>
          )}

          {keys.error && <div className="error">{keys.error.message}</div>}
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Key</th>
                  <th>Created</th>
                  <th>Last used</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {keys.data?.map((key) => (
                  <tr key={key.id} className="static-row">
                    <td>
                      {key.name}
                      <div className="muted small">{key.created_by || "seed"}</div>
                    </td>
                    <td className="mono">{key.prefix}_••••</td>
                    <td className="nowrap">{formatDateTime(key.created_at)}</td>
                    <td className="nowrap">{relative(key.last_used_at)}</td>
                    <td>
                      <span className={`pill ${key.revoked_at ? "pill-failed" : "pill-completed"}`}>
                        {key.revoked_at ? "revoked" : "active"}
                      </span>
                    </td>
                    <td className="num">
                      {!key.revoked_at && (
                        <button className="button button-small button-danger" onClick={() => revoke(key)}>
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {keys.data?.length === 0 && (
                  <tr>
                    <td colSpan={6} className="empty">
                      No keys yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <IngestionSecret />

        <section className="card section-card">
          <h2>Send a test event</h2>
          <p className="muted">Each webhook needs your API key and a signature made with the secret above.</p>
          <pre className="code-block">{`BODY='{"event_id":"evt_1","type":"call.started","call_id":"call_1","timestamp":"2026-01-10T10:00:00Z","data":{"agent_id":"support-bot"}}'
TS=$(date +%s)
SIG=$(printf '%s.%s' "$TS" "$BODY" | openssl dgst -sha256 -hmac "$WEBHOOK_SECRET" | cut -d' ' -f2)

curl -X POST ${api.API_BASE}/api/webhooks/calls/ \\
  -H "X-API-Key: $CALLFLOW_API_KEY" \\
  -H "X-Webhook-Timestamp: $TS" \\
  -H "X-Webhook-Signature: sha256=$SIG" \\
  -H "Content-Type: application/json" -d "$BODY"`}</pre>
        </section>
      </AdminOnly>
    </>
  );
}
