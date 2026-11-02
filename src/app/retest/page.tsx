"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { RetestEntry } from "@/components/RetestEntry";

// The Week-8 retest link from the report email: /retest?token=…
function RetestFromQuery() {
  const token = useSearchParams().get("token") ?? "";
  return <RetestEntry token={token} />;
}

export default function RetestPage() {
  return (
    <Suspense fallback={null}>
      <RetestFromQuery />
    </Suspense>
  );
}
