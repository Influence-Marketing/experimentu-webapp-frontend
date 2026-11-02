"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { checkRetest, type ApiRetest } from "@/lib/api/statamic";
import { AppShell } from "./AppShell";
import { useFlow } from "./FlowProvider";
import { LoadingOverlay } from "./LoadingOverlay";
import { retestNotice, SubmissionNoticeDialog, type SubmissionNotice } from "./SubmissionNoticeDialog";

function formatDate(iso: string | null | undefined) {
  if (!iso) return null;
  const time = Date.parse(iso);
  return Number.isNaN(time) ? null : new Date(time).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

type State = { kind: "loading" } | { kind: "blocked"; notice: SubmissionNotice } | { kind: "ready"; retest: ApiRetest };

/**
 * The Week-8 retest link from the report email. The API checks its token: when the retest is open
 * the guest is greeted and the intake is prefilled from their baseline; otherwise the API's message
 * shows in the notice dialog, and closing it goes to the start.
 */
export function RetestEntry({ token }: { token: string }) {
  const router = useRouter();
  const { ready, setParticipant, setRetestToken, reset } = useFlow();
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    if (!ready) return;
    if (!token) {
      setState({
        kind: "blocked",
        notice: {
          kind: "retest-unavailable",
          message: "This retest link is missing its token. Open the link from your report email.",
          submissionDate: null,
          retestDate: null,
        },
      });
      return;
    }
    let cancelled = false;
    checkRetest(token).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setState({ kind: "blocked", notice: retestNotice(result) });
        return;
      }
      // A retest link starts a fresh Week-8 session for the baseline guest: name, age and (when the
      // API sends it) email come from the baseline.
      const guest = result.retest.participant;
      reset();
      setParticipant({
        phase: "week8",
        ...(guest ? { firstName: guest.first_name, age: guest.age } : {}),
        ...(guest?.email ? { email: guest.email } : {}),
      });
      setRetestToken(token);
      setState({ kind: "ready", retest: result.retest });
    });
    return () => {
      cancelled = true;
    };
    // Runs once the saved flow is loaded, for this token.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, token]);

  if (!ready) return null;

  const retest = state.kind === "ready" ? state.retest : null;
  const guest = retest?.participant;

  return (
    <AppShell>
      <LoadingOverlay show={state.kind === "loading"} label="Checking your retest link" />
      {retest ? (
        <div className="retest-card rise" style={{ "--i": 0 }}>
          <p className="field-label">Week-8 retest</p>
          <h1>
            Welcome back{guest ? (
              <>
                , <em>{guest.first_name}</em>
              </>
            ) : null}
            .
          </h1>
          <p className="lede">
            You set your baseline on {formatDate(retest.baseline_completed_at) ?? "your first visit"}
            {retest.baseline?.cohort ? ` as ${retest.baseline.cohort}` : ""}. Retesting the same five protocols shows what moved.
          </p>
          <p className="field-hint">
            {guest?.email
              ? "This link is personal to you. On the next screen, your name, email and age are already filled in."
              : guest
                ? `This link is personal to you. On the next screen, enter the email you used before (${guest.masked_email}); your name and age are already filled in.`
                : "This link is personal to you. On the next screen, enter the email you used for your baseline."}
          </p>
          <div className="btn-row">
            <button type="button" className="primary-btn" onClick={() => router.push("/")}>
              Start my Week-8 retest
            </button>
          </div>
        </div>
      ) : null}
      <SubmissionNoticeDialog
        notice={state.kind === "blocked" ? state.notice : null}
        onClose={() => router.replace("/")}
      />
    </AppShell>
  );
}
