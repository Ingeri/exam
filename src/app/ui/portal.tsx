"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useCallback, useEffect, useState } from "react";

type Role = "STUDENT" | "INSTRUCTOR" | "ADMIN";
type User = { id: string; name: string; email: string; registrationNumber?: string | null; role: Role };
type Session = { token: string; user: User };
type Exam = { id: string; title: string; status: string; durationMinutes: number; isPublic: boolean; opensAt: string | null; closesAt: string | null; _count?: { questions: number; attempts: number; allowedStudents: number } };
type AdminUser = User & { createdAt: string; _count: { exams: number; attempts: number } };

const SESSION_KEY = "ingeri-session";

function saveSession(session: Session) {
  window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function getSession(): Session | null {
  try {
    const value = window.sessionStorage.getItem(SESSION_KEY);
    return value ? JSON.parse(value) as Session : null;
  } catch {
    return null;
  }
}

async function api<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error ?? "The request could not be completed.");
  return payload as T;
}

function destination(role: Role) {
  return role === "ADMIN" ? "/admin" : role === "INSTRUCTOR" ? "/instructor" : "/student";
}

function Brand() {
  return <Link href="/" className="brand"><span className="brand-mark">i</span><span>ingeri<span className="brand-muted"> exam</span></span></Link>;
}

function PublicFrame({ children }: { children: React.ReactNode }) {
  return <main className="auth-page"><header className="site-header"><Brand /><Link href="/" className="back-link">← Back to home</Link></header>{children}<p className="auth-footnote">A calm, focused space for better assessments.</p></main>;
}

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    const session = getSession();
    if (session) router.replace(destination(session.user.role));
  }, [router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const response = await fetch("/api/v0/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to log in.");
      saveSession({ token: result.token, user: result.user });
      router.push(destination(result.user.role));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to log in.");
    } finally {
      setBusy(false);
    }
  }

  return <PublicFrame><section className="auth-card"><div className="eyebrow">WELCOME BACK</div><h1>Sign in to your workspace</h1><p className="muted">Pick up where you left off.</p>
    <form onSubmit={submit} className="form-stack"><label>Email address<input autoComplete="email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@school.edu" /></label><label>Password<input autoComplete="current-password" type="password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Your password" /></label>
      {error && <p className="error-message" role="alert">{error}</p>}<button className="button button-primary button-full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
    </form><p className="form-switch">New to Ingeri? <Link href="/register">Create an account</Link></p>
  </section></PublicFrame>;
}

export function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", registrationNumber: "", password: "", role: "STUDENT" as "STUDENT" | "INSTRUCTOR" });
  useEffect(() => {
    const session = getSession();
    if (session) router.replace(destination(session.user.role));
  }, [router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const response = await fetch("/api/v0/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, registrationNumber: form.registrationNumber || undefined }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to create your account.");
      saveSession({ token: result.token, user: result.user });
      router.push(destination(result.user.role));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to create your account.");
    } finally {
      setBusy(false);
    }
  }

  return <PublicFrame><section className="auth-card"><div className="eyebrow">GET STARTED</div><h1>Create your account</h1><p className="muted">Join your school’s examination workspace.</p>
    <form onSubmit={submit} className="form-stack"><label>Full name<input autoComplete="name" required maxLength={120} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Your name" /></label><label>Email address<input autoComplete="email" type="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="you@school.edu" /></label><label>Registration number <span className="optional">optional</span><input value={form.registrationNumber} onChange={(event) => setForm({ ...form, registrationNumber: event.target.value })} placeholder="e.g. REG-2026-041" /></label><label>Account type<select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as "STUDENT" | "INSTRUCTOR" })}><option value="STUDENT">Student</option><option value="INSTRUCTOR">Instructor</option></select></label><label>Password<input autoComplete="new-password" type="password" minLength={12} maxLength={72} required value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="At least 12 characters" /><span className="field-help">Use at least 12 characters.</span></label>
      {error && <p className="error-message" role="alert">{error}</p>}<button className="button button-primary button-full" disabled={busy}>{busy ? "Creating account…" : "Create account"}</button>
    </form><p className="form-switch">Already have an account? <Link href="/login">Sign in</Link></p>
  </section></PublicFrame>;
}

function PortalFrame({ session, children }: { session: Session; children: React.ReactNode }) {
  const router = useRouter();
  function signOut() {
    window.sessionStorage.removeItem(SESSION_KEY);
    router.replace("/login");
  }
  return <div className="portal"><header className="portal-header"><Brand /><nav className="portal-nav"><span className="user-chip"><span className="avatar">{session.user.name.slice(0, 1).toUpperCase()}</span><span><strong>{session.user.name}</strong><small>{session.user.role.toLowerCase()}</small></span></span><button onClick={signOut} className="button button-quiet">Sign out</button></nav></header>{children}</div>;
}

function usePortalSession(role: Role) {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const value = getSession();
      if (!value) router.replace("/login");
      else if (value.user.role !== role && !(role === "INSTRUCTOR" && value.user.role === "ADMIN")) router.replace(destination(value.user.role));
      else setSession(value);
      setReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [role, router]);
  return { session, ready };
}

function Notice({ error, success }: { error: string; success: string }) {
  return <>{error && <p className="error-message" role="alert">{error}</p>}{success && <p className="success-message" role="status">{success}</p>}</>;
}

export function InstructorDashboard() {
  const { session, ready } = usePortalSession("INSTRUCTOR");
  const [exams, setExams] = useState<Exam[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState("60");
  const [opensAt, setOpensAt] = useState("");
  const [closesAt, setClosesAt] = useState("");
  const [examKey, setExamKey] = useState("");
  const [selectedExamId, setSelectedExamId] = useState("");
  const [studentEmails, setStudentEmails] = useState("");
  const [studentNumbers, setStudentNumbers] = useState("");

  const refresh = useCallback(async (token: string) => {
    const result = await api<{ exams: Exam[] }>("/api/v0/instructor/exams", token);
    setExams(result.exams);
    setSelectedExamId((current) => current || result.exams[0]?.id || "");
  }, []);

  useEffect(() => {
    if (!session) return;
    const timer = window.setTimeout(() => {
      refresh(session.token).catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load exams.")).finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh, session]);

  async function createExam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) return;
    setError(""); setSuccess(""); setBusy(true);
    try {
      const result = await api<{ exam: Exam }>("/api/v0/instructor/exams", session.token, {
        method: "POST",
        body: JSON.stringify({
          title, durationMinutes: Number(duration),
          opensAt: opensAt ? new Date(opensAt).toISOString() : null,
          closesAt: closesAt ? new Date(closesAt).toISOString() : null,
          examKey: examKey || null, isPublic: false, allowedStudents: [],
        }),
      });
      await refresh(session.token);
      setSelectedExamId(result.exam.id);
      setTitle(""); setExamKey(""); setSuccess("Your private exam draft is ready.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to create exam."); }
    finally { setBusy(false); }
  }

  async function enroll(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !selectedExamId) return;
    const emails = studentEmails.split(/[\n,;]+/).map((value) => value.trim()).filter(Boolean);
    const registrationNumbers = studentNumbers.split(/[\n,;]+/).map((value) => value.trim()).filter(Boolean);
    setError(""); setSuccess(""); setBusy(true);
    try {
      const result = await api<{ added: number; submitted: number }>(`/api/v0/instructor/exams/${selectedExamId}/students`, session.token, {
        method: "POST", body: JSON.stringify({ emails, registrationNumbers }),
      });
      setSuccess(`${result.added} student${result.added === 1 ? "" : "s"} added to this exam.`);
      setStudentEmails(""); setStudentNumbers(""); await refresh(session.token);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to enroll students."); }
    finally { setBusy(false); }
  }

  if (!ready || !session) return <div className="loading-screen">Opening your workspace…</div>;
  return <PortalFrame session={session}><main className="dashboard"><div className="page-heading"><div><div className="eyebrow">INSTRUCTOR WORKSPACE</div><h1>Good work starts here.</h1><p>Prepare an assessment, set its access window, and invite your students.</p></div><span className="heading-badge">{exams.length} {exams.length === 1 ? "exam" : "exams"}</span></div><Notice error={error} success={success} />
    <div className="dashboard-grid"><section className="panel"><div className="panel-heading"><div><span className="step-tag">01 · CREATE</span><h2>New exam</h2></div><span className="panel-icon">＋</span></div><p className="muted">Create a private draft and choose when it opens.</p>
      <form className="form-stack" onSubmit={createExam}><label>Exam title<input required maxLength={160} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Biology · Mid-term" /></label><label>Duration <span className="optional">minutes</span><input type="number" min={1} max={1440} required value={duration} onChange={(event) => setDuration(event.target.value)} /></label><div className="form-row"><label>Opens at <input type="datetime-local" value={opensAt} onChange={(event) => setOpensAt(event.target.value)} /></label><label>Closes at <input type="datetime-local" value={closesAt} onChange={(event) => setClosesAt(event.target.value)} /></label></div><label>Access key <span className="optional">optional</span><input value={examKey} onChange={(event) => setExamKey(event.target.value)} placeholder="A private code for exam takers" /></label><button className="button button-primary" disabled={busy}>{busy ? "Creating…" : "Create private draft"}<span>→</span></button></form>
    </section>
    <section className="panel"><div className="panel-heading"><div><span className="step-tag">02 · ENROLL</span><h2>Invite students</h2></div><span className="panel-icon">↗</span></div><p className="muted">Add one or many students by email or registration number.</p><form className="form-stack" onSubmit={enroll}><label>Choose an exam<select required value={selectedExamId} onChange={(event) => setSelectedExamId(event.target.value)}><option value="">Select a private exam</option>{exams.filter((exam) => !exam.isPublic).map((exam) => <option key={exam.id} value={exam.id}>{exam.title}</option>)}</select></label><label>Student emails<textarea rows={4} value={studentEmails} onChange={(event) => setStudentEmails(event.target.value)} placeholder="One email per line, or separate with commas" /></label><label>Registration numbers <span className="optional">optional</span><textarea rows={3} value={studentNumbers} onChange={(event) => setStudentNumbers(event.target.value)} placeholder="One number per line" /></label><button className="button button-dark" disabled={busy || !selectedExamId}>{busy ? "Adding students…" : "Add to exam"}<span>→</span></button></form></section></div>
    <section className="panel exam-list"><div className="panel-heading"><div><span className="step-tag">YOUR LIBRARY</span><h2>Recent exams</h2></div><span className="panel-caption">Drafts are private until published</span></div>{loading ? <p className="muted">Loading exams…</p> : exams.length === 0 ? <div className="empty-state"><span className="empty-icon">□</span><p>Your first exam will appear here.</p></div> : <div className="exam-table">{exams.map((exam) => <article className="exam-row" key={exam.id}><div className="exam-symbol">{exam.title.slice(0, 1).toUpperCase()}</div><div className="exam-main"><strong>{exam.title}</strong><span>{exam.durationMinutes} min · {exam._count?.allowedStudents ?? 0} enrolled · {exam._count?.attempts ?? 0} submissions</span></div><span className={`status-pill status-${exam.status.toLowerCase()}`}>{exam.status}</span></article>)}</div>}</section>
  </main></PortalFrame>;
}

export function AdminDashboard() {
  const { session, ready } = usePortalSession("ADMIN");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(10);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyUser, setBusyUser] = useState("");
  const [busySetting, setBusySetting] = useState(false);

  const refresh = useCallback(async (token: string, search = "") => {
    const [userResult, settingResult] = await Promise.all([
      api<{ users: AdminUser[] }>(`/api/v0/admin/users?limit=100&q=${encodeURIComponent(search)}`, token),
      api<{ settings: { maxExamsPerMonth: number } }>("/api/v0/admin/settings", token),
    ]);
    setUsers(userResult.users);
    setLimit(settingResult.settings.maxExamsPerMonth);
  }, []);

  useEffect(() => {
    if (!session) return;
    const timer = window.setTimeout(() => {
      refresh(session.token, "").catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load administration data.")).finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh, session]);

  async function updateRole(user: AdminUser, role: Role) {
    if (!session || role === user.role) return;
    setBusyUser(user.id); setError(""); setSuccess("");
    try {
      await api(`/api/v0/admin/users/${user.id}`, session.token, { method: "PUT", body: JSON.stringify({ role }) });
      setSuccess(`Updated ${user.name} to ${role.toLowerCase()}.`); await refresh(session.token, query);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to update user."); }
    finally { setBusyUser(""); }
  }

  async function deleteUser(user: AdminUser) {
    if (!session || !window.confirm(`Delete ${user.name}? Their exams and attempts will also be removed.`)) return;
    setBusyUser(user.id); setError(""); setSuccess("");
    try {
      await api(`/api/v0/admin/users/${user.id}`, session.token, { method: "DELETE" });
      setSuccess(`${user.name} was deleted.`); await refresh(session.token, query);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to delete user."); }
    finally { setBusyUser(""); }
  }

  async function saveLimit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) return;
    setBusySetting(true); setError(""); setSuccess("");
    try {
      await api("/api/v0/admin/settings", session.token, { method: "PUT", body: JSON.stringify({ maxExamsPerMonth: limit }) });
      setSuccess("System limit saved.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to save setting."); }
    finally { setBusySetting(false); }
  }

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) return;
    setLoading(true); setError("");
    try { await refresh(session.token, query); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to search users."); }
    finally { setLoading(false); }
  }

  if (!ready || !session) return <div className="loading-screen">Opening your workspace…</div>;
  const adminCount = users.filter((user) => user.role === "ADMIN").length;
  const instructorCount = users.filter((user) => user.role === "INSTRUCTOR").length;
  return <PortalFrame session={session}><main className="dashboard"><div className="page-heading"><div><div className="eyebrow">SYSTEM ADMINISTRATION</div><h1>Everything in order.</h1><p>Manage access, keep an eye on activity, and set platform rules.</p></div><span className="heading-badge">ADMIN CONSOLE</span></div><Notice error={error} success={success} />
    <div className="stat-grid"><article className="stat-card"><span>Accounts</span><strong>{users.length}</strong><small>in current directory view</small></article><article className="stat-card stat-card-accent"><span>Instructors</span><strong>{instructorCount}</strong><small>can create and manage exams</small></article><article className="stat-card"><span>Administrators</span><strong>{adminCount}</strong><small>system-wide access</small></article></div>
    <section className="panel settings-panel"><div className="panel-heading"><div><span className="step-tag">PLATFORM RULES</span><h2>Instructor exam limit</h2></div><span className="panel-icon">⚙</span></div><div className="settings-inline"><p className="muted">Maximum exams an instructor may create each month. Set to 0 to pause new exam creation.</p><form onSubmit={saveLimit} className="limit-form"><label className="sr-only" htmlFor="exam-limit">Maximum exams per month</label><input id="exam-limit" type="number" min={0} max={10000} required value={limit} onChange={(event) => setLimit(Number(event.target.value))} /><button className="button button-dark" disabled={busySetting}>{busySetting ? "Saving…" : "Save limit"}</button></form></div></section>
    <section className="panel users-panel"><div className="panel-heading"><div><span className="step-tag">PEOPLE</span><h2>User directory</h2></div><span className="panel-caption">{users.length} accounts shown</span></div><form className="search-form" onSubmit={search}><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name, email, or registration number" /><button className="button button-dark" disabled={loading}>Search</button></form>{loading ? <p className="muted">Loading users…</p> : users.length === 0 ? <div className="empty-state"><p>No users match this search.</p></div> : <div className="user-table"><div className="user-table-head"><span>USER</span><span>ROLE</span><span>ACTIVITY</span><span>ACTIONS</span></div>{users.map((user) => <article className="user-row" key={user.id}><div className="user-identity"><span className="avatar avatar-soft">{user.name.slice(0, 1).toUpperCase()}</span><span><strong>{user.name}</strong><small>{user.email}{user.registrationNumber ? ` · ${user.registrationNumber}` : ""}</small></span></div><div><select aria-label={`Role for ${user.name}`} value={user.role} disabled={busyUser === user.id || (user.role === "ADMIN" && adminCount <= 1)} onChange={(event) => updateRole(user, event.target.value as Role)}><option value="STUDENT">Student</option><option value="INSTRUCTOR">Instructor</option><option value="ADMIN">Admin</option></select></div><span className="activity-count">{user._count.exams} exams · {user._count.attempts} attempts</span><button className="button button-danger-quiet" disabled={busyUser === user.id || user.id === session.user.id || (user.role === "ADMIN" && adminCount <= 1)} onClick={() => deleteUser(user)}>{busyUser === user.id ? "Working…" : "Delete"}</button></article>)}</div>}</section>
  </main></PortalFrame>;
}

export function StudentLanding() {
  const { session, ready } = usePortalSession("STUDENT");
  if (!ready || !session) return <div className="loading-screen">Opening your workspace…</div>;
  return <PortalFrame session={session}><main className="dashboard"><div className="page-heading"><div><div className="eyebrow">STUDENT WORKSPACE</div><h1>Ready when you are.</h1><p>Your exam invitations and results will be available here.</p></div></div><section className="panel student-welcome"><span className="panel-icon">✦</span><h2>Welcome, {session.user.name.split(" ")[0]}.</h2><p className="muted">When an instructor enrolls you in a private exam, it will appear in your student exam list.</p><Link href="/api/v0/student/exams" className="button button-dark">View available exams <span>→</span></Link></section></main></PortalFrame>;
}
