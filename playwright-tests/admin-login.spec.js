import { test, expect } from '@playwright/test';

/**
 * Admin sign-in against the Firebase emulators.
 *
 * This is the smallest end-to-end proof that the whole auth path is wired, and it
 * exists because the failure mode is invisible: when the emulator is not
 * connected before the first auth call, sign-in quietly goes to the LIVE project,
 * the credentials do not exist there, and the app just sits on /login. No error,
 * no failed assertion, just a login page that "does not work".
 *
 * So this asserts the emulator actually took over, not merely that login
 * succeeded: the claims read below can only come from a token minted by the local
 * emulator with the admin claim set by scripts/setup-emulator-auth.mjs.
 */

const ADMIN_EMAIL = 'admin@proactive.test';
const ADMIN_PASSWORD = 'admin123';

// Scoped to the form: the language toggle also carries aria-label="Sign in".
const signInButton = (page) => page.locator('form button[type="submit"]');

test('emulator mode is active and the admin can sign in', async ({ page }) => {
  const consoleErrors = [];
  const consoleLog = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
    consoleLog.push(msg.text());
  });

  await page.goto('/login');

  // The emulator banner is logged on module init. If it is absent, Firestore is
  // pointed at production and everything below is meaningless. Asserted against
  // the captured log rather than the page, because it is a console.warn.
  expect(consoleLog.join('\n')).toContain('[firebase] EMULATOR MODE');

  await page.fill('#si-email', ADMIN_EMAIL);
  await page.fill('#si-password', ADMIN_PASSWORD);
  await signInButton(page).click();

  await page.waitForURL('**/dashboard', { timeout: 15000 });

  // Proves the custom claim survived: RequireAdmin renders a refusal screen
  // (not a redirect) when isAdmin is false.
  await expect(page.locator('body')).not.toContainText(/not authorized|غير مصرح/i);
  await expect(page.locator('body')).toContainText(ADMIN_EMAIL);

  expect(consoleErrors, `console errors during login:\n${consoleErrors.join('\n')}`).toEqual([]);
});

test('a non-existent account is rejected instead of silently hanging', async ({ page }) => {
  await page.goto('/login');

  await page.fill('#si-email', 'nobody@proactive.test');
  await page.fill('#si-password', 'wrong-password');
  await signInButton(page).click();

  // An error callout is the contract; being left on /login with nothing said is
  // the bug this guards.
  await expect(page.locator('[role="alert"]')).toBeVisible({ timeout: 10000 });
  await page.waitForURL('**/login');
});

// BLOCKED, not passing. Kept as fixme so the intent is not lost.
//
// The browser Firestore SDK never opens a transport to the local emulator. A CDP
// capture (Network.requestWillBeSent) shows it issuing NO request at all - not to
// 127.0.0.1:8399, and not to firestore.googleapis.com either - then timing out
// with "Could not reach Cloud Firestore backend" and answering every read from
// its empty offline cache. The panel renders "0 products" with no error, so a
// broken transport is indistinguishable from an empty database.
//
// Ruled out by measurement:
//   - data present: REST runQuery on the same project/database returns 6 products
//   - rules allow it: REST runQuery with the admin's own ID token also returns 6
//   - reachable: fetch() from this same page, including a preflighted POST with
//     custom headers, returns 200 from the emulator
//   - config correct: projectId 'proactive-fashion-demo', databaseId '(default)'
//   - not cross-origin: using the same hostname (localhost) as the app changes
//     nothing
//   - not persistence: no Firestore cache is enabled
//   - not the transport mode: experimentalAutoDetectLongPolling changes nothing
//
// This only affects local browser testing. The publish contract this suite
// cannot cover IS verified, at the layer where the Admin SDK does work:
// `node scripts/verify-publish-path.mjs` drives the real catalogCore against the
// emulator and proves an Admin-style batch (product + dirty flag in one batch)
// reaches the storefront snapshot, and that a category rename needs the full
// rebuild the Admin now requests.
test('the products table reads emulator data, not the live project', async ({ page }) => {
  test.fixme('the Admin reads 0 products because the SDK cannot reach the Firestore emulator');

  await page.goto('/login');
  await page.fill('#si-email', ADMIN_EMAIL);
  await page.fill('#si-password', ADMIN_PASSWORD);
  await signInButton(page).click();
  await page.waitForURL('**/dashboard', { timeout: 15000 });

  await page.goto('/dashboard/products');

  // This title exists only in the emulator (scripts/seed-emulator.mjs). Seeing it
  // is positive proof that Firestore is pointed at 127.0.0.1:8399: reading the
  // live project would show a different catalogue entirely. Asserted on the
  // English title because the panel starts in English and renders title, not slug.
  await expect(
    page.getByText('Floral Summer Dress').first(),
    'expected the emulator-seeded product to be listed'
  ).toBeVisible({ timeout: 15000 });
});