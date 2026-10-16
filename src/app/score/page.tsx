"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { ScoreReveal } from "@/components/ScoreReveal";
import { useFlow } from "@/components/FlowProvider";

export default function ScorePage() {
  const router = useRouter();
  const { ready, currentEntry } = useFlow();

  useEffect(() => {
    if (ready && !currentEntry) router.replace("/");
  }, [ready, currentEntry, router]);

  if (!ready || !currentEntry) return null;

  return (
    <AppShell>
      <ScoreReveal entry={currentEntry} />
    </AppShell>
  );
}
