"use client";

import { AppShell } from "@/components/AppShell";
import { useFlow } from "@/components/FlowProvider";
import { WelcomeForm, WelcomeHero } from "@/components/WelcomeForm";

export default function HomePage() {
  const { ready, resuming } = useFlow();
  const showForm = ready && !resuming;
  // The headline is static, so it renders on the server and paints straight away. The intake form is
  // rendered from the start too, so its space is held and nothing below it jumps, but it stays hidden
  // and inert until the saved flow is loaded, and while a return visit is being sent back to its step,
  // so it never flashes empty or stale. A return visit hides the headline as well while it's sent on.
  return (
    <AppShell>
      {!resuming ? <WelcomeHero /> : null}
      <div style={{ visibility: showForm ? "visible" : "hidden" }} inert={!showForm} aria-hidden={!showForm}>
        <WelcomeForm />
      </div>
    </AppShell>
  );
}
