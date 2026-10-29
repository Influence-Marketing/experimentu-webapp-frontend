"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useFlow } from "@/components/FlowProvider";

// Reports live at /report/{token}; the bare path opens the current result's report.
export default function CurrentReportPage() {
  const router = useRouter();
  const { ready, flow } = useFlow();

  useEffect(() => {
    if (ready) router.replace(flow.currentEntryId ? `/report/${flow.currentEntryId}` : "/");
  }, [ready, flow.currentEntryId, router]);

  return null;
}
