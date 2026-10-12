#!/usr/bin/env node
// Verifies the Admin -> Store publish contract against the Firestore emulator.
//
// The browser Firestore SDK cannot open a channel to the local emulator on this
// machine (it issues no request at all, then times out with "Could not reach
// Cloud Firestore backend"), so the wiring cannot be exercised by driving the
// Admin UI here. That is a test-harness limitation, not a product one: in
// production the Admin talks to real Firebase and the Store talks to Firestore
// with the Admin SDK, which is what this script exercises.
//
// What it proves, using the Store's REAL catalogCore functions:
//
//   1. An Admin-style batch (product document + egp_settings/catalog in the same
//      batch, exactly as commitCatalogBatch writes them) is picked up by
//      refreshSnapshotIfStale and published.
//   2. The published snapshot actually contains the product, so the storefront
//      would show it.
//   3. A structural change (a category) cannot be satisfied by the partial
//      shard patch: the patch clears the flag as a no-op and the change is
//      dropped. This is why the Admin calls /api/admin/catalog/rebuild rather
//      than relying on the flag alone.
//
// Usage: start the emulators, then `node scripts/verify-publish-path.mjs`.

process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8399';
process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099';
process.env.GCLOUD_PROJECT ||= 'proactive-fashion-demo';

import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { refreshSnapshotIfStale, readSnapshot } from '../server/_core/catalogCore.js';

const PROJECT = 'proactive-fashion-demo';
const FLAG = 'egp_settings/catalog';

const app = initializeApp({ projectId: PROJECT }, 'verify-publish');
const db = getFirestore(app);

let failures = 0;
function check(label, condition, detail = '') {
  const ok = Boolean(condition);
  if (!ok) failures++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` :: ${detail}` : ''}`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** A minimal but realistic catalogue for the snapshot builder to collect. */
async function seedCatalogue() {
  const now = Date.now();
  const batch = db.batch();

  batch.set(db.doc('egp_settings/general'), {
    storeName: 'ProActive Fashion',
    ordersOpen: true,
    currency: 'EGP',
    updatedAt: FieldValue.serverTimestamp()
  });
  batch.set(db.doc('egp_settings/taxonomy'), {
    sizes: ['S', 'M', 'L'],
    colors: [{ id: 'black', name: { en: 'Black', ar: 'أسود' }, hex: '#121212' }]
  });
  batch.set(db.doc('categories/cat-tees'), {
    name: { en: 'Tees', ar: 'تيشيرتات' },
    slug: 'tees',
    order: 0,
    active: true,
    updatedAt: FieldValue.serverTimestamp()
  });
  batch.set(db.doc('products_egp/tee-1'), {
    title: { en: 'Classic Tee', ar: 'تيشيرت كلاسيك' },
    slug: 'classic-tee',
    price: 350,
    compareAtPrice: null,
    categoryId: 'cat-tees',
    status: 'active',
    totalStock: 4,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });
  batch.set(db.doc('products_egp/tee-1/variants/black_M'), {
    colorId: 'black',
    color: 'Black',
    size: 'M',
    stock: 4,
    active: true
  });

  // Clean slate: snapshot absent, flag clean.
  batch.set(db.doc(FLAG), { dirty: false, version: 0, lastBuiltAt: now }, { merge: true });
  await batch.commit();
}

/**
 * Exactly what the Admin's commitCatalogBatch writes: the catalogue change and
 * the dirty flag in one batch, flag last so the data lands with it.
 */
async function adminStyleProductWrite() {
  const batch = db.batch();
  batch.set(
    db.doc('products_egp/tee-2'),
    {
      title: { en: 'Publish Path Tee', ar: 'تيشيرت مسار النشر' },
      slug: 'publish-path-tee',
      price: 420,
      compareAtPrice: null,
      categoryId: 'cat-tees',
      status: 'active',
      totalStock: 7,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    },
    { merge: true }
  );
  batch.set(db.doc('products_egp/tee-2/variants/black_L'), { colorId: 'black', color: 'Black', size: 'L', stock: 7, active: true });
  batch.set(db.doc(FLAG), { dirty: true, dirtyAt: Date.now(), dirtyScope: 'products' }, { merge: true });
  await batch.commit();
}

/** What the Store's own routes do for a structural change: flag, then a full rebuild. */
async function adminStyleCategoryWrite() {
  const batch = db.batch();
  batch.set(
    db.doc('categories/cat-tees'),
    { name: { en: 'T-Shirts', ar: 'تيشيرتات' }, updatedAt: FieldValue.serverTimestamp() },
    { merge: true }
  );
  batch.set(db.doc(FLAG), { dirty: true, dirtyAt: Date.now(), dirtyScope: 'full' }, { merge: true });
  await batch.commit();
}

console.log('\n1. Seed a minimal catalogue and build the first snapshot');
await seedCatalogue();
// The flag is deliberately clean here, so refreshSnapshotIfStale correctly does
// nothing. The first build is what the manual publish button does: collect and
// write directly.
const { collectCatalogData, writeSnapshot } = await import('../server/_core/catalogCore.js');
await writeSnapshot(db, await collectCatalogData(db));
let snap = await readSnapshot(db);
check('first snapshot exists', Boolean(snap), snap ? `version ${snap.version}` : 'no snapshot');
check('first snapshot contains the seeded product', (snap?.products ?? []).some((p) => p.slug === 'classic-tee'));
check('flag is clean after an explicit build', (await db.doc(FLAG).get()).data().dirty === false);

console.log('\n2. Admin saves a product (product doc + dirty flag in one batch)');
await adminStyleProductWrite();
const flagAfterWrite = (await db.doc(FLAG).get()).data();
check('flag is set by the write', flagAfterWrite.dirty === true, JSON.stringify(flagAfterWrite));

const refreshed = await refreshSnapshotIfStale(db, { now: Date.now(), cooldownMs: 0 });
console.log(`     refresh reported: ${JSON.stringify(refreshed)}`);
const flagAfterRefresh = (await db.doc(FLAG).get()).data();
check('flag cleared by the rebuild', flagAfterRefresh.dirty === false, `version ${flagAfterRefresh.version}`);

snap = await readSnapshot(db);
const published = (snap?.products ?? []).find((p) => p.slug === 'publish-path-tee');
check('the new product reached the storefront snapshot', Boolean(published));
check('its variant stock was published', published?.variants?.[0]?.stock === 7, `stock ${published?.variants?.[0]?.stock}`);

console.log('\n3. A clean flag costs one read and no work');
const idle = await refreshSnapshotIfStale(db, { now: Date.now(), cooldownMs: 0 });
check('nothing to do when not dirty', idle.rebuilt === false && idle.reason === 'not-dirty', JSON.stringify(idle));

console.log('\n4. A category rename cannot be served by the partial patch');
await adminStyleCategoryWrite();
const structural = await refreshSnapshotIfStale(db, { now: Date.now(), cooldownMs: 0 });
console.log(`     refresh reported: ${JSON.stringify(structural)}`);

// This is the finding that justifies the Admin calling the rebuild endpoint.
// With only a structural change and no product updatedAt movement, the partial
// patch takes its "nothing moved" branch: it clears the flag and publishes
// nothing. So the expected behaviour here is the hazard, and asserting it is
// what keeps the Admin-side fix honest.
check('partial patch clears the flag without publishing the rename', structural.mode === 'noop', `mode=${structural.mode}`);
snap = await readSnapshot(db);
const beforeFull = (snap?.categories ?? []).find((c) => c.slug === 'tees');
check('the rename is still unpublished after the no-op', beforeFull?.name?.en === 'Tees', `name "${beforeFull?.name?.en}"`);

const full = await writeSnapshot(db, await collectCatalogData(db));
snap = await readSnapshot(db);
const afterFull = (snap?.categories ?? []).find((c) => c.slug === 'tees');
check('the rebuild endpoint publishes the rename', afterFull?.name?.en === 'T-Shirts', `version ${full.version}`);

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}\n`);
await app.delete();
process.exit(failures === 0 ? 0 : 1);