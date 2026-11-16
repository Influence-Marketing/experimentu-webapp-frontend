"use client";

import { useEffect, useImperativeHandle, useRef, useState } from "react";

type Grecaptcha = {
  render: (
    container: HTMLElement,
    params: {
      sitekey: string;
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
    },
  ) => number;
  reset: (widgetId?: number) => void;
};

declare global {
  interface Window {
    grecaptcha?: Grecaptcha;
    __onRecaptchaLoad?: () => void;
  }
}

export type RecaptchaHandle = { reset: () => void };

let loading: Promise<Grecaptcha> | null = null;

// Google's script, loaded once for the whole app and only on a page that shows the checkbox.
function loadRecaptcha(): Promise<Grecaptcha> {
  if (window.grecaptcha?.render) return Promise.resolve(window.grecaptcha);
  loading ??= new Promise<Grecaptcha>((resolve, reject) => {
    window.__onRecaptchaLoad = () => resolve(window.grecaptcha!);
    const script = document.createElement("script");
    script.src = "https://www.google.com/recaptcha/api.js?render=explicit&onload=__onRecaptchaLoad";
    script.async = true;
    script.onerror = () => {
      loading = null;
      script.remove();
      reject(new Error("reCAPTCHA failed to load"));
    };
    document.head.appendChild(script);
  });
  return loading;
}

/**
 * Google reCAPTCHA v2 "I'm not a robot" checkbox. Reports the token while it is valid and null
 * once it expires (two minutes) or is reset.
 */
export function RecaptchaCheckbox({
  siteKey,
  onChange,
  ref,
}: {
  siteKey: string;
  onChange: (token: string | null) => void;
  ref?: React.Ref<RecaptchaHandle>;
}) {
  const box = useRef<HTMLDivElement>(null);
  const widget = useRef<number | null>(null);
  const report = useRef(onChange);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    report.current = onChange;
  });

  useImperativeHandle(ref, () => ({
    reset: () => {
      if (widget.current != null) window.grecaptcha?.reset(widget.current);
      report.current(null);
    },
  }));

  useEffect(() => {
    let cancelled = false;
    // A fresh element per render: grecaptcha refuses to render twice into the same one.
    const target = document.createElement("div");
    box.current?.appendChild(target);
    loadRecaptcha()
      .then((grecaptcha) => {
        if (cancelled) return;
        widget.current = grecaptcha.render(target, {
          sitekey: siteKey,
          callback: (token) => report.current(token),
          "expired-callback": () => report.current(null),
          "error-callback": () => report.current(null),
        });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      widget.current = null;
      target.remove();
      report.current(null);
    };
  }, [siteKey]);

  return (
    <div className="field-block">
      <div ref={box} style={{ minHeight: 78 }} />
      {failed ? (
        <p className="field-error">The robot check couldn&apos;t load. Check your connection and reload the page.</p>
      ) : null}
    </div>
  );
}
