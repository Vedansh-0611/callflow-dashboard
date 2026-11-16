import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import * as api from "../api/client";
import { clearSession, getSession, setSession, updateSession } from "../api/session";

const AuthContext = createContext(null);

function sessionFrom({ access, refresh, user }, preferredOrg) {
  const orgs = user.organizations || [];
  const org = orgs.find((o) => o.slug === preferredOrg)?.slug || orgs[0]?.slug || null;
  return { access, refresh, user, org };
}

export function AuthProvider({ children }) {
  const [session, setState] = useState(getSession);
  // The demo signs itself in, so the live link opens straight on the dashboard.
  const [booting, setBooting] = useState(api.DEMO_MODE && !getSession());

  const apply = useCallback((next) => {
    setSession(next);
    setState(next);
  }, []);

  useEffect(() => {
    if (!booting) return;
    api.login("demo@callflow.dev", "demo").then((tokens) => {
      apply(sessionFrom(tokens));
      setBooting(false);
    });
  }, [booting, apply]);

  // http.js signals when the refresh token is no longer valid.
  useEffect(() => {
    const onSignedOut = () => setState(null);
    window.addEventListener("callflow:signed-out", onSignedOut);
    return () => window.removeEventListener("callflow:signed-out", onSignedOut);
  }, []);

  const value = useMemo(() => {
    const orgs = session?.user?.organizations || [];
    return {
      booting,
      session,
      user: session?.user || null,
      orgs,
      org: orgs.find((o) => o.slug === session?.org) || null,
      async login(email, password) {
        apply(sessionFrom(await api.login(email, password)));
      },
      async signup(form) {
        apply(sessionFrom(await api.signup(form)));
      },
      logout() {
        clearSession();
        setState(null);
      },
      switchOrg(slug) {
        updateSession({ org: slug });
        setState((s) => ({ ...s, org: slug }));
      },
      async createOrg(name) {
        const created = await api.createOrg(name);
        const user = await api.getMe();
        updateSession({ user, org: created.slug });
        setState((s) => ({ ...s, user, org: created.slug }));
      },
    };
  }, [session, booting, apply]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
export const isAdmin = (org) => org && (org.role === "owner" || org.role === "admin");
