"use client";

import { useEffect, useRef, useState } from "react";

const LENGTH = 5;
// Capital letters and digits that can't be mistaken for one another (no 0/O, 1/I/L).
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const WIDTH = 140;
const HEIGHT = 56;

function makeCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(LENGTH));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

// Drawn on a canvas, so the code never sits in the page's text for a script to read.
function drawCode(canvas: HTMLCanvasElement, code: string) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const ratio = window.devicePixelRatio || 1;
  canvas.width = WIDTH * ratio;
  canvas.height = HEIGHT * ratio;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  const style = getComputedStyle(canvas);
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = style.color;
  ctx.font = `700 26px ${style.fontFamily}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const step = WIDTH / (code.length + 1);
  [...code].forEach((char, i) => ctx.fillText(char, step * (i + 1), HEIGHT / 2 + 1));
}

/**
 * The lead form's built-in robot check, used when no reCAPTCHA site key is configured: the guest
 * types back a code of letters and digits and presses Verify. It is checked here in the browser
 * only, so it stops scripts that fill in the page, not ones that call the API directly.
 */
export function TextCaptcha({ onChange }: { onChange: (passed: boolean) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [code, setCode] = useState(makeCode);
  const [answer, setAnswer] = useState("");
  const [status, setStatus] = useState<"idle" | "wrong" | "passed">("idle");
  const passed = status === "passed";

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    let live = true;
    // Wait for the web font so the code isn't drawn in a fallback face.
    if (document.fonts) document.fonts.ready.then(() => live && drawCode(el, code));
    else drawCode(el, code);
    return () => {
      live = false;
    };
  }, [code]);

  const renew = () => {
    setCode(makeCode());
    setAnswer("");
  };

  const verify = () => {
    if (answer.toUpperCase() === code) {
      setStatus("passed");
      onChange(true);
      return;
    }
    // A wrong guess never gets a second try at the same code.
    setStatus("wrong");
    renew();
  };

  return (
    <div className="field-block">
      <label className="field-label" htmlFor="captcha-answer">
        Security check
      </label>
      <div className="tc-row">
        <canvas ref={canvas} className="tc-code" role="img" aria-label="Security code to type in the next box" />
        <input
          id="captcha-answer"
          className="text-input"
          type="text"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="Enter captcha"
          value={answer}
          disabled={passed}
          onChange={(e) => {
            setAnswer(e.target.value.replace(/[^a-z0-9]/gi, "").slice(0, LENGTH));
            if (status === "wrong") setStatus("idle");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && answer.length === LENGTH) {
              e.preventDefault();
              verify();
            }
          }}
        />
        <button
          type="button"
          className="tc-refresh"
          aria-label="Show a new code"
          title="New code"
          disabled={passed}
          onClick={() => {
            setStatus("idle");
            renew();
          }}
        >
          <svg
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
        </button>
        <button
          type="button"
          className={`tc-verify${passed ? " passed" : ""}`}
          disabled={passed || answer.length < LENGTH}
          onClick={verify}
        >
          {passed ? "Verified ✓" : "Verify"}
        </button>
      </div>
      {status === "wrong" ? (
        <p className="field-error" role="alert">
          That didn&apos;t match. Try this new code.
        </p>
      ) : null}
    </div>
  );
}
