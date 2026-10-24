"use client";

import { useEffect, useState } from "react";

/**
 * Full-screen loader over a blurred backdrop while data is on its way. It fades in only after a
 * short wait, so quick answers never flash it, and fades out before it unmounts.
 */
export function LoadingOverlay({ show, label }: { show: boolean; label: string }) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (show) {
      setMounted(true);
      const appear = setTimeout(() => setVisible(true), 120);
      return () => clearTimeout(appear);
    }
    setVisible(false);
    const unmount = setTimeout(() => setMounted(false), 400);
    return () => clearTimeout(unmount);
  }, [show]);

  if (!mounted) return null;

  return (
    <div className={`loading-overlay${visible ? " on" : ""}`} role="status" aria-live="polite" aria-busy={show}>
      <div className="loading-card">
        <div className="loading-mark" aria-hidden="true">
          <span className="loading-ring" />
          <span className="loading-glyph">U</span>
        </div>
        <p className="loading-label">{label}</p>
      </div>
    </div>
  );
}
