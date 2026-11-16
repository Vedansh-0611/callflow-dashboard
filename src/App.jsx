import { useEffect } from "react";
import { useAuth } from "./auth/AuthContext";
import { navigate, useHashRoute } from "./useHashRoute";
import AppShell from "./components/AppShell";
import AuthPage from "./pages/AuthPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import ApiKeysPage from "./pages/ApiKeysPage";
import WebhooksPage from "./pages/WebhooksPage";
import BillingPage from "./pages/BillingPage";

const PAGES = { "": AnalyticsPage, "api-keys": ApiKeysPage, webhooks: WebhooksPage, billing: BillingPage };
const PUBLIC = ["login", "signup"];

export default function App() {
  const route = useHashRoute();
  const { booting, session, org } = useAuth();

  // Signed out: only the auth screens. Signed in: no auth screens.
  useEffect(() => {
    if (booting) return;
    if (!session && !PUBLIC.includes(route)) navigate("login");
    if (session && PUBLIC.includes(route)) navigate("");
  }, [booting, session, route]);

  if (booting) return <div className="boot">Loading demo workspace...</div>;
  if (!session) return <AuthPage mode={route === "signup" ? "signup" : "login"} />;

  const current = route in PAGES ? route : "";
  const Page = PAGES[current];
  return (
    <AppShell route={current}>
      {/* Remount the page on org switch so nothing from the previous org lingers. */}
      {org ? <Page key={org.slug} /> : <div className="error">You do not belong to any organization yet.</div>}
    </AppShell>
  );
}
