import { useState } from "react";
import { DEMO_MODE } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { navigate } from "../useHashRoute";

// Login and signup share one card; `mode` picks which fields are shown.
export default function AuthPage({ mode }) {
  const auth = useAuth();
  const isSignup = mode === "signup";
  const [form, setForm] = useState({
    email: DEMO_MODE ? "demo@callflow.dev" : "",
    password: DEMO_MODE ? "callflow-demo" : "",
    name: "",
    organization_name: "",
  });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (isSignup) await auth.signup(form);
      else await auth.login(form.email, form.password);
      navigate("");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-screen">
      <form className="card auth-card" onSubmit={submit}>
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          CallFlow
        </div>
        <h1>{isSignup ? "Create your workspace" : "Sign in"}</h1>
        <p className="muted">
          {isSignup
            ? "You will be the owner of a new organization on the Free plan."
            : "Call analytics for your voice agents."}
        </p>

        {DEMO_MODE && (
          <div className="notice">Demo mode: no backend is connected, so any email and password work.</div>
        )}

        {isSignup && (
          <>
            <label>
              Your name
              <input value={form.name} onChange={update("name")} autoComplete="name" />
            </label>
            <label>
              Organization name
              <input value={form.organization_name} onChange={update("organization_name")} required />
            </label>
          </>
        )}
        <label>
          Email
          <input type="email" value={form.email} onChange={update("email")} autoComplete="email" required />
        </label>
        <label>
          Password
          <input
            type="password"
            value={form.password}
            onChange={update("password")}
            autoComplete={isSignup ? "new-password" : "current-password"}
            minLength={isSignup ? 8 : undefined}
            required
          />
        </label>

        {error && <div className="error">{error}</div>}

        <button className="button button-primary" disabled={busy}>
          {busy ? "Please wait..." : isSignup ? "Create account" : "Sign in"}
        </button>

        <p className="muted small center">
          {isSignup ? (
            <>
              Already have an account? <a href="#/login">Sign in</a>
            </>
          ) : (
            <>
              New here? <a href="#/signup">Create an account</a>
            </>
          )}
        </p>
      </form>
    </div>
  );
}
