import { Link, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import "../sage.css";
import logoUrl from "../assets/logo.png";
import { api } from "../lib/api";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const search = Route.useSearch() as { token?: string };
  const token = search.token?.trim() ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(!token ? "Missing reset token." : "");

  const submit = async () => {
    if (!token) {
      setError("Missing reset token.");
      return;
    }
    if (!password || password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const result = await api.resetPassword({ token, new_password: password });
      setMessage(result.message);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unable to reset password.";
      setError(msg);
      setMessage("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="grid-bg" />
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-mark">
            <img src={logoUrl} alt="Sage Studio logo" width={28} height={28} />
          </div>
          <h1>
            Sage <span>Studio</span>
          </h1>
          <p>Account access and verification</p>
        </div>
        <span className="slabel">Password reset</span>
        <div className="page-title" style={{ marginBottom: 6 }}>
          Reset password
        </div>
        <div className="page-desc" style={{ marginBottom: 20 }}>
          Choose a new password for your account.
        </div>
        {message ? (
          <>
            <div className="cost-pill">{message}</div>
            <Link to="/" className="btn-submit" style={{ display: "block", textAlign: "center", textDecoration: "none" }}>
              Go to sign in
            </Link>
          </>
        ) : (
          <>
            <div className="fg">
              <label>New password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" />
            </div>
            <div className="fg">
              <label>Confirm password</label>
              <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Repeat your new password" />
            </div>
            {error && <div className="error-panel">{error}</div>}
            <button className="btn-primary" disabled={loading || !token} onClick={submit}>
              {loading ? "Saving..." : "Reset password"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
