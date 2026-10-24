"use client";

import { AppShell } from "@/components/AppShell";
import { useFlow } from "@/components/FlowProvider";
import { WelcomeForm } from "@/components/WelcomeForm";

export default function HomePage() {
  const { ready, resuming } = useFlow();
  // Hold the intake back until the saved flow is loaded, and while a return visit is being sent
  // back to its step, so neither flashes an empty or stale form.
  return <AppShell>{ready && !resuming ? <WelcomeForm /> : null}</AppShell>;
}
