"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useContent } from "./ContentProvider";
import { useFlow } from "./FlowProvider";
import { LEGAL_PAGES, PageDialog, type LegalPageSlug } from "./PageDialog";

export function AppShell({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const { config, scoring } = useContent();
  const { flow, member, reset } = useFlow();
  const [openPage, setOpenPage] = useState<LegalPageSlug | null>(null);
  const protocolIndex = config.protocols.findIndex((_, i) => pathname === `/protocol/${i + 1}`);
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
      const d = config.protocols[protocolIndex];
      return (
        <>
          Protocol {d.numeral} · <b>{d.name}</b>
        </>
      );
    }
    if (pathname === "/result") {
      return (
        <>
          Result · <b>{flow.participant.phase === "week8" ? "Retest" : "Baseline"}</b>
        </>
      );
    }
    if (pathname.startsWith("/retest")) {
      return (
        <>
          Your <b>Retest</b>
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
            {config.protocols.map((d, i) => (
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
        {member ? <div style={{marginBottom:12}}><a href="https://experimentu.joinajenda.com/dashboard">Return to your member hub →</a>{" · "}<form style={{display:"inline"}} action="/api/member/session" method="post"><button type="submit">Sign out of U Score</button></form></div> : null}
        {LEGAL_PAGES.map((page) => (
          <Fragment key={page.slug}>
            <button type="button" onClick={() => setOpenPage(page.slug)}>
              {page.label}
            </button>
            <span style={{ margin: "0 10px", color: "var(--dim)" }}>·</span>
          </Fragment>
        ))}
        <span>
          Scoring config v{scoring?.version ?? config.version} — a wellness index, not a medical device
        </span>
      </footer>
      <PageDialog slug={openPage} onClose={() => setOpenPage(null)} />
    </div>
  );
}
