import { isAdmin, useAuth } from "../auth/AuthContext";

// The API enforces roles; this just explains it instead of showing 403s.
export default function AdminOnly({ children }) {
  const { org } = useAuth();
  if (isAdmin(org)) return children;
  return (
    <div className="card section-card">
      <h2>Admins only</h2>
      <p className="muted">
        You are a <b>{org?.role}</b> of {org?.name}. Ask an owner or admin to manage this.
      </p>
    </div>
  );
}
