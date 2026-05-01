import { Link, createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import "../sage.css";
import logoUrl from "../assets/logo.png";
import {
  api,
  type AdminCreditAdjustmentResponse,
  type AdminUserDetailResponse,
  type AdminUserResponse,
} from "../lib/api";

export const Route = createFileRoute("/")({
  component: SageApp,
  head: () => ({
    meta: [
      { title: "Sage Studio - Turn any story into a viral video" },
      {
        name: "description",
        content:
          "Sage Studio handles the script, voiceover, subtitles, and Minecraft background automatically.",
      },
    ],
  }),
});

type Stage =
  | "scraping"
  | "generating_script"
  | "generating_tts"
  | "generating_subtitles"
  | "rendering_video";

type Log = { stage: Stage | string; msg: string; time: string };
type Status = "queued" | "processing" | "completed" | "failed";
type Page = "dashboard" | "detail" | "credits" | "settings" | "admin";
type ToastType = "success" | "error" | "info";
type ToastItem = { id: number; type: ToastType; msg: string; show: boolean };
type AdminTarget = AdminUserResponse | AdminUserDetailResponse;

type Job = {
  id: number;
  title: string;
  subreddit: string;
  status: Status;
  created: string;
  started: string | null;
  completed: string | null;
  tts: string;
  video: boolean;
  video_url: string | null;
  access_url: string | null;
  error?: string;
  logs: Log[];
};

const ICONS: Record<ToastType, string> = { success: "OK", error: "X", info: "i" };

const USAGE = [
  { job: "TIFU by accidentally sending...", date: "Apr 29" },
  { job: "Custom: The night I got lost...", date: "Apr 29" },
  { job: "AskReddit: What career did...", date: "Apr 29" },
  { job: "NoSleep: The knock at 3am", date: "Apr 28" },
];

function mapBackendStatus(status: string): Status {
  if (status === "completed") return "completed";
  if (status === "failed") return "failed";
  if (status === "queued") return "queued";
  return "processing";
}

function formatRelativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso.endsWith("Z") ? iso : `${iso}Z`).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

function Waveform({ size = "small" }: { size?: "small" | "large" }) {
  const bars = size === "large" ? 28 : 10;
  const maxH = size === "large" ? 28 : 14;
  const barW = size === "large" ? 3 : 2;
  const gap = size === "large" ? 3 : 2;
  const heights = Array.from({ length: bars }, (_, i) => {
    const mid = bars / 2;
    const dist = Math.abs(i - mid) / mid;
    return Math.max(3, Math.round(maxH * (1 - dist * 0.6)));
  });
  return (
    <div className="waveform" style={{ gap: `${gap}px` }}>
      {heights.map((h, i) => (
        <div
          key={i}
          className="wave-bar"
          style={{
            height: `${h}px`,
            width: `${barW}px`,
            animation: `wave ${0.7 + i * 0.04}s ease-in-out ${i * 0.05}s infinite alternate`,
          }}
        />
      ))}
    </div>
  );
}

function SageApp() {
  const [view, setView] = useState<"landing" | "auth" | "app">("landing");
  const [authTab, setAuthTab] = useState<"login" | "signup">("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPass, setAuthPass] = useState("");
  const [authConfirm, setAuthConfirm] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  const [userEmail, setUserEmail] = useState("user@example.com");
  const [userCredits, setUserCredits] = useState(0);
  const [userIsAdmin, setUserIsAdmin] = useState(false);
  const [page, setPage] = useState<Page>("dashboard");

  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeJobId, setActiveJobId] = useState<number | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [mode, setMode] = useState<"reddit" | "custom">("reddit");
  const [inpSub, setInpSub] = useState("");
  const [inpTitle, setInpTitle] = useState("");
  const [inpStory, setInpStory] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [notifOn, setNotifOn] = useState(true);
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwSaving, setPwSaving] = useState(false);

  const [adminQuery, setAdminQuery] = useState("");
  const [adminSearching, setAdminSearching] = useState(false);
  const [adminResults, setAdminResults] = useState<AdminUserResponse[]>([]);
  const [adminTarget, setAdminTarget] = useState<AdminTarget | null>(null);
  const [adminHistory, setAdminHistory] = useState<AdminCreditAdjustmentResponse[]>([]);
  const [adminLoadingDetail, setAdminLoadingDetail] = useState(false);
  const [adminApplying, setAdminApplying] = useState(false);
  const [adminSetCredits, setAdminSetCredits] = useState("");
  const [adminSetReason, setAdminSetReason] = useState("");
  const [adminDelta, setAdminDelta] = useState("");
  const [adminDeltaReason, setAdminDeltaReason] = useState("");

  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastIdRef = useRef(0);

  const toast = useCallback((msg: string, type: ToastType = "success", dur = 3500) => {
    const id = ++toastIdRef.current;
    setToasts((prev) => [...prev, { id, type, msg, show: false }]);
    requestAnimationFrame(() =>
      requestAnimationFrame(() =>
        setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, show: true } : t))),
      ),
    );
    setTimeout(() => {
      setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, show: false } : t)));
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 300);
    }, dur);
  }, []);

  const closeToast = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const hydrateCurrentUser = useCallback(async () => {
    const user = await api.getCurrentUser();
    setUserEmail(user.email);
    setUserCredits(user.credits);
    setUserIsAdmin(user.is_admin);
    return user;
  }, []);

  const loadJobs = useCallback(async () => {
    setLoading(true);
    try {
      const backendJobs = await api.getJobs();
      const mapped: Job[] = backendJobs.map((j) => ({
        id: j.id,
        title: j.source_title || j.subreddit || "Untitled",
        subreddit: j.subreddit,
        status: mapBackendStatus(j.status),
        created: formatRelativeTime(j.created_at),
        started: j.started_at ? formatRelativeTime(j.started_at) : null,
        completed: j.completed_at ? formatRelativeTime(j.completed_at) : null,
        tts: j.tts_provider,
        video: j.status === "completed" || !!j.video_url || !!j.uploaded_video_url,
        video_url: null,
        access_url: null,
        error: j.error_message || undefined,
        logs: [],
      }));
      setJobs(mapped);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load jobs";
      toast(msg, "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const loadAdminTarget = useCallback(
    async (userId: number) => {
      setAdminLoadingDetail(true);
      try {
        const [user, history] = await Promise.all([
          api.getAdminUser(userId),
          api.getAdminUserCreditHistory(userId, 20),
        ]);
        setAdminTarget(user);
        setAdminHistory(history);
        setAdminSetCredits(String(user.credits));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to load user details";
        toast(msg, "error");
      } finally {
        setAdminLoadingDetail(false);
      }
    },
    [toast],
  );

  useEffect(() => {
    if (!api.isAuthenticated()) return;
    let cancelled = false;
    (async () => {
      try {
        const user = await hydrateCurrentUser();
        if (cancelled) return;
        setView("app");
        setPage("dashboard");
        await loadJobs();
        if (user.is_admin) {
          setAdminQuery(user.email.slice(0, 2));
        }
      } catch {
        api.clearToken();
        if (!cancelled) {
          setView("landing");
          setUserIsAdmin(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrateCurrentUser, loadJobs]);

  const goAuth = (tab: "login" | "signup") => {
    setAuthTab(tab);
    setView("auth");
  };

  const doAuth = async () => {
    if (!authEmail || !authPass) {
      toast("Please fill in all fields", "error");
      return;
    }
    if (authTab === "signup" && authPass !== authConfirm) {
      toast("Passwords do not match", "error");
      return;
    }

    setAuthLoading(true);
    try {
      if (authTab === "login") {
        await api.login({ email: authEmail, password: authPass });
        const user = await hydrateCurrentUser();
        setView("app");
        setPage("dashboard");
        await loadJobs();
        toast(user.is_admin ? "Welcome back to Sage Studio Admin" : "Welcome back to Sage Studio");
      } else {
        const result = await api.register({ email: authEmail, password: authPass });
        setAuthTab("login");
        toast(result.message, "success", 5000);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Authentication failed";
      toast(msg, "error");
    } finally {
      setAuthLoading(false);
    }
  };

  const logout = () => {
    api.clearToken();
    setView("landing");
    setPage("dashboard");
    setUserEmail("user@example.com");
    setUserCredits(0);
    setUserIsAdmin(false);
    setJobs([]);
    setLoading(true);
    setActiveJobId(null);
    setAdminResults([]);
    setAdminTarget(null);
    setAdminHistory([]);
    toast("Logged out successfully", "info");
  };

  const showPage = (nextPage: Page) => {
    if (nextPage === "admin" && !userIsAdmin) {
      toast("Only admin accounts can access the admin dashboard", "error");
      return;
    }
    setPage(nextPage);
    setModalOpen(false);
  };

  const openDetail = async (id: number) => {
    setActiveJobId(id);
    setPage("detail");
    try {
      const detail = await api.getJob(id);
      const mapped: Job = {
        id: detail.id,
        title: detail.source_title || detail.subreddit || "Untitled",
        subreddit: detail.subreddit,
        status: mapBackendStatus(detail.status),
        created: formatRelativeTime(detail.created_at),
        started: detail.started_at ? formatRelativeTime(detail.started_at) : null,
        completed: detail.completed_at ? formatRelativeTime(detail.completed_at) : null,
        tts: detail.tts_provider,
        video: detail.status === "completed" || !!detail.video_url || !!detail.uploaded_video_url,
        video_url: null,
        access_url: null,
        error: detail.error_message || undefined,
        logs: (detail.logs || []).map((l) => ({
          stage: l.stage,
          msg: l.message,
          time: new Date(l.timestamp.endsWith("Z") ? l.timestamp : `${l.timestamp}Z`).toLocaleTimeString(
            [],
            { hour: "2-digit", minute: "2-digit" },
          ),
        })),
      };
      if (mapped.video && mapped.status === "completed") {
        try {
          const access = await api.getJobAccess(id);
          mapped.video_url = access.url;
          mapped.access_url = access.url;
        } catch (accessErr: unknown) {
          const msg = accessErr instanceof Error ? accessErr.message : "Failed to load secure video access";
          toast(msg, "error");
        }
      }
      setJobs((prev) => prev.map((j) => (j.id === id ? mapped : j)));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load job details";
      toast(msg, "error");
    }
  };

  const submitJob = async () => {
    let subreddit: string;
    let customTitle: string | undefined;
    let customStory: string | undefined;
    if (mode === "reddit") {
      const value = inpSub.trim();
      if (!value) {
        toast("Please enter a subreddit name", "error");
        return;
      }
      subreddit = value;
    } else {
      const title = inpTitle.trim();
      const story = inpStory.trim();
      if (!title || !story) {
        toast("Please fill in both title and story", "error");
        return;
      }
      subreddit = "custom";
      customTitle = title;
      customStory = story;
    }

    setSubmitting(true);
    try {
      await api.createJob({
        subreddit,
        tts_provider: "edge",
        custom_title: customTitle,
        custom_story: customStory,
      });
      setModalOpen(false);
      setPage("dashboard");
      setUserCredits((current) => Math.max(0, current - 1));
      setInpSub("");
      setInpTitle("");
      setInpStory("");
      toast("Video job queued - 1 credit used", "success");
      await loadJobs();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create job";
      toast(msg, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const savePassword = () => {
    if (!pwCurrent || !pwNew || !pwConfirm) {
      toast("Please fill in all password fields", "error");
      return;
    }
    if (pwNew !== pwConfirm) {
      toast("New passwords do not match", "error");
      return;
    }
    if (pwNew.length < 8) {
      toast("Password must be at least 8 characters", "error");
      return;
    }
    setPwSaving(true);
    setTimeout(() => {
      setPwSaving(false);
      setPwCurrent("");
      setPwNew("");
      setPwConfirm("");
      toast("Password updated successfully", "success");
    }, 900);
  };

  const searchAdminUsers = async () => {
    const query = adminQuery.trim();
    if (query.length < 2) {
      toast("Enter at least 2 characters to search", "error");
      return;
    }
    setAdminSearching(true);
    try {
      const results = await api.searchAdminUsers(query);
      setAdminResults(results);
      if (!results.length) {
        toast("No users matched your search", "info");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to search users";
      toast(msg, "error");
    } finally {
      setAdminSearching(false);
    }
  };

  const selectAdminUser = async (user: AdminUserResponse) => {
    await loadAdminTarget(user.id);
  };

  const applySetCredits = async () => {
    if (!adminTarget) {
      toast("Select a user first", "error");
      return;
    }
    const credits = Number(adminSetCredits);
    if (!Number.isInteger(credits) || credits < 0) {
      toast("Enter a valid non-negative whole number", "error");
      return;
    }
    setAdminApplying(true);
    try {
      const adjustment = await api.setAdminUserCredits(adminTarget.id, {
        credits,
        reason: adminSetReason.trim() || undefined,
      });
      await loadAdminTarget(adminTarget.id);
      setAdminSetReason("");
      if (adminTarget.email === userEmail) {
        setUserCredits(adjustment.new_credits);
      }
      toast(`Credits updated to ${adjustment.new_credits}`, "success");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update credits";
      toast(msg, "error");
    } finally {
      setAdminApplying(false);
    }
  };

  const applyDeltaCredits = async () => {
    if (!adminTarget) {
      toast("Select a user first", "error");
      return;
    }
    const delta = Number(adminDelta);
    if (!Number.isInteger(delta) || delta === 0) {
      toast("Enter a whole number adjustment other than 0", "error");
      return;
    }
    setAdminApplying(true);
    try {
      const adjustment = await api.adjustAdminUserCredits(adminTarget.id, {
        delta,
        reason: adminDeltaReason.trim() || undefined,
      });
      await loadAdminTarget(adminTarget.id);
      setAdminDelta("");
      setAdminDeltaReason("");
      if (adminTarget.email === userEmail) {
        setUserCredits(adjustment.new_credits);
      }
      toast(`Applied ${adjustment.delta > 0 ? "+" : ""}${adjustment.delta} credits`, "success");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to adjust credits";
      toast(msg, "error");
    } finally {
      setAdminApplying(false);
    }
  };

  const totalJobs = jobs.length;
  const completedJobs = jobs.filter((job) => job.status === "completed").length;
  const hasActive = jobs.some((job) => job.status === "processing" || job.status === "queued");
  const activeJob = jobs.find((job) => job.id === activeJobId) || null;
  const selectedAdjustment = adminHistory[0] || null;

  return (
    <>
      <div className="toast-container">
        {toasts.map((item) => (
          <div key={item.id} className={`toast ${item.type}${item.show ? " show" : ""}`}>
            <span className="toast-msg">
              {ICONS[item.type]} {item.msg}
            </span>
            <button className="toast-close" onClick={() => closeToast(item.id)}>
              x
            </button>
          </div>
        ))}
      </div>

      <div className="app">
        {view === "landing" && <Landing onAuth={goAuth} />}
        {view === "auth" && (
          <Auth
            tab={authTab}
            onSwitchTab={setAuthTab}
            onBack={() => setView("landing")}
            email={authEmail}
            setEmail={setAuthEmail}
            pass={authPass}
            setPass={setAuthPass}
            confirm={authConfirm}
            setConfirm={setAuthConfirm}
            loading={authLoading}
            onSubmit={doAuth}
          />
        )}
        {view === "app" && (
          <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
            <Navbar onLogout={logout} credits={userCredits} />
            <div className="main-layout">
              <Sidebar page={page} onChange={showPage} isAdmin={userIsAdmin} />
              {page === "dashboard" && (
                <Dashboard
                  jobs={jobs}
                  loading={loading}
                  total={totalJobs}
                  completed={completedJobs}
                  hasActive={hasActive}
                  credits={userCredits}
                  onCreate={() => setModalOpen(true)}
                  onOpen={openDetail}
                />
              )}
              {page === "detail" && <Detail job={activeJob} onBack={() => showPage("dashboard")} />}
              {page === "credits" && <Credits credits={userCredits} />}
              {page === "settings" && (
                <Settings
                  email={userEmail}
                  credits={userCredits}
                  notifOn={notifOn}
                  toggleNotif={() => setNotifOn((value) => !value)}
                  pwCurrent={pwCurrent}
                  pwNew={pwNew}
                  pwConfirm={pwConfirm}
                  setPwCurrent={setPwCurrent}
                  setPwNew={setPwNew}
                  setPwConfirm={setPwConfirm}
                  saving={pwSaving}
                  onSave={savePassword}
                  onDelete={() => toast("Account deletion requires confirmation - coming soon", "info")}
                />
              )}
              {page === "admin" && userIsAdmin && (
                <AdminDashboard
                  query={adminQuery}
                  setQuery={setAdminQuery}
                  searching={adminSearching}
                  onSearch={searchAdminUsers}
                  results={adminResults}
                  target={adminTarget}
                  history={adminHistory}
                  loadingDetail={adminLoadingDetail}
                  applying={adminApplying}
                  setCredits={adminSetCredits}
                  setSetCredits={setAdminSetCredits}
                  setReason={adminSetReason}
                  setSetReason={setAdminSetReason}
                  delta={adminDelta}
                  setDelta={setAdminDelta}
                  deltaReason={adminDeltaReason}
                  setDeltaReason={setAdminDeltaReason}
                  onSelectUser={selectAdminUser}
                  onApplySet={applySetCredits}
                  onApplyDelta={applyDeltaCredits}
                  latestAdjustment={selectedAdjustment}
                />
              )}
            </div>
          </div>
        )}
      </div>

      {modalOpen && (
        <NewJobModal
          mode={mode}
          setMode={setMode}
          inpSub={inpSub}
          setInpSub={setInpSub}
          inpTitle={inpTitle}
          setInpTitle={setInpTitle}
          inpStory={inpStory}
          setInpStory={setInpStory}
          submitting={submitting}
          onSubmit={submitJob}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
}

function Landing({ onAuth }: { onAuth: (tab: "login" | "signup") => void }) {
  return (
    <div className="landing">
      <div className="grid-bg" />
      <div
        style={{
          position: "absolute",
          top: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: 700,
          height: 350,
          background: "radial-gradient(ellipse,rgba(29,185,84,0.09) 0%,transparent 70%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />
      <div className="landing-nav">
        <div className="landing-logo">
          <div className="logo-mark">
            <img src={logoUrl} alt="Sage Studio logo" width={20} height={20} />
          </div>
          Sage <span>Studio</span>
        </div>
        <div className="landing-nav-btns">
          <button className="btn-nav-ghost" onClick={() => onAuth("login")}>
            Log in
          </button>
          <button className="btn-nav-green" onClick={() => onAuth("signup")}>
            Get started
          </button>
        </div>
      </div>
      <div className="hero">
        <div className="hero-badge">
          <div className="hero-badge-dot" />
          Powered by Groq + Edge TTS
        </div>
        <h1 className="hero-title">
          Turn any story into a <span>viral video</span>
        </h1>
        <p className="hero-sub">
          Paste a Reddit post or write your own story. Sage Studio handles the script, voiceover,
          subtitles, and Minecraft background automatically.
        </p>
        <div className="hero-btns">
          <button className="btn-hero-primary" onClick={() => onAuth("signup")}>
            Start for free
          </button>
          <button className="btn-hero-outline" onClick={() => onAuth("login")}>
            I already have an account
          </button>
        </div>
        <div className="features-row">
          <FeatureCard title="Reddit scraping" desc="Pull high-performing stories from your chosen subreddit." icon={<IconCheck />} />
          <FeatureCard title="AI narration" desc="Generate a clean narration script and voiceover automatically." icon={<IconArrow />} />
          <FeatureCard title="Auto rendering" desc="Subtitles, visuals, and final export handled for you." icon={<IconPlay />} />
        </div>
      </div>
      <div className="pipeline-section">
        <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
          <span className="slabel" style={{ marginBottom: 0 }}>
            How it works
          </span>
        </div>
        <div className="pipeline-steps">
          {[
            { n: "1", l: "Scrape / Input" },
            { n: "2", l: "Script" },
            { n: "3", l: "TTS Audio" },
            { n: "4", l: "Subtitles" },
            { n: "5", l: "Render" },
          ].map((step, index) => (
            <span key={step.n} style={{ display: "contents" }}>
              <div className="pipe-step">
                <div className="pipe-dot">{step.n}</div>
                <div className="pipe-label">{step.l}</div>
              </div>
              {index < 4 && <div className="pipe-arrow">-&gt;</div>}
            </span>
          ))}
          <div className="pipe-step">
            <div
              className="pipe-dot"
              style={{
                background: "var(--green3)",
                borderColor: "rgba(29,185,84,0.4)",
                color: "var(--green)",
              }}
            >
              OK
            </div>
            <div className="pipe-label">Your video</div>
          </div>
        </div>
      </div>
      <div className="landing-footer">
        Built by <span>Team NexCore</span> - Multan and Rawalpindi, Pakistan
      </div>
    </div>
  );
}

function FeatureCard({ title, desc, icon }: { title: string; desc: string; icon: ReactNode }) {
  return (
    <div className="feature-card">
      <div className="feature-icon">{icon}</div>
      <div className="feature-title">{title}</div>
      <div className="feature-desc">{desc}</div>
    </div>
  );
}

function Auth({
  tab,
  onSwitchTab,
  onBack,
  email,
  setEmail,
  pass,
  setPass,
  confirm,
  setConfirm,
  loading,
  onSubmit,
}: {
  tab: "login" | "signup";
  onSwitchTab: (tab: "login" | "signup") => void;
  onBack: () => void;
  email: string;
  setEmail: (value: string) => void;
  pass: string;
  setPass: (value: string) => void;
  confirm: string;
  setConfirm: (value: string) => void;
  loading: boolean;
  onSubmit: () => void;
}) {
  return (
    <div className="auth-wrap">
      <div className="grid-bg" />
      <button className="auth-back" onClick={onBack}>
        Back
      </button>
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-mark">
            <img src={logoUrl} alt="Sage Studio logo" width={34} height={34} />
          </div>
          <h1>
            Sage <span>Studio</span>
          </h1>
          <p>Turn stories into short-form video automatically</p>
        </div>
        <span className="slabel">Account access</span>
        <div className="tab-row">
          <button className={`tab-btn${tab === "login" ? " active" : ""}`} onClick={() => onSwitchTab("login")}>
            Log in
          </button>
          <button className={`tab-btn${tab === "signup" ? " active" : ""}`} onClick={() => onSwitchTab("signup")}>
            Sign up
          </button>
        </div>
        <div className="fg">
          <label>Email address</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </div>
        <div className="fg">
          <label>Password</label>
          <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="........" />
        </div>
        {tab === "signup" && (
          <div className="fg">
            <label>Confirm password</label>
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="........" />
          </div>
        )}
        <button className="btn-primary" disabled={loading} onClick={onSubmit}>
          {loading ? (
            <>
              <div className="spinner" /> Working...
            </>
          ) : tab === "login" ? (
            "Log in"
          ) : (
            "Create account"
          )}
        </button>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 14, flexWrap: "wrap" }}>
          <Link to="/resend-verification" style={{ color: "var(--green)", fontSize: 12, textDecoration: "none", fontWeight: 500 }}>
            Resend verification
          </Link>
          <Link to="/forgot-password" style={{ color: "var(--muted)", fontSize: 12, textDecoration: "none", fontWeight: 500 }}>
            Forgot password?
          </Link>
        </div>
      </div>
    </div>
  );
}

function Navbar({ onLogout, credits }: { onLogout: () => void; credits: number }) {
  return (
    <nav className="navbar">
      <div className="nav-logo">
        <div className="nav-logo-owl">
          <img src={logoUrl} alt="Sage Studio logo" width={20} height={20} />
        </div>
        Sage <span>Studio</span>
      </div>
      <div className="nav-right">
        <div className="credits-pill">
          <div className="credits-dot" />
          <span>{credits} credits</span>
        </div>
        <button className="btn-ghost" onClick={onLogout}>
          Log out
        </button>
      </div>
    </nav>
  );
}

function Sidebar({
  page,
  onChange,
  isAdmin,
}: {
  page: Page;
  onChange: (page: Page) => void;
  isAdmin: boolean;
}) {
  const items = useMemo(() => {
    const base: Array<{ id: Page; label: string; icon: ReactNode }> = [
      {
        id: "dashboard",
        label: "Dashboard",
        icon: <IconGrid />,
      },
      {
        id: "credits",
        label: "Credits",
        icon: <IconCoin />,
      },
      {
        id: "settings",
        label: "Settings",
        icon: <IconCog />,
      },
    ];
    if (isAdmin) {
      base.splice(2, 0, { id: "admin", label: "Admin", icon: <IconShield /> });
    }
    return base;
  }, [isAdmin]);

  const activePage = page === "detail" ? "dashboard" : page;
  return (
    <div className="sidebar">
      <span className="sidebar-lbl" style={{ marginBottom: ".75rem" }}>
        Menu
      </span>
      {items.map((item) => (
        <div
          key={item.id}
          className={`sidebar-item${activePage === item.id ? " active" : ""}`}
          onClick={() => onChange(item.id)}
        >
          {item.icon}
          {item.label}
        </div>
      ))}
    </div>
  );
}

function Dashboard({
  jobs,
  loading,
  total,
  completed,
  hasActive,
  credits,
  onCreate,
  onOpen,
}: {
  jobs: Job[];
  loading: boolean;
  total: number;
  completed: number;
  hasActive: boolean;
  credits: number;
  onCreate: () => void;
  onOpen: (id: number) => void;
}) {
  return (
    <div className="content">
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <span className="slabel">Overview</span>
            <div className="page-title">Your videos</div>
            <div className="page-desc">Manage and track your AI-generated videos</div>
          </div>
          <button className="btn-create" onClick={onCreate}>
            New video
          </button>
        </div>
      </div>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-tag">Total jobs</div>
          <div className="stat-num">{total}</div>
          <div className="stat-sub">all time</div>
        </div>
        <div className="stat-card">
          <div className="stat-tag">Completed</div>
          <div className="stat-num green">{completed}</div>
          <div className="stat-sub">ready to download</div>
        </div>
        <div className="stat-card">
          <div className="stat-tag">Credits left</div>
          <div className="stat-num green">{credits}</div>
          <div className="stat-sub">about {credits} more videos</div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
        <span className="slabel" style={{ marginBottom: 0 }}>
          Recent jobs
        </span>
        {hasActive && (
          <div className="poll-indicator">
            <div className="poll-dot" />
            <span>Checking for updates</span>
          </div>
        )}
      </div>
      <div>
        {loading ? (
          Array(4)
            .fill(0)
            .map((_, index) => (
              <div key={index} className="job-skeleton">
                <div className="skel-icon skeleton" />
                <div className="skel-info">
                  <div className="skel-title skeleton" />
                  <div className="skel-meta skeleton" />
                </div>
                <div className="skel-badge skeleton" />
              </div>
            ))
        ) : jobs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-owl">
              <img src={logoUrl} alt="Sage Studio logo" width={48} height={48} />
            </div>
            <div className="empty-title">No videos yet</div>
            <div className="empty-desc">
              Create your first AI-generated video from a Reddit story or your own custom story.
            </div>
            <button className="btn-empty" onClick={onCreate}>
              Create your first video
            </button>
          </div>
        ) : (
          jobs.map((job) => (
            <div
              key={job.id}
              className={`job-card${job.status === "processing" || job.status === "queued" ? " active-job" : ""}`}
              onClick={() => onOpen(job.id)}
            >
              <div className="job-icon">
                {job.status === "processing" ? (
                  <Waveform size="small" />
                ) : (
                  <IconPlay small />
                )}
              </div>
              <div className="job-info">
                <div className="job-title">{job.title}</div>
                <div className="job-meta">
                  {job.subreddit === "custom" ? "Custom story" : `r/${job.subreddit}`} - {job.created}
                </div>
              </div>
              <div className="job-right">
                <span className={`badge ${job.status}`}>{job.status}</span>
                <span className="chevron">&gt;</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function Detail({ job, onBack }: { job: Job | null; onBack: () => void }) {
  return (
    <div className="content">
      <button className="back-btn" onClick={onBack}>
        Back to dashboard
      </button>
      {!job ? (
        <div style={{ fontSize: 12, color: "var(--muted)" }}>Job not found.</div>
      ) : (
        <>
          <div className="detail-hero">
            <div className="detail-hero-glow" />
            <span className="slabel">{job.subreddit === "custom" ? "Custom story" : `r/${job.subreddit}`}</span>
            <div className="detail-title">{job.title}</div>
            <div className="detail-meta">
              <span className={`badge ${job.status}`}>{job.status}</span>
              <span className="meta-item">
                Created <b>{job.created}</b>
              </span>
              {job.started && (
                <span className="meta-item">
                  Started <b>{job.started}</b>
                </span>
              )}
              {job.completed && (
                <span className="meta-item">
                  Completed <b>{job.completed}</b>
                </span>
              )}
            </div>
          </div>
          {job.error && <div className="error-panel">{job.error}</div>}
          {job.status === "processing" && (
            <div className="panel">
              <div className="panel-title">Rendering in progress</div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: "1rem" }}>
                This usually takes 2 to 5 minutes. You can leave this page.
              </div>
              <Waveform size="large" />
            </div>
          )}
          {job.video && job.video_url && (
            <div className="panel">
              <div className="panel-title">Video output</div>
              <video
                controls
                src={job.video_url}
                style={{
                  width: "100%",
                  maxWidth: 360,
                  aspectRatio: "9 / 16",
                  borderRadius: 12,
                  marginBottom: "0.75rem",
                  display: "block",
                  marginLeft: "auto",
                  marginRight: "auto",
                  background: "#000",
                }}
              />
              <div className="video-btns">
                <a href={job.video_url} target="_blank" rel="noopener noreferrer" className="btn-sm green" style={{ textDecoration: "none" }}>
                  Open video
                </a>
                <a href={job.video_url} download className="btn-sm outline" style={{ textDecoration: "none" }}>
                  Download
                </a>
              </div>
            </div>
          )}
          <div className="panel">
            <div className="panel-title">Pipeline logs</div>
            {job.logs.length === 0 ? (
              <div style={{ fontSize: 12, color: "var(--muted)" }}>No logs yet.</div>
            ) : (
              job.logs.map((log, index) => (
                <div key={index} className="log-item">
                  <div className="log-pip" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="log-stage">{String(log.stage).replace(/_/g, " ")}</div>
                    <div className="log-msg">{log.msg}</div>
                  </div>
                  <div className="log-time">{log.time}</div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Credits({ credits }: { credits: number }) {
  return (
    <div className="content">
      <div className="page-header">
        <span className="slabel">Balance</span>
        <div className="page-title">Credits</div>
        <div className="page-desc">Your usage history and remaining balance</div>
      </div>
      <div className="credits-hero">
        <div className="credits-orb" />
        <div className="credits-lbl">Available credits</div>
        <div className="credits-big">{credits}</div>
        <div className="credits-sub">Each video costs 1 credit</div>
      </div>
      <div className="panel">
        <div className="panel-title">Usage history</div>
        <table className="usage-table">
          <thead>
            <tr>
              <th>Job</th>
              <th>Date</th>
              <th>Credits</th>
            </tr>
          </thead>
          <tbody>
            {USAGE.map((item, index) => (
              <tr key={index}>
                <td>{item.job}</td>
                <td>{item.date}</td>
                <td>-1</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Settings({
  email,
  credits,
  notifOn,
  toggleNotif,
  pwCurrent,
  pwNew,
  pwConfirm,
  setPwCurrent,
  setPwNew,
  setPwConfirm,
  saving,
  onSave,
  onDelete,
}: {
  email: string;
  credits: number;
  notifOn: boolean;
  toggleNotif: () => void;
  pwCurrent: string;
  pwNew: string;
  pwConfirm: string;
  setPwCurrent: (value: string) => void;
  setPwNew: (value: string) => void;
  setPwConfirm: (value: string) => void;
  saving: boolean;
  onSave: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="content">
      <div className="page-header">
        <span className="slabel">Account</span>
        <div className="page-title">Settings</div>
        <div className="page-desc">Manage your account preferences</div>
      </div>
      <div className="settings-section">
        <div className="settings-section-title">Profile</div>
        <div className="settings-row">
          <div>
            <div className="settings-label">Email address</div>
            <div className="settings-value">{email}</div>
          </div>
        </div>
        <div className="settings-row">
          <div>
            <div className="settings-label">Credits balance</div>
            <div className="settings-value" style={{ color: "var(--green)", fontWeight: 600 }}>
              {credits} credits
            </div>
          </div>
        </div>
      </div>
      <div className="settings-section">
        <div className="settings-section-title">Change password</div>
        <div className="pw-form">
          <div className="fg" style={{ marginBottom: 0 }}>
            <label>Current password</label>
            <input type="password" value={pwCurrent} onChange={(e) => setPwCurrent(e.target.value)} placeholder="........" />
          </div>
          <div className="fg" style={{ marginBottom: 0 }}>
            <label>New password</label>
            <input type="password" value={pwNew} onChange={(e) => setPwNew(e.target.value)} placeholder="........" />
          </div>
          <div className="fg" style={{ marginBottom: 0 }}>
            <label>Confirm new password</label>
            <input type="password" value={pwConfirm} onChange={(e) => setPwConfirm(e.target.value)} placeholder="........" />
          </div>
          <button className="btn-save" disabled={saving} onClick={onSave}>
            {saving ? "Saving..." : "Save password"}
          </button>
        </div>
      </div>
      <div className="settings-section">
        <div className="settings-section-title">Preferences</div>
        <div className="settings-row">
          <div className="settings-label">Email notifications</div>
          <div
            onClick={toggleNotif}
            style={{
              width: 36,
              height: 20,
              background: notifOn ? "var(--green)" : "var(--surface2)",
              borderRadius: 100,
              cursor: "pointer",
              position: "relative",
              transition: ".2s",
            }}
          >
            <div
              style={{
                width: 16,
                height: 16,
                background: "#000",
                borderRadius: "50%",
                position: "absolute",
                top: 2,
                right: notifOn ? 2 : 18,
                transition: ".2s",
              }}
            />
          </div>
        </div>
      </div>
      <div className="danger-zone">
        <div className="danger-title">Danger zone</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>Delete account</div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
              Permanently delete your account and all data
            </div>
          </div>
          <button className="btn-danger" onClick={onDelete}>
            Delete account
          </button>
        </div>
      </div>
    </div>
  );
}

function AdminDashboard({
  query,
  setQuery,
  searching,
  onSearch,
  results,
  target,
  history,
  loadingDetail,
  applying,
  setCredits,
  setSetCredits,
  setReason,
  setSetReason,
  delta,
  setDelta,
  deltaReason,
  setDeltaReason,
  onSelectUser,
  onApplySet,
  onApplyDelta,
  latestAdjustment,
}: {
  query: string;
  setQuery: (value: string) => void;
  searching: boolean;
  onSearch: () => void;
  results: AdminUserResponse[];
  target: AdminTarget | null;
  history: AdminCreditAdjustmentResponse[];
  loadingDetail: boolean;
  applying: boolean;
  setCredits: string;
  setSetCredits: (value: string) => void;
  setReason: string;
  setSetReason: (value: string) => void;
  delta: string;
  setDelta: (value: string) => void;
  deltaReason: string;
  setDeltaReason: (value: string) => void;
  onSelectUser: (user: AdminUserResponse) => void;
  onApplySet: () => void;
  onApplyDelta: () => void;
  latestAdjustment: AdminCreditAdjustmentResponse | null;
}) {
  return (
    <div className="content">
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <span className="slabel">Admin tools</span>
            <div className="page-title">Admin dashboard</div>
            <div className="page-desc">Search users, manage credits, and review adjustment history</div>
          </div>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-tag">Selected user</div>
          <div className="stat-num">{target ? target.id : "-"}</div>
          <div className="stat-sub">{target ? target.email : "Choose a user to manage"}</div>
        </div>
        <div className="stat-card">
          <div className="stat-tag">Current credits</div>
          <div className="stat-num green">{target ? target.credits : 0}</div>
          <div className="stat-sub">live balance for the selected account</div>
        </div>
        <div className="stat-card">
          <div className="stat-tag">Latest change</div>
          <div className="stat-num green">
            {latestAdjustment ? `${latestAdjustment.delta > 0 ? "+" : ""}${latestAdjustment.delta}` : "0"}
          </div>
          <div className="stat-sub">
            {latestAdjustment ? `by ${latestAdjustment.admin_email}` : "No adjustments recorded yet"}
          </div>
        </div>
      </div>

      <div className="admin-grid">
        <div className="panel">
          <div className="panel-title">Find a user</div>
          <div className="admin-search-row">
            <input
              className="admin-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by email prefix"
              onKeyDown={(e) => {
                if (e.key === "Enter") onSearch();
              }}
            />
            <button className="btn-create" onClick={onSearch} disabled={searching}>
              {searching ? "Searching..." : "Search"}
            </button>
          </div>
          <div className="admin-results">
            {results.length === 0 ? (
              <div className="admin-empty">Search results will appear here.</div>
            ) : (
              results.map((user) => (
                <button
                  key={user.id}
                  className={`admin-user-card${target?.id === user.id ? " selected" : ""}`}
                  onClick={() => onSelectUser(user)}
                >
                  <div>
                    <div className="admin-user-email">{user.email}</div>
                    <div className="admin-user-meta">
                      {user.credits} credits {user.is_admin ? "- admin" : "- member"}{" "}
                      {user.email_verified ? "- verified" : "- unverified"}
                    </div>
                  </div>
                  <span className="badge completed">Select</span>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panel-title">Manage selected user</div>
          {!target ? (
            <div className="admin-empty">Choose a user from search results to manage credits.</div>
          ) : loadingDetail ? (
            <div className="admin-empty">Loading user details...</div>
          ) : (
            <>
              <div className="admin-target-card">
                <div className="admin-target-top">
                  <div>
                    <div className="admin-user-email">{target.email}</div>
                    <div className="admin-user-meta">
                      User #{target.id} - {target.is_admin ? "admin" : "member"} -{" "}
                      {target.email_verified ? "verified" : "unverified"}
                    </div>
                  </div>
                  <div className="credits-pill">
                    <div className="credits-dot" />
                    <span>{target.credits} credits</span>
                  </div>
                </div>
              </div>
              <div className="admin-form-grid">
                <div className="admin-action-card">
                  <div className="admin-action-title">Set exact credits</div>
                  <div className="fg">
                    <label>Credits</label>
                    <input
                      className="admin-input"
                      value={setCredits}
                      onChange={(e) => setSetCredits(e.target.value)}
                      placeholder="e.g. 25"
                    />
                  </div>
                  <div className="fg">
                    <label>Reason</label>
                    <textarea
                      className="admin-textarea"
                      value={setReason}
                      onChange={(e) => setSetReason(e.target.value)}
                      placeholder="Why are you setting this balance?"
                    />
                  </div>
                  <button className="btn-save" disabled={applying} onClick={onApplySet}>
                    {applying ? "Saving..." : "Set credits"}
                  </button>
                </div>
                <div className="admin-action-card">
                  <div className="admin-action-title">Add or remove credits</div>
                  <div className="fg">
                    <label>Delta</label>
                    <input
                      className="admin-input"
                      value={delta}
                      onChange={(e) => setDelta(e.target.value)}
                      placeholder="e.g. 5 or -2"
                    />
                  </div>
                  <div className="fg">
                    <label>Reason</label>
                    <textarea
                      className="admin-textarea"
                      value={deltaReason}
                      onChange={(e) => setDeltaReason(e.target.value)}
                      placeholder="Why are you adjusting this balance?"
                    />
                  </div>
                  <button className="btn-save" disabled={applying} onClick={onApplyDelta}>
                    {applying ? "Saving..." : "Apply adjustment"}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="panel">
        <div className="panel-title">Credit adjustment history</div>
        {!target ? (
          <div className="admin-empty">Select a user to see recent credit changes.</div>
        ) : history.length === 0 ? (
          <div className="admin-empty">No credit adjustments recorded for this user yet.</div>
        ) : (
          <div className="admin-history">
            {history.map((item) => (
              <div key={item.id} className="admin-history-item">
                <div className="admin-history-main">
                  <div className="admin-history-delta">
                    {item.delta > 0 ? "+" : ""}
                    {item.delta}
                  </div>
                  <div>
                    <div className="admin-history-title">
                      {item.old_credits} to {item.new_credits} credits
                    </div>
                    <div className="admin-history-meta">
                      by {item.admin_email}
                      {item.reason ? ` - ${item.reason}` : ""}
                    </div>
                  </div>
                </div>
                <div className="admin-history-time">{formatRelativeTime(item.created_at)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function NewJobModal({
  mode,
  setMode,
  inpSub,
  setInpSub,
  inpTitle,
  setInpTitle,
  inpStory,
  setInpStory,
  submitting,
  onSubmit,
  onClose,
}: {
  mode: "reddit" | "custom";
  setMode: (mode: "reddit" | "custom") => void;
  inpSub: string;
  setInpSub: (value: string) => void;
  inpTitle: string;
  setInpTitle: (value: string) => void;
  inpStory: string;
  setInpStory: (value: string) => void;
  submitting: boolean;
  onSubmit: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <span className="slabel">New job</span>
        <div className="modal-title">Create video</div>
        <div className="toggle-row">
          <button className={`toggle-opt${mode === "reddit" ? " active" : ""}`} onClick={() => setMode("reddit")}>
            Reddit story
          </button>
          <button className={`toggle-opt${mode === "custom" ? " active" : ""}`} onClick={() => setMode("custom")}>
            Custom story
          </button>
        </div>
        {mode === "reddit" ? (
          <div className="fg">
            <label>Subreddit</label>
            <input value={inpSub} onChange={(e) => setInpSub(e.target.value)} placeholder="e.g. AskReddit or tifu" />
          </div>
        ) : (
          <>
            <div className="fg">
              <label>Story title</label>
              <input value={inpTitle} onChange={(e) => setInpTitle(e.target.value)} placeholder="Give your story a title" />
            </div>
            <div className="fg">
              <label>Story text</label>
              <textarea value={inpStory} onChange={(e) => setInpStory(e.target.value)} placeholder="Paste or write your story here..." />
            </div>
          </>
        )}
        <div className="cost-pill">This will use 1 credit from your balance</div>
        <div className="modal-actions">
          <button className="btn-cancel" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-submit" disabled={submitting} onClick={onSubmit}>
            {submitting ? "Queuing..." : "Generate video"}
          </button>
        </div>
      </div>
    </div>
  );
}

function IconCheck() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#1DB954" strokeWidth="1.5">
      <circle cx="9" cy="9" r="7" />
      <path d="M6 9l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconArrow() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#1DB954" strokeWidth="1.5">
      <path d="M3 9h12M9 3l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconPlay({ small = false }: { small?: boolean }) {
  return (
    <svg width={small ? 16 : 18} height={small ? 16 : 18} viewBox="0 0 18 18" fill="none" stroke="#1DB954" strokeWidth="1.5">
      <rect x="2" y="4" width="14" height="10" rx="2" />
      <path d="M7 8l4 2-4 2V8z" fill="#1DB954" stroke="none" />
    </svg>
  );
}

function IconGrid() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor">
      <rect x="1" y="1" width="5.5" height="5.5" rx="1.5" />
      <rect x="8.5" y="1" width="5.5" height="5.5" rx="1.5" />
      <rect x="1" y="8.5" width="5.5" height="5.5" rx="1.5" />
      <rect x="8.5" y="8.5" width="5.5" height="5.5" rx="1.5" />
    </svg>
  );
}

function IconCoin() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4">
      <circle cx="7.5" cy="7.5" r="6" />
      <path
        d="M7.5 5c0-1 .8-1.5 1.5-1.5s1.5.5 1.5 1.5-1 1.5-1.5 1.5-1.5.5-1.5 1.5.8 1.5 1.5 1.5 1.5-.5 1.5-1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconCog() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4">
      <circle cx="7.5" cy="7.5" r="2.5" />
      <path
        d="M7.5 1v1.5M7.5 12.5V14M1 7.5h1.5M12.5 7.5H14M2.9 2.9L4 4M11 11l1.1 1.1M2.9 12.1 4 11M11 4l1.1-1.1"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconShield() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4">
      <path d="M7.5 1.5 2 4.25v3.2c0 3.1 2.22 5.99 5.5 6.8 3.28-.81 5.5-3.7 5.5-6.8v-3.2L7.5 1.5Z" />
      <path d="M5.6 7.5 6.9 8.8 9.7 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
