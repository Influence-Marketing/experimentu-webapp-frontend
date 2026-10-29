import { expect, test, type Page } from "@playwright/test";

// The guest flow end to end against the real backend: intake, five protocols,
// reveal. Each run uses a fresh email so the backend treats it as a new guest.

const GATE_COOKIE = "u_gate";
const GATE_TOKEN = process.env.E2E_GATE_TOKEN ?? "granted-aug2026";

async function passGate(page: Page) {
  const base = new URL(process.env.E2E_BASE_URL ?? "http://localhost:3000");
  await page.context().addCookies([{ name: GATE_COOKIE, value: GATE_TOKEN, domain: base.hostname, path: "/" }]);
}

async function fillIntake(page: Page, opts: { email: string; phase?: "baseline" | "week8"; age?: number }) {
  await page.goto("/");
  if (opts.phase === "week8") await page.getByRole("button", { name: /week-8/i }).click();
  await page.getByLabel(/first name/i).fill("Maya");
  await page.getByLabel(/^email/i).fill(opts.email);
  await page.getByLabel(/age in years/i).fill(String(opts.age ?? 55));
  await page.getByLabel(/one word/i).fill("Falling");
  await page.getByText(/health data collection/i).click();
}

test.beforeEach(async ({ page }) => {
  await passGate(page);
});

test("baseline happy path scores the session from the backend", async ({ page }) => {
  const email = `e2e-${Date.now()}@example.com`;
  await fillIntake(page, { email });
  const begin = page.getByRole("button", { name: /begin protocol/i });
  await expect(begin).toBeEnabled();
  await begin.click();

  // Protocol I
  await expect(page).toHaveURL(/\/protocol\/nervous/);
  await page.getByLabel("Morning 1").fill("52");
  await page.getByRole("button", { name: /continue to protocol ii/i }).click();

  // Protocol II
  await expect(page).toHaveURL(/\/protocol\/movement/);
  await page.getByLabel(/full stands/i).fill("21");
  await page.getByRole("button", { name: /continue to protocol iii/i }).click();

  // Protocol III (centimetres by default)
  await expect(page).toHaveURL(/\/protocol\/metabolism/);
  await expect(page.getByRole("button", { name: /centimetres/i })).toHaveAttribute("aria-pressed", "true");
  await page.getByLabel(/waist measurement/i).fill("70");
  await page.getByLabel(/height measurement/i).fill("165");
  await expect(page.getByText("0.42")).toBeVisible();
  await page.getByRole("button", { name: /continue to protocol iv/i }).click();

  // Protocol IV
  await expect(page).toHaveURL(/\/protocol\/evidence/);
  await page.getByLabel("Reading 1 systolic").fill("115");
  await page.getByLabel("Reading 1 diastolic").fill("75");
  await page.getByRole("button", { name: /continue to protocol v/i }).click();

  // Protocol V: keyboard-operable radiogroup, all five required
  await expect(page).toHaveURL(/\/protocol\/recovery/);
  const reveal = page.getByRole("button", { name: /reveal my u score/i });
  await expect(reveal).toBeDisabled();
  const groups = page.getByRole("radiogroup");
  await expect(groups).toHaveCount(5);
  for (let i = 0; i < 5; i++) {
    await groups.nth(i).getByRole("radio", { name: /^5/ }).click();
  }
  await expect(reveal).toBeEnabled();
  await reveal.click();

  // Reveal, from the backend's score
  await expect(page).toHaveURL(/\/score/);
  await expect(page.getByText(/your u score/i).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: /unstoppable/i })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/there is no cohort above this one/i)).toBeVisible();
});

test("out-of-range values are stopped before the server", async ({ page }) => {
  const email = `e2e-${Date.now()}-range@example.com`;
  await fillIntake(page, { email });
  await page.getByRole("button", { name: /begin protocol/i }).click();
  await expect(page).toHaveURL(/\/protocol\/nervous/);
  await page.getByLabel("Morning 1").fill("300");
  await expect(page.locator(".field-error").first()).toContainText(/between 30 and 220/i);
  await expect(page.getByRole("button", { name: /continue to protocol ii/i })).toBeDisabled();
});

test("a week-8 retest cannot be opened by typing an email", async ({ page }) => {
  const email = `e2e-${Date.now()}-week8@example.com`;
  await fillIntake(page, { email, phase: "week8" });
  await page.getByRole("button", { name: /begin protocol/i }).click();
  await expect(page.locator(".form-error")).toContainText(/from the link in your report email/i);
  await expect(page).toHaveURL(/\/$/);
});

test("an invalid retest link explains itself", async ({ page }) => {
  await page.goto("/retest?token=not-a-real-token");
  await expect(page.locator(".form-error")).toContainText(/invalid|expired/i);
});

test("consent is required before the intake can be submitted", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel(/first name/i).fill("Maya");
  await page.getByLabel(/^email/i).fill(`e2e-${Date.now()}-consent@example.com`);
  await page.getByLabel(/age in years/i).fill("55");
  await page.getByLabel(/one word/i).fill("Falling");
  await expect(page.getByRole("button", { name: /begin protocol/i })).toBeDisabled();
});

// Needs a live, unused retest token for a baseline guest whose Week-8 window is
// open: E2E_RETEST_TOKEN (from the report email) and E2E_RETEST_EMAIL. Skipped otherwise.
test("a week-8 retest opens from the emailed link and consumes it", async ({ page }) => {
  const token = process.env.E2E_RETEST_TOKEN;
  const email = process.env.E2E_RETEST_EMAIL;
  test.skip(!token || !email, "E2E_RETEST_TOKEN and E2E_RETEST_EMAIL are not set");

  await page.goto(`/retest?token=${token}`);
  await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: /start my week-8 retest/i }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("button", { name: /week-8/i })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: /week-8/i })).toBeDisabled();
  await expect(page.getByText(/open from your personal link/i)).toBeVisible();
  await expect(page.getByLabel(/first name/i)).not.toHaveValue("");

  await page.getByLabel(/^email/i).fill(email!);
  await page.getByLabel(/one word/i).fill("Heights");
  await page.getByText(/health data collection/i).click();
  await page.getByRole("button", { name: /begin protocol/i }).click();

  // A guest redoing a retest from a new device sees the "already submitted" notice first.
  const notice = page.getByRole("dialog");
  const noticeShown = await notice.waitFor({ state: "visible", timeout: 5_000 }).then(() => true, () => false);
  if (noticeShown) await notice.getByRole("button", { name: /^retest$/i }).click();

  await expect(page).toHaveURL(/\/protocol\/nervous/, { timeout: 20_000 });

  // The link is single use.
  await page.goto(`/retest?token=${token}`);
  await expect(page.locator(".form-error")).toContainText(/already been used/i);
});
