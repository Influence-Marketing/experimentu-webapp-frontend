"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getFearWall, type ApiFearWallWord } from "@/lib/api/statamic";

const REFRESH_MS = 10_000;

// Deterministic placement so a word stays where it is between refreshes.
function hash(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967295;
}

function FearWall() {
  const params = useSearchParams();
  const event = params.get("event") ?? "";
  const [words, setWords] = useState<ApiFearWallWord[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const seen = useRef(new Set<string>());

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const result = await getFearWall(event);
      if (cancelled) return;
      if (!result) {
        setOffline(true);
        return;
      }
      setOffline(false);
      // Keep the list bounded so an 8-hour run never grows without limit.
      setWords(result.words.slice(0, 200));
      setUpdatedAt(result.generated_at);
    };
    load();
    const timer = window.setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [event]);

  const maxWeight = Math.max(1, ...words.map((w) => w.weight));

  return (
    <div className="wall">
      <header className="wall-head">
        <span className="wall-brand">Experiment U™</span>
        <h1>One word for the fear you are experimenting on.</h1>
        <span className="wall-meta">
          {offline ? "Reconnecting…" : words.length ? `${words.length} ${words.length === 1 ? "word" : "words"}` : "Waiting for the first word"}
        </span>
      </header>
      <div className="wall-cloud" aria-live="polite">
        {words.map((w) => {
          const key = w.word.toLowerCase();
          const fresh = !seen.current.has(key);
          seen.current.add(key);
          const scale = 0.9 + (w.weight / maxWeight) * 2.4;
          const x = 6 + hash(key) * 82;
          const y = 8 + hash(key + "y") * 76;
          return (
            <span
              key={key}
              className={`wall-word${fresh ? " fresh" : ""}`}
              style={{ "--scale": scale, "--x": `${x}%`, "--y": `${y}%` }}
              title={`${w.weight} ${w.weight === 1 ? "guest" : "guests"}`}
            >
              {w.word}
            </span>
          );
        })}
      </div>
      <footer className="wall-foot">
        Words are shared anonymously and shown once approved.
        {updatedAt ? ` Updated ${new Date(updatedAt).toLocaleTimeString()}.` : ""}
      </footer>
    </div>
  );
}

export default function WallPage() {
  return (
    <Suspense fallback={null}>
      <FearWall />
    </Suspense>
  );
}
