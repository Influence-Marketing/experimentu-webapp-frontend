"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { ReportSheet } from "@/components/ReportSheet";
import { useFlow } from "@/components/FlowProvider";

export default function ReportPage() {
  const router = useRouter();
  const { ready, currentEntry } = useFlow();

  useEffect(() => {
    if (ready && !currentEntry) router.replace("/");
  }, [ready, currentEntry, router]);

  if (!ready || !currentEntry) return null;

  return (
    <AppShell>
      <ReportSheet entry={currentEntry} onBack={() => router.push("/score")} />
    </AppShell>
  );
}
