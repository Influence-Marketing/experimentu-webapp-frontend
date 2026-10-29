"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { useFlow } from "@/components/FlowProvider";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { getRetest, type ApiRetest } from "@/lib/api/statamic";

const formatDay = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

// The Week-8 retest link from the sealed report email. It greets the guest from their baseline and
// starts a fresh intake set to Week-8 Retest; the email isn't prefilled because the API only sends a
// masked copy, and typing it again is how the server checks the link is theirs.
export default function RetestPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const router = useRouter();
  const { reset, setParticipant } = useFlow();
  const [state, setState] = useState<{ retest: ApiRetest } | { message: string } | null>(null);

  useEffect(() => {
    getRetest(token).then((result) => setState(result.ok ? { retest: result.retest } : { message: result.message }));
  }, [token]);

  const start = (retest: ApiRetest) => {
    reset();
    setParticipant({
      firstName: retest.participant.first_name,
      age: retest.participant.age,
      phase: "week8",
    });
    router.push("/");
  };

  return (
    <AppShell>
      <LoadingOverlay show={state === null} label="Checking your retest link" />
      {state && "retest" in state ? (
        <div className="path-card rise" style={{ "--i": 0 }}>
          <p className="path-kicker">Week-8 retest</p>
          <h3>
            Welcome back, <em>{state.retest.participant.first_name}</em>.
          </h3>
          {state.retest.baseline.total != null ? (
            <p className="mv-what" style={{ marginTop: 8 }}>
              {[
                `Your baseline: ${state.retest.baseline.total}`,
                state.retest.baseline.cohort,
                state.retest.baseline.completed_at ? formatDay(state.retest.baseline.completed_at) : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          ) : null}
          <p className="mv-what" style={{ marginTop: 8 }}>
            Use the email you started with: <b>{state.retest.participant.masked_email}</b>
          </p>
          <div className="btn-row">
            <button type="button" className="primary-btn" onClick={() => start(state.retest)}>
              Start your Week-8 retest
            </button>
          </div>
          <p className="field-hint" style={{ marginTop: 14 }}>
            This link works until {formatDay(state.retest.expires_at)}.
          </p>
        </div>
      ) : state ? (
        <div className="form-error" role="alert">
          {state.message} <Link href="/">Go to the intake</Link>
        </div>
      ) : null}
    </AppShell>
  );
}
