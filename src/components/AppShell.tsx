"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { scoringConfig } from "@/lib/scoring-config";
import { useFlow } from "./FlowProvider";

export function AppShell({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const { flow, reset } = useFlow();
  const protocolIndex = scoringConfig.domains.findIndex((d) => pathname === `/protocol/${d.id}`);
  const isProtocol = protocolIndex >= 0;
  const isAdmin = pathname.startsWith("/admin");

  const meta = (() => {
    if (isAdmin) {
      return (
        <>
          Roster · <b>Local device</b>
        </>
      );
    }
    if (pathname === "/") {
      return (
        <>
          You are <b>the experiment</b>
        </>
      );
    }
    if (isProtocol) {
      const d = scoringConfig.domains[protocolIndex];
      return (
        <>
          Protocol {d.numeral} · <b>{d.name}</b>
        </>
      );
    }
    if (pathname.startsWith("/score")) {
      return (
        <>
          Result · <b>{flow.participant.phase === "week8" ? "Week-8 retest" : "Baseline"}</b>
        </>
      );
    }
    return (
      <>
        Report · <b>Sealed</b>
      </>
    );
  })();

  return (
    <div className="app">
      <header className="app-header no-print">
        <Link
          className="brand"
          href="/"
          onClick={(e) => {
            e.preventDefault();
            reset();
            router.push("/");
          }}
        >
          <span className="brand-mark">U</span>
          <span className="brand-word">
            Experiment U<span className="brand-tm">™</span>
          </span>
        </Link>
        {isProtocol ? (
          <nav className="stepper" aria-label={`Protocol ${protocolIndex + 1} of 5`}>
            {scoringConfig.domains.map((d, i) => (
              <span
                key={d.id}
                className={`st${i < protocolIndex ? " done" : ""}${i === protocolIndex ? " current" : ""}`}
                style={{ "--st-color": `var(--${d.color}-deep)` }}
                title={d.name}
              >
                {d.numeral}
              </span>
            ))}
          </nav>
        ) : (
          <span className="header-meta">{meta}</span>
        )}
      </header>
      <main className={`app-main${wide || isAdmin ? " wide" : ""}`}>{children}</main>
      <footer className="app-footer no-print">
        {!isAdmin ? (
          <Link href="/admin">Admin roster</Link>
        ) : (
          <button
            type="button"
            onClick={() => {
              reset();
              router.push("/");
            }}
          >
            Back to intake
          </button>
        )}
        <span style={{ margin: "0 10px", color: "var(--dim)" }}>·</span>
        <span>
          Scoring config v{scoringConfig.version} — prototype, not a medical device
        </span>
      </footer>
    </div>
  );
}
