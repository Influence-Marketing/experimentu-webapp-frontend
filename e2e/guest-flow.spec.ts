import { expect, test, type Page } from "@playwright/test";

// The guest flow end to end against the real backend (scoring config 2.0.0): intake, five
// protocols, reveal. Each run uses a fresh email so the backend treats it as a new guest.
// The readings are Guest B from the calculation repo's examples: a woman of 52 who scores 61.
//
// The intake's robot check is the built-in TextCaptcha unless a reCAPTCHA site key is set; the
// site under test must run with NEXT_PUBLIC_CAPTCHA_TEST_CODE (default here: TEST2) so the code
// is known. E2E_CAPTCHA_CODE overrides it.

const CAPTCHA_CODE = process.env.E2E_CAPTCHA_CODE ?? "TEST2";

async function passCaptcha(page: Page) {
  const answer = page.getByLabel(/security code|captcha/i).first();
  if (!(await answer.isVisible().catch(() => false))) return;
  await page.locator("#captcha-answer").fill(CAPTCHA_CODE);
  await page.getByRole("button", { name: /^verify$/i }).click();
}

async function fillIntake(page: Page, opts: { email: string; phase?: "baseline" | "week8"; age?: number }) {
  await page.goto("/");
  if (opts.phase === "week8") await page.getByRole("button", { name: /^retest$/i }).click(); // the session toggle says Retest since 17 November
  await page.getByLabel(/first name/i).fill("Bea");
  await page.getByLabel(/age in years/i).fill(String(opts.age ?? 52));
  await page.getByRole("button", { name: /^women's$/i }).click(); // "Which ranges should we compare you with?" (17 November)
  await page.getByLabel(/one word/i).fill("Falling");
  await page.locator(".consent-check").filter({ hasText: /health data/i }).locator("input").check();
  await passCaptcha(page);
  // Last, because leaving the email field of a Week-8 intake asks the API and the answer opens a
  // notice dialog; filled earlier, that dialog can land while the clicks above are still going.
  await page.getByLabel(/^email/i).fill(opts.email);
}

async function pick(page: Page, statement: RegExp, answer: string) {
  await page.getByRole("radiogroup", { name: statement }).getByRole("radio", { name: new RegExp(`^${answer} `) }).click();
}

test("baseline happy path scores the session from the backend", async ({ page }) => {
  const email = `e2e-${Date.now()}@example.com`;
  await fillIntake(page, { email });
  const begin = page.getByRole("button", { name: /begin protocol/i });
  await expect(begin).toBeEnabled();
  await begin.click();

  // Protocol I: HRV, seated resting heart rate, sleep
  // The lead submission also records consents and queues the CRM sync, so allow it time.
  await expect(page).toHaveURL(/\/protocol\/1/, { timeout: 30_000 });
  const next1 = page.getByRole("button", { name: /continue to protocol ii/i });
  await expect(next1).toBeDisabled();
  await page.getByLabel(/^HRV/i).fill("21");
  await page.getByLabel(/resting heart rate, seated reading 1/i).fill("75");
  await page.getByLabel(/resting heart rate, seated reading 2/i).fill("73");
  await page.getByLabel(/hours of sleep/i).fill("6.5");
  await page.getByRole("radiogroup", { name: /sleep quality|rate your sleep/i }).getByRole("radio", { name: /^fair$/i }).click();
  await expect(next1).toBeEnabled();
  await next1.click();

  // Protocol II: sit-to-stand, three grip squeezes (dominant hand), activity
  await expect(page).toHaveURL(/\/protocol\/2/);
  await page.getByLabel(/full stands/i).fill("13");
  await expect(page.getByLabel(/more than 15 seconds for the first 5 stands/i)).not.toBeChecked(); // a box since 18 November, no time
  for (const [n, kg] of [["1", "23"], ["2", "24"], ["3", "22"]]) {
    await page.getByLabel(new RegExp(`^(Grip )?squeeze ${n} `, "i")).fill(kg);
  }
  await page.getByLabel(/days (a week )?of moderate or vigorous/i).fill("3");
  await page.getByLabel(/minutes on those days/i).fill("30");
  await page.getByLabel(/days (a week )?of muscle-strengthening/i).fill("0");
  await page.getByRole("button", { name: /continue to protocol iii/i }).click();

  // Protocol III: inches by default; waist and height (the hip is not measured); fibre
  await expect(page).toHaveURL(/\/protocol\/3/);
  await expect(page.getByRole("button", { name: /^inches$/i })).toHaveAttribute("aria-pressed", "true");
  await page.getByLabel(/^waist$/i).fill("33");
  await page.getByLabel(/^height$/i).fill("64");
  await expect(page.getByText("0.52")).toBeVisible();
  await page.getByLabel(/whole-grain/i).fill("1");
  await page.getByLabel(/fruit and vegetable/i).fill("3");
  await page.getByLabel(/beans, lentils/i).fill("2");
  await page.getByRole("button", { name: /continue to protocol iv/i }).click();

  // Protocol IV: body fat
  await expect(page).toHaveURL(/\/protocol\/4/);
  await page.getByLabel(/body fat percentage/i).fill("36");
  await page.getByRole("button", { name: /continue to protocol v/i }).click();

  // Protocol V: WHO-5 and UCLA-3, keyboard-operable radiogroups, all eight required
  await expect(page).toHaveURL(/\/protocol\/5/);
  const reveal = page.getByRole("button", { name: /reveal my u score/i });
  await expect(reveal).toBeDisabled();
  await expect(page.getByRole("radiogroup")).toHaveCount(8);
  await pick(page, /cheerful/i, "3");
  await pick(page, /calm and relaxed/i, "3");
  await pick(page, /active and vigorous/i, "2");
  await pick(page, /fresh and rested/i, "2");
  await pick(page, /things that interest me/i, "3");
  await pick(page, /lack companionship/i, "2");
  await pick(page, /left out/i, "1");
  await pick(page, /isolated/i, "2");
  await expect(reveal).toBeEnabled();
  await reveal.click();

  // Reveal, from the backend's score: 61, Uplifted, five areas. The last submit scores the session
  // and sends the sealed report, so allow it time.
  await expect(page).toHaveURL(/\/result/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: /uplifted/i })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/61/).first()).toBeVisible();
  await expect(page.getByText(/five areas · 20 points each/i)).toBeVisible();
  await expect(page.getByText(/HRV is right where I'd expect for a woman your age/i)).toBeVisible();
});

test("a not-scored reason completes a protocol without its readings", async ({ page }) => {
  const email = `e2e-${Date.now()}-ns@example.com`;
  await fillIntake(page, { email });
  await page.getByRole("button", { name: /begin protocol/i }).click();
  // The lead submission also records consents and queues the CRM sync, so allow it time.
  await expect(page).toHaveURL(/\/protocol\/1/, { timeout: 30_000 });
  const next = page.getByRole("button", { name: /continue to protocol ii/i });
  await page.getByLabel(/heart medication, pacemaker or irregular heartbeat/i).selectOption("pacemaker");
  await expect(next).toBeDisabled();
  await page.getByLabel(/hours of sleep/i).fill("7");
  await page.getByRole("radiogroup", { name: /sleep quality|rate your sleep/i }).getByRole("radio", { name: /^good$/i }).click();
  await expect(page.getByText(/will show as/i)).toContainText(/not scored/i);
  await expect(next).toBeEnabled();
});

test("out-of-range values are stopped before the server", async ({ page }) => {
  const email = `e2e-${Date.now()}-range@example.com`;
  await fillIntake(page, { email });
  await page.getByRole("button", { name: /begin protocol/i }).click();
  // The lead submission also records consents and queues the CRM sync, so allow it time.
  await expect(page).toHaveURL(/\/protocol\/1/, { timeout: 30_000 });
  await page.getByLabel(/resting heart rate, seated reading 1/i).fill("300");
  await expect(page.locator(".field-error").first()).toContainText(/between 30 and 220/i);
  await expect(page.getByRole("button", { name: /continue to protocol ii/i })).toBeDisabled();
});

test("a week-8 retest cannot be started with an email that has no baseline", async ({ page }) => {
  const email = `e2e-${Date.now()}-week8@example.com`;
  await fillIntake(page, { email, phase: "week8" });
  // Leaving the email field asks the API; a notice says the retest isn't available and Begin stays disabled.
  await page.getByLabel(/^email/i).blur();
  const notice = page.getByRole("dialog");
  await expect(notice).toBeVisible({ timeout: 15_000 });
  await notice.getByRole("button").last().click();
  await expect(page.getByRole("button", { name: /begin protocol/i })).toBeDisabled();
  await expect(page).toHaveURL(/\/$/);
});

test("an invalid retest link explains itself", async ({ page }) => {
  await page.goto("/retest?token=not-a-real-token");
  await expect(page.getByRole("dialog")).toContainText(/invalid|expired|not|link/i, { timeout: 15_000 });
});

test("consent and sex are required before the intake can be submitted", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel(/first name/i).fill("Bea");
  await page.getByLabel(/^email/i).fill(`e2e-${Date.now()}-consent@example.com`);
  await page.getByLabel(/age in years/i).fill("52");
  await page.getByLabel(/one word/i).fill("Falling");
  await page.locator(".consent-check").filter({ hasText: /health data/i }).locator("input").check();
  await passCaptcha(page);
  await expect(page.getByRole("button", { name: /begin protocol/i })).toBeDisabled();
  await page.getByRole("button", { name: /^men's$/i }).click(); // only women's or men's ranges since 17 November
  await expect(page.getByRole("button", { name: /begin protocol/i })).toBeEnabled();
});

// Needs a live, unused retest token for a baseline guest whose Week-8 window is
// open: E2E_RETEST_TOKEN (from the report email) and E2E_RETEST_EMAIL. Skipped otherwise.
test("a week-8 retest opens from the emailed link and consumes it", async ({ page }) => {
  const token = process.env.E2E_RETEST_TOKEN;
  const email = process.env.E2E_RETEST_EMAIL;
  test.skip(!token || !email, "E2E_RETEST_TOKEN and E2E_RETEST_EMAIL are not set");

  await page.goto(`/retest?token=${token}`);
  await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: /start my retest/i }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("button", { name: /^retest$/i })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: /^retest$/i })).toBeDisabled();
  await expect(page.getByText(/open from your personal link/i)).toBeVisible();
  await expect(page.getByLabel(/first name/i)).not.toHaveValue("");

  await page.getByLabel(/^email/i).fill(email!);
  await page.getByRole("button", { name: /^women's$/i }).click(); // "Which ranges should we compare you with?" (17 November)
  await page.getByLabel(/one word/i).fill("Heights");
  await page.locator(".consent-check").filter({ hasText: /health data/i }).locator("input").check();
  await passCaptcha(page);
  await page.getByRole("button", { name: /begin protocol/i }).click();

  // A guest redoing a retest from a new device sees the "already submitted" notice first.
  const notice = page.getByRole("dialog");
  const noticeShown = await notice.waitFor({ state: "visible", timeout: 5_000 }).then(() => true, () => false);
  if (noticeShown) await notice.getByRole("button", { name: /continue|retest/i }).click();

  await expect(page).toHaveURL(/\/protocol\/1/, { timeout: 20_000 });

  // The link is single use.
  await page.goto(`/retest?token=${token}`);
  await expect(page.getByRole("dialog")).toContainText(/already been used/i, { timeout: 15_000 });
});
