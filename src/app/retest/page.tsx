"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { useFlow } from "@/components/FlowProvider";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { getRetestLink, type ApiRetestLink } from "@/lib/api/statamic";

function formatDate(iso: string | null) {
  if (!iso) return null;
  const time = Date.parse(iso);
  return Number.isNaN(time) ? null : new Date(time).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function RetestEntry() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const { ready, setParticipant, setRetestToken, reset } = useFlow();
  const [state, setState] = useState<{ kind: "loading" } | { kind: "invalid"; message: string } | { kind: "ready"; link: ApiRetestLink }>({ kind: "loading" });

  useEffect(() => {
    if (!ready) return;
    if (!token) {
      setState({ kind: "invalid", message: "This retest link is missing its token. Open the link from your report email." });
      return;
    }
    let cancelled = false;
    getRetestLink(token).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setState({ kind: "invalid", message: result.message });
        return;
      }
      // A retest link starts a fresh Week-8 session for the baseline guest: name,
      // age and (when the API sends it) email come from the baseline.
      const { first_name, age, email } = result.data.participant;
      reset();
      setParticipant({ firstName: first_name, age, phase: "week8", ...(email ? { email } : {}) });
      setRetestToken(token);
      setState({ kind: "ready", link: result.data });
    });
    return () => {
      cancelled = true;
    };
    // Runs once the saved flow is loaded, for this token.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, token]);

  if (!ready) return null;

  return (
    <AppShell>
      <LoadingOverlay show={state.kind === "loading"} label="Checking your retest link" />
      {state.kind === "invalid" ? (
        <div className="retest-card rise" style={{ "--i": 0 }}>
          <p className="field-label">Week-8 retest</p>
          <h1>This link will not open your retest.</h1>
          <p className="form-error" role="alert">
            {state.message}
          </p>
          <p className="field-hint">Event staff can look up your baseline and start a retest for you.</p>
          <div className="btn-row">
            <button type="button" className="ghost-btn" onClick={() => router.push("/")}>
              Back to the start
            </button>
          </div>
        </div>
      ) : null}
      {state.kind === "ready" ? (
        <div className="retest-card rise" style={{ "--i": 0 }}>
          <p className="field-label">Week-8 retest</p>
          <h1>
            Welcome back, <em>{state.link.participant.first_name}</em>.
          </h1>
          <p className="lede">
            You set your baseline on {formatDate(state.link.baseline.completed_at) ?? "your first visit"}
            {state.link.baseline.cohort ? ` as ${state.link.baseline.cohort}` : ""}. Retesting the same five protocols shows what moved.
          </p>
          <p className="field-hint">
            {state.link.participant.email
              ? "This link is personal to you. On the next screen, your name, email and age are already filled in."
              : `This link is personal to you. On the next screen, enter the email you used before (${state.link.participant.masked_email}); your name and age are already filled in.`}
          </p>
          <div className="btn-row">
            <button type="button" className="primary-btn" onClick={() => router.push("/")}>
              Start my Week-8 retest
            </button>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}

export default function RetestPage() {
  return (
    <Suspense fallback={null}>
      <RetestEntry />
    </Suspense>
  );
}
