import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import "../sage.css";
import logoUrl from "../assets/logo.png";
import { api } from "../lib/api";

export const Route = createFileRoute("/verify-email")({
  component: VerifyEmailPage,
});

type Status = "loading" | "success" | "error";

function VerifyEmailPage() {
  const search = Route.useSearch() as { token?: string };
  const token = search.token?.trim() ?? "";
  const [status, setStatus] = useState<Status>(token ? "loading" : "error");
  const [message, setMessage] = useState(token ? "Verifying your email..." : "Missing verification token.");

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    (async () => {
      try {
        const result = await api.verifyEmail({ token });
        if (cancelled) return;
        setStatus("success");
        setMessage(result.message);
      } catch (err: unknown) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : "Unable to verify your email right now.";
        setStatus("error");
        setMessage(msg);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <AuthStatusPage
      eyebrow="Email verification"
      title={status === "success" ? "Email verified" : status === "loading" ? "Verifying your email" : "Verification failed"}
      description={message}
      primaryLabel={status === "success" ? "Go to sign in" : "Try resend verification"}
      primaryTo={status === "success" ? "/" : "/resend-verification"}
      secondaryLabel="Back to home"
      secondaryTo="/"
    />
  );
}

function AuthStatusPage({
  eyebrow,
  title,
  description,
  primaryLabel,
  primaryTo,
  secondaryLabel,
  secondaryTo,
}: {
  eyebrow: string;
  title: string;
  description: string;
  primaryLabel: string;
  primaryTo: string;
  secondaryLabel: string;
  secondaryTo: string;
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
        <div className="page-title" style={{ marginBottom: 10 }}>
          {title}
        </div>
        <div className="page-desc" style={{ marginBottom: 24 }}>
          {description}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link to={primaryTo} className="btn-submit" style={{ justifyContent: "center", textDecoration: "none" }}>
            {primaryLabel}
          </Link>
          <Link to={secondaryTo} className="btn-cancel" style={{ textAlign: "center", textDecoration: "none" }}>
            {secondaryLabel}
          </Link>
        </div>
      </div>
    </div>
  );
}
