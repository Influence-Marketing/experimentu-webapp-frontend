"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { useFlow } from "@/components/FlowProvider";
import { ReportSheet } from "@/components/ReportSheet";
import { findEntry } from "@/lib/storage";
import type { Entry } from "@/lib/types";

// The sealed report for one result. The token is the result's id on this device: there is no API
// for fetching a report by token yet (the backend emails it as a PDF), so a link opened on another
// device says so instead of showing nothing.
export default function ReportPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const router = useRouter();
  const { ready, flow } = useFlow();
  const [entry, setEntry] = useState<Entry | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    const found = findEntry(token);
    if (found) setEntry(found);
    else setMissing(true);
  }, [token]);

  // The guest's own result goes back to the reveal; anything else was opened from the admin roster.
  const backTo = flow.currentEntryId === token ? "/result" : "/admin";

  return (
    <AppShell>
      {entry && ready ? (
        <ReportSheet entry={entry} onBack={() => router.push(backTo)} />
      ) : missing ? (
        <div className="path-card rise" style={{ "--i": 0 }}>
          <p className="path-kicker">Sealed report</p>
          <h3>This report isn&apos;t on this device</h3>
          <p className="mv-what" style={{ marginTop: 8 }}>
            Reports open on the device that took the measurements. Your copy is also on its way by email.
          </p>
          <p className="mv-what" style={{ marginTop: 12 }}>
            <Link href="/">Start a new experiment</Link>
          </p>
        </div>
      ) : null}
    </AppShell>
  );
}
