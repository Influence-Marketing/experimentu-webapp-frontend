"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { getFearWall, type ApiFearWall } from "@/lib/api/statamic";

// The API caches the wall for 30 seconds, so polling any faster gains nothing.
const POLL_MS = 30_000;

// The event wall: every guest's one-word health fear, anonymous and moderated, sized by how many
// guests gave the same word. Meant to run unattended on a screen, so it keeps refreshing.
export default function WallPage() {
  const [wall, setWall] = useState<ApiFearWall | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = () =>
      getFearWall().then((next) => {
        if (!alive) return;
        if (next) setWall(next);
        setFailed(!next);
      });
    load();
    const timer = setInterval(load, POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  const heaviest = Math.max(1, ...(wall?.words.map((w) => w.weight) ?? []));

  return (
    <AppShell wide>
      <div className="wall rise" style={{ "--i": 0 }}>
        <p className="reveal-kicker">The fear wall · anonymous</p>
        <h1 className="wall-title">
          One word from <em>every guest</em>.
        </h1>
        {wall?.words.length ? (
          <ul className="wall-words" aria-label={`${wall.count} words`}>
            {wall.words.map((w) => (
              <li key={w.word} style={{ "--w": w.weight / heaviest }} title={`${w.weight} ${w.weight === 1 ? "guest" : "guests"}`}>
                {w.word}
              </li>
            ))}
          </ul>
        ) : wall ? (
          <p className="field-hint">No words on the wall yet.</p>
        ) : null}
        {failed ? (
          <p className="field-hint" role="status">
            We couldn&apos;t refresh the wall. Trying again every 30 seconds.
          </p>
        ) : null}
      </div>
    </AppShell>
  );
}
