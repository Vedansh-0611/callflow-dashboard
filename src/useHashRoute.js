import { useEffect, useState } from "react";

// Hash routing (#/billing) works on GitHub Pages without server rewrites.
const read = () => window.location.hash.replace(/^#\/?/, "").split("?")[0] || "";

export function useHashRoute() {
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const onChange = () => setRoute(read());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}

export const navigate = (route) => {
  window.location.hash = `#/${route}`;
};
