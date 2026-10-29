# Experiment U™ — U Score guest site

Next.js (App Router) front end of the U Score™ microsite. The Statamic backend in the sibling `experimentu-webapp-backend` checkout owns content, forms, scoring, the sealed report and email; this site renders the guest flow against it.

## Run it

```bash
npm install
cp .env.example .env.local   # NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8010/
npm run dev                  # http://localhost:3000
```

The backend must be up on the URL in `NEXT_PUBLIC_API_BASE_URL` (`php artisan serve --port=8010` in the backend checkout) with that origin in its `CORS_ALLOWED_ORIGINS`. `.claude/launch.json` starts both.

The whole site sits behind a private-preview gate (`/gate`); the passphrase is `GATE_PASSWORD` (default in `src/lib/gate.ts`). Without a reachable backend the intake and protocol screens still render from the bundled copy in `src/lib/scoring-config.ts` and `src/lib/lead-form-config.ts`, but nothing can be submitted.

## Routes

| Route | What it is |
| --- | --- |
| `/` | Intake: session, first name, email, age, fear word, consents. Posts the lead form and holds the returned Bearer token. |
| `/protocol/{nervous,movement,metabolism,evidence,recovery}` | The five protocols, each posted to its Statamic form with the token; saved answers are prefilled on return. |
| `/score` | The reveal, from `GET /api/participants/{id}/score`. |
| `/report`, `/report/{id}` | The sealed report sheet for the current or a locally kept entry. |
| `/retest?token=…` | Entry for the Week-8 retest link from the report email: greets the guest, prefills name and age, locks the session to Week-8 and sends the token with the lead. A Week-8 lead without it is refused by the backend. |
| `/wall?event=…` | Venue display of approved fear words (`GET /api/fear-wall`), refreshed every 10 s, sized by frequency, never a name. |

Add `?kiosk=1` to any URL on a venue device to turn on kiosk mode (`?kiosk=0` turns it off): a floating *New guest* button, browser autofill off on the intake, and after 90 s idle a 15 s warning then a full wipe of the guest's state and local report history (`src/lib/kiosk.ts`, `src/components/KioskMode.tsx`).

## What the site sends

- First-touch `utm_source`, `utm_medium`, `utm_campaign`, the external referrer and `event` (or `event_id`) from the arrival URL are kept on the device and sent with the lead (`src/lib/attribution.ts`).
- Number fields are range-checked on the client from the same input specs they render with (`src/lib/ranges.ts`); the server validates again.
- Protocol III defaults to centimetres; switching units clears the values.

## Checks

```bash
npm run typecheck
npm run lint
npm run e2e        # Playwright, against a running site + backend (E2E_BASE_URL, default http://localhost:3000)
```

The Playwright suite in `e2e/` walks the baseline happy path, the range check, the consent requirement, the Week-8 refusals and, when `E2E_RETEST_TOKEN` and `E2E_RETEST_EMAIL` are set, a Week-8 retest through the emailed link. `.github/workflows/e2e.yml` boots both apps and runs it on pull requests to `main`; it needs `BACKEND_REPO_TOKEN` while the backend repository is private.
