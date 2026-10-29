"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useContent } from "./ContentProvider";
import { useFlow } from "./FlowProvider";

export function AppShell({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const { config } = useContent();
  const { flow, reset } = useFlow();
  const protocolIndex = config.domains.findIndex((_, i) => pathname === `/protocol/${i + 1}`);
  const isProtocol = protocolIndex >= 0;

  const meta = (() => {
    if (pathname === "/") {
      return (
        <>
          You are <b>the experiment</b>
        </>
      );
    }
    if (isProtocol) {
      const d = config.domains[protocolIndex];
      return (
        <>
          Protocol {d.numeral} · <b>{d.name}</b>
        </>
      );
    }
    if (pathname === "/result") {
      return (
        <>
          Result · <b>{flow.participant.phase === "week8" ? "Week-8 retest" : "Baseline"}</b>
        </>
      );
    }
    if (pathname.startsWith("/retest")) {
      return (
        <>
          Week-8 · <b>Retest</b>
        </>
      );
    }
    if (pathname === "/wall") {
      return (
        <>
          Fear wall · <b>Anonymous</b>
        </>
      );
    }
    if (pathname === "/privacy") {
      return (
        <>
          Privacy · <b>Honesty</b>
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
            {config.domains.map((d, i) => (
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
      <main className={`app-main${wide ? " wide" : ""}`}>{children}</main>
      <footer className="app-footer no-print">
        <Link href="/privacy#honesty">Honesty &amp; privacy</Link>
        <span style={{ margin: "0 10px", color: "var(--dim)" }}>·</span>
        <span>
          Scoring config v{config.version} — prototype, not a medical device
        </span>
      </footer>
    </div>
  );
}
