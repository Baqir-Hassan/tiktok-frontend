import { Link, createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useState } from "react";

import "../sage.css";
import logoUrl from "../assets/logo.png";
import { api } from "../lib/api";

export const Route = createFileRoute("/resend-verification")({
  component: ResendVerificationPage,
});

function ResendVerificationPage() {
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
      const result = await api.resendVerification({ email: email.trim() });
      setMessage(result.message);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unable to resend verification email.";
      setError(msg);
      setMessage("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthFormPage
      eyebrow="Email verification"
      title="Resend verification email"
      description="If your account exists and is still unverified, we will send a fresh verification link."
      footerLink={{ to: "/", label: "Back to sign in" }}
    >
      <div className="fg">
        <label>Email</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
      </div>
      {message && <div className="cost-pill">{message}</div>}
      {error && <div className="error-panel">{error}</div>}
      <button className="btn-primary" disabled={loading} onClick={submit}>
        {loading ? "Sending..." : "Send verification email"}
      </button>
    </AuthFormPage>
  );
}

function AuthFormPage({
  eyebrow,
  title,
  description,
  children,
  footerLink,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  footerLink: { to: string; label: string };
}) {
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
        <span className="slabel">{eyebrow}</span>
        <div className="page-title" style={{ marginBottom: 6 }}>
          {title}
        </div>
        <div className="page-desc" style={{ marginBottom: 20 }}>
          {description}
        </div>
        {children}
        <div style={{ marginTop: 16 }}>
          <Link to={footerLink.to} className="btn-cancel" style={{ display: "block", textAlign: "center", textDecoration: "none" }}>
            {footerLink.label}
          </Link>
        </div>
      </div>
    </div>
  );
}
