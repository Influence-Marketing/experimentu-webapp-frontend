import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { scoringConfig } from "@/lib/scoring-config";

export const metadata: Metadata = {
  title: "Privacy & honesty — Experiment U™",
};

// What the prototype collects and why, and how honest the U Score™ is about itself. Only what the
// app and its API actually do is described here; the full privacy policy replaces this before launch.
export default function PrivacyPage() {
  const { honesty } = scoringConfig;
  return (
    <AppShell>
      <article className="legal rise" style={{ "--i": 0 }}>
        <p className="reveal-kicker">Privacy &amp; honesty</p>
        <h1>What we collect, and what the score is.</h1>

        <h2>What you give us</h2>
        <ul>
          <li>
            <b>Intake:</b> first name, email, age, one word for your biggest health fear, and whether this is
            your baseline or Week-8 retest.
          </li>
          <li>
            <b>Your five measurements:</b> resting heart rate, 30-second sit-to-stand, waist and height, blood
            pressure, and the WHO-5 well-being questions.
          </li>
          <li>
            <b>Optional extras</b>, only if you add them: heart rate variability, grip strength, average glucose
            and body fat percentage. They are recorded for your report, not scored.
          </li>
          <li>
            <b>Your choices:</b> consent to collecting this health data (required to take part) and whether
            you&apos;d like promotional emails (optional).
          </li>
        </ul>

        <h2>What we do with it</h2>
        <ul>
          <li>Calculate your U Score™ and show it to you.</li>
          <li>Email you your sealed report, with a link to your Week-8 retest.</li>
          <li>Send promotional emails only if you said yes to them.</li>
          <li>
            Show your one word on the <Link href="/wall">fear wall</Link>, never with your name, and only
            after it has been reviewed.
          </li>
        </ul>

        <h2>On this device</h2>
        <p>
          This browser keeps your progress and results so a session can pick up where it left off and your
          report can open here. Choosing <b>Done</b> on your result clears the session in progress.
        </p>

        <h2 id="honesty">How honest the score is</h2>
        <p>{honesty.footer}</p>
        <p>{honesty.bpCitation}</p>
        <p>Each domain shows the category your measurement falls in, rather than a percentile.</p>

        <p className="field-hint">
          This page describes the Experiment U™ prototype. The full privacy policy replaces it before launch.
        </p>
      </article>
    </AppShell>
  );
}
