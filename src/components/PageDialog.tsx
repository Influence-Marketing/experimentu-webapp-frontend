"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getPages, type StatamicPage } from "@/lib/api/statamic";

/** The CMS pages linked from the site, by their `pages` collection slug. */
export const LEGAL_PAGES = [
  { slug: "honesty-privacy", label: "Honesty & Privacy" },
  { slug: "terms-and-conditions", label: "Terms and Conditions" },
  { slug: "health-data-collection", label: "Health Data Collection" },
] as const;

export type LegalPageSlug = (typeof LEGAL_PAGES)[number]["slug"];

type State = { kind: "loading" } | { kind: "failed" } | { kind: "ready"; page: StatamicPage | null };

/**
 * A popup showing one entry of the CMS `pages` collection. The pages are fetched the first time any
 * popup opens; `content` is the CMS's rich-text HTML, written by the site's own editors.
 */
export function PageDialog({ slug, onClose }: { slug: LegalPageSlug | null; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [state, setState] = useState<State>({ kind: "loading" });

  const load = useCallback((wanted: LegalPageSlug) => {
    setState({ kind: "loading" });
    getPages().then((pages) =>
      setState(pages ? { kind: "ready", page: pages.find((p) => p.slug === wanted) ?? null } : { kind: "failed" }),
    );
  }, []);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (slug) {
      load(slug);
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [slug, load]);

  const label = LEGAL_PAGES.find((p) => p.slug === slug)?.label ?? "";
  const page = state.kind === "ready" ? state.page : null;

  return (
    <dialog
      ref={ref}
      className="notice-dialog page-dialog"
      aria-labelledby="page-dialog-title"
      onClose={onClose}
      // A click on the dialog element itself (not the card inside it) is a click on the backdrop.
      onClick={(e) => {
        if (e.target === e.currentTarget) e.currentTarget.close();
      }}
    >
      {slug ? (
        <div className="notice-card page-card">
          <div className="page-card-head">
            <h2 id="page-dialog-title">{page?.title ?? label}</h2>
            <button type="button" className="dialog-close" aria-label="Close" onClick={() => ref.current?.close()}>
              ×
            </button>
          </div>
          <div className="page-card-body">
            {state.kind === "loading" ? (
              <p className="field-hint" role="status">
                Loading…
              </p>
            ) : state.kind === "failed" ? (
              <p className="form-error" role="alert">
                We couldn&apos;t load this page.{" "}
                <button type="button" className="inline-link" onClick={() => load(slug)}>
                  Try again
                </button>
              </p>
            ) : page?.content ? (
              <div className="legal page-content" dangerouslySetInnerHTML={{ __html: page.content }} />
            ) : (
              <p className="field-hint">This page has no content yet.</p>
            )}
          </div>
        </div>
      ) : null}
    </dialog>
  );
}
