import { test } from '@playwright/test';

// Diagnoses the live production apps. Public read of products_egp is allowed by
// the deployed rules, so the Firestore path can be exercised without signing in
// and any failure reported here is the real error code, not a guess.

test('live Admin: can it read the catalogue?', async ({ page }) => {
  const logs = [];
  page.on('console', (m) => logs.push(`[${m.type()}] ${m.text().slice(0, 200)}`));
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message.slice(0, 200)}`));

  await page.goto('https://pro-active-admin.vercel.app/login', { waitUntil: 'domcontentloaded' });

  const result = await page.evaluate(async () => {
    const out = {};
    try {
      const app = await import('/src/services/firebase.js');
      out.projectId = app.auth?.app?.options?.projectId;
      out.databaseId = app.DATABASE_ID;

      const depUrl = performance
        .getEntriesByType('resource')
        .map((e) => e.name)
        .find((n) => n.includes('firebase_firestore.js'));
      out.depFound = Boolean(depUrl);

      const products = await import('/src/services/products.js');
      const list = await products.fetchAllProducts();
      out.count = list.length;
      out.sample = list.slice(0, 3).map((p) => p.title?.en ?? p.slug);
    } catch (e) {
      out.errorCode = e?.code ?? null;
      out.errorName = e?.name ?? null;
      out.errorMessage = String(e?.message ?? e).slice(0, 300);
    }
    return out;
  });

  console.log('ADMIN RESULT: ' + JSON.stringify(result, null, 2));
  console.log('ADMIN CONSOLE:\n' + logs.slice(-15).join('\n'));
});

test('live Store: does the storefront render?', async ({ page }) => {
  const logs = [];
  const failed = [];
  page.on('console', (m) => logs.push(`[${m.type()}] ${m.text().slice(0, 180)}`));
  page.on('requestfailed', (r) => failed.push(`${r.url().slice(0, 120)} :: ${r.failure()?.errorText}`));
  page.on('response', (r) => {
    if (r.status() >= 400) failed.push(`HTTP ${r.status()} ${r.url().slice(0, 120)}`);
  });

  await page.goto('https://pro-active-store.vercel.app/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(6000);

  const body = (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 300);
  console.log('STORE BODY: ' + body);
  console.log('STORE FAILED REQUESTS:\n' + (failed.join('\n') || '(none)'));
  console.log('STORE CONSOLE (last 12):\n' + logs.slice(-12).join('\n'));
});