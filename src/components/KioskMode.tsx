"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { applyKioskParam, KIOSK_IDLE_SECONDS, KIOSK_WARN_SECONDS } from "@/lib/kiosk";
import { wipeDevice } from "@/lib/storage";
import { useFlow } from "./FlowProvider";

/**
 * Venue kiosk behaviour, on when the device was opened with ?kiosk=1: an idle
 * warning, then a full wipe of the guest's state (flow, local report history)
 * and a return to a clean intake, plus an always-visible "New guest" button.
 * Mounted once in the root layout.
 */
export function KioskMode() {
  const router = useRouter();
  const pathname = usePathname();
  const { ready, reset } = useFlow();
  const [kiosk, setKiosk] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const lastActivity = useRef(Date.now());

  useEffect(() => {
    setKiosk(applyKioskParam());
  }, [pathname]);

  const newGuest = useCallback(() => {
    wipeDevice();
    reset();
    setSecondsLeft(null);
    lastActivity.current = Date.now();
    router.replace("/");
  }, [reset, router]);

  useEffect(() => {
    if (!kiosk || !ready) return;
    const touch = () => {
      lastActivity.current = Date.now();
      setSecondsLeft(null);
    };
    const events = ["pointerdown", "keydown", "touchstart", "scroll"] as const;
    events.forEach((e) => window.addEventListener(e, touch, { passive: true }));
    const timer = window.setInterval(() => {
      // Nothing to protect on an untouched intake.
      if (pathname === "/" && secondsLeft === null && Date.now() - lastActivity.current < KIOSK_IDLE_SECONDS * 1000) return;
      const idle = Math.floor((Date.now() - lastActivity.current) / 1000);
      const left = KIOSK_IDLE_SECONDS - idle;
      if (left <= 0) {
        newGuest();
      } else if (left <= KIOSK_WARN_SECONDS) {
        setSecondsLeft(left);
      }
    }, 1000);
    return () => {
      events.forEach((e) => window.removeEventListener(e, touch));
      window.clearInterval(timer);
    };
  }, [kiosk, ready, pathname, secondsLeft, newGuest]);

  if (!kiosk) return null;

  return (
    <>
      <button type="button" className="kiosk-new-guest no-print" onClick={newGuest}>
        New guest
      </button>
      {secondsLeft !== null ? (
        <div className="kiosk-idle" role="alertdialog" aria-live="assertive" aria-label="Idle warning">
          <div className="kiosk-idle-card">
            <p className="kiosk-idle-kicker">Still there?</p>
            <h2>Starting fresh for the next guest in {secondsLeft}s</h2>
            <p>Tap anywhere to keep going.</p>
          </div>
        </div>
      ) : null}
    </>
  );
}
