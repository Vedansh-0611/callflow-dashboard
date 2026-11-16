// Where the signed-in session lives: tokens, the user, and the selected org.
// localStorage keeps people signed in across reloads. Access tokens are short
// lived (15 min) and refreshed automatically by http.js.
const KEY = "callflow.session";

let session = load();

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || null;
  } catch {
    return null;
  }
}

function save() {
  try {
    if (session) localStorage.setItem(KEY, JSON.stringify(session));
    else localStorage.removeItem(KEY);
  } catch {
    // Private mode or blocked storage: the session just won't survive a reload.
  }
}

export const getSession = () => session;

export function setSession(next) {
  session = next;
  save();
}

export function updateSession(patch) {
  session = session ? { ...session, ...patch } : null;
  save();
}

export function clearSession() {
  session = null;
  save();
}

export const currentOrgSlug = () => session?.org || null;
