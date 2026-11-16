import { DEMO_MODE } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { navigate } from "../useHashRoute";

export const NAV = [
  { route: "", label: "Analytics" },
  { route: "api-keys", label: "API keys" },
  { route: "webhooks", label: "Webhooks" },
  { route: "billing", label: "Usage & plan" },
];

function OrgSwitcher() {
  const { orgs, org, switchOrg, createOrg } = useAuth();

  async function onChange(e) {
    if (e.target.value !== "__new__") return switchOrg(e.target.value);
    const name = window.prompt("Name of the new organization");
    if (name?.trim()) await createOrg(name.trim());
  }

  return (
    <label className="org-switcher">
      <span className="sr-only">Organization</span>
      <select value={org?.slug || ""} onChange={onChange}>
        {orgs.map((o) => (
          <option key={o.slug} value={o.slug}>
            {o.name} ({o.role})
          </option>
        ))}
        <option value="__new__">+ New organization</option>
      </select>
    </label>
  );
}

export default function AppShell({ route, children }) {
  const { user, logout } = useAuth();

  return (
    <>
      {DEMO_MODE && (
        <div className="demo-banner" role="status">
          <b>Demo mode.</b> You are signed in to sample workspaces with mock data; changes stay in this browser tab.{" "}
          <a href="https://github.com/Vedansh-0611/callflow-analytics-api">Run the real API</a>
        </div>
      )}
      <div className="app">
        <header className="header">
          <div className="header-left">
            <div className="brand">
              <span className="brand-mark" aria-hidden="true" />
              CallFlow
            </div>
            <OrgSwitcher />
          </div>
          <div className="header-actions">
            <span className="muted small user-email">{user?.email}</span>
            <button
              className="button button-small"
              onClick={() => {
                logout();
                navigate("login");
              }}
            >
              Sign out
            </button>
          </div>
        </header>

        <nav className="tabs" aria-label="Sections">
          {NAV.map((item) => (
            <a key={item.route} href={`#/${item.route}`} className={route === item.route ? "active" : ""}>
              {item.label}
            </a>
          ))}
        </nav>

        {children}

        <footer className="footer">
          CallFlow dashboard, frontend for{" "}
          <a href="https://github.com/Vedansh-0611/callflow-analytics-api">callflow-analytics-api</a> (Django, DRF,
          Celery). Source on <a href="https://github.com/Vedansh-0611/callflow-dashboard">GitHub</a>.
        </footer>
      </div>
    </>
  );
}
