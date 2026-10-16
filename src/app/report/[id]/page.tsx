"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { ReportSheet } from "@/components/ReportSheet";
import { findEntry } from "@/lib/storage";
import type { Entry } from "@/lib/types";

export default function SavedReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [entry, setEntry] = useState<Entry | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    const found = findEntry(id);
    if (found) setEntry(found);
    else setMissing(true);
  }, [id]);

  useEffect(() => {
    if (missing) router.replace("/admin");
  }, [missing, router]);

  if (!entry) return null;

  return (
    <AppShell>
      <ReportSheet entry={entry} onBack={() => router.push("/admin")} />
    </AppShell>
  );
}
