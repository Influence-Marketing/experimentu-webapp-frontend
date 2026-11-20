# Member portal sign-in

The member hub links to `/auth/member/start`. This creates a random browser state and PKCE verifier in an HttpOnly cookie, then redirects to the fixed Experiment U portal. `/auth/member/callback` validates the browser binding and redeems the code through the backend, stores the resulting U Score session in its own HttpOnly cookie, and removes the code from the address before rendering the assessment.

Members' names and verified emails are prefilled; the authenticated intake binds email on the server. New members choose their own assessment and marketing consents. Returning members resume their own latest saved assessment from the backend. Member device caches are scoped by account in session storage, separate from the guest/kiosk cache. A footer link returns to the hub, and U Score has its own sign-out control.

## Server settings

```
USCORE_MEMBER_SSO_ENABLED=true
USCORE_APP_ORIGIN=https://uscore.joinajenda.com
USCORE_API_BASE_URL=https://scoreu-backend.on-forge.com
```

These settings are server-only. Keep the existing `NEXT_PUBLIC_API_BASE_URL` for browser API calls, and add the new frontend origin to the backend's CORS configuration. The portal's `USCORE_APP_ORIGIN` must exactly match this frontend origin. The backend needs its matching member-session migration and `EXPU_PORTAL_SSO_ENABLED=true`; the portal needs migration `0032_uscore_member_handoff.sql` and its handoff routes.

The domain must resolve to the frontend virtual host and have a valid HTTPS certificate before activation. Cookies use the `__Host-` prefix in production, with Secure, HttpOnly, SameSite=Lax and no shared parent-domain setting.

## Verification

Run `node --test scripts/test-member-sign-in.cjs`, `npm run typecheck`, and `npm run build`. The member-sign-in tests use fictional identities and stubbed network calls. The existing live-backend Playwright workflow creates participant records; do not run it as part of this change while outbound email is stopped.

Next.js was patched from 15.5.9 to 15.5.29 because the installed version had a critical advisory. No major-version migration is included.

Explicit member sign-in exits kiosk mode. Valid personal retest paths survive the sign-in round trip; external return URLs are rejected. Resetting a member assessment keeps the verified identity and does not interrupt the retest route.
