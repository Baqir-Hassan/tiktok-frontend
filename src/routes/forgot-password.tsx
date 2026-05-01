import { Link, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import "../sage.css";
import logoUrl from "../assets/logo.png";
import { api } from "../lib/api";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const submit = async () => {
    if (!email.trim()) {
      setError("Enter your email address.");
      setMessage("");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const result = await api.forgotPassword({ email: email.trim() });
      setMessage(result.message);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unable to request a reset email.";
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
          Forgot password
        </div>
        <div className="page-desc" style={{ marginBottom: 20 }}>
          Enter your email and we will send a reset link if the account is verified.
        </div>
        <div className="fg">
          <label>Email</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </div>
        {message && <div className="cost-pill">{message}</div>}
        {error && <div className="error-panel">{error}</div>}
        <button className="btn-primary" disabled={loading} onClick={submit}>
          {loading ? "Sending..." : "Send reset email"}
        </button>
        <div style={{ marginTop: 16 }}>
          <Link to="/" className="btn-cancel" style={{ display: "block", textAlign: "center", textDecoration: "none" }}>
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
