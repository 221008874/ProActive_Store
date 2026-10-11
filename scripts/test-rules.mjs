// Security-rules tests on the Firestore emulator.
//
//   firebase emulators:exec --only firestore "node scripts/test-rules.mjs"
//
// These are the invariants that keep customer data honest:
//   - anyone can browse the catalogue
//   - nobody can list orders (names, phones, addresses)
//   - orders cannot be created from the browser (the server writes them)
//   - the anti-abuse and snapshot collections are admin-only
//   - an admin (custom claim) can write

import { readFileSync } from "node:fs";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds
} from "@firebase/rules-unit-testing";
import { doc, setDoc, getDoc, collection, getDocs } from "firebase/firestore";

const rules = readFileSync("firestore.rules.strict", "utf8");

const testEnv = await initializeTestEnvironment({
  projectId: "proactive-rules-test",
  firestore: { rules }
});

const readRules = async () => {
  const alice = testEnv.authenticatedContext("alice", { admin: true }).firestore();
  const bob = testEnv.authenticatedContext("bob").firestore(); // signed in, no claim
  const guest = testEnv.unauthenticatedContext().firestore();

  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "products_egp", "dress"), { title: { en: "Dress" }, status: "active" });
    await setDoc(doc(db, "orders_egp", "order1"), { status: "pending", items: [] });
    await setDoc(doc(db, "egp_settings", "general"), { freeShippingThreshold: 800 });
  });

  let passed = 0;
  const check = async (name, fn) => {
    await fn();
    passed += 1;
    console.log(`ok - ${name}`);
  };

  await check("anyone can read the catalogue", async () => {
    await assertSucceeds(getDoc(doc(guest, "products_egp", "dress")));
    await assertSucceeds(getDoc(doc(bob, "products_egp", "dress")));
  });

  await check("anyone can read public settings", async () => {
    await assertSucceeds(getDoc(doc(guest, "egp_settings", "general")));
  });

  await check("an anonymous visitor cannot list orders", async () => {
    await assertFails(getDocs(collection(guest, "orders_egp")));
  });

  await check("a signed-in visitor cannot list orders", async () => {
    await assertFails(getDocs(collection(bob, "orders_egp")));
  });

  await check("a browser cannot create an order", async () => {
    await assertFails(
      setDoc(doc(guest, "orders_egp", "forged"), {
        status: "pending",
        adminConfirmed: false,
        paymentMethod: "cod",
        items: [],
        total: 1,
        customer: { name: "N", phone: "01012345678" },
        address: { governorateId: "cairo" }
      })
    );
  });

  await check("a browser cannot change prices or stock", async () => {
    await assertFails(setDoc(doc(bob, "products_egp", "dress"), { price: 1 }));
    await assertFails(
      setDoc(doc(bob, "products_egp", "dress", "variants", "red_M"), { stock: 99 })
    );
  });

  await check("the anti-abuse collections are admin-only", async () => {
    await assertFails(getDocs(collection(bob, "blocklist")));
    await assertFails(getDocs(collection(bob, "rate_limits")));
    await assertFails(getDocs(collection(bob, "client_orders")));
    await assertFails(getDocs(collection(bob, "catalog_snapshots")));
    await assertSucceeds(getDocs(collection(alice, "blocklist")));
  });

  await check("an admin can write the catalogue", async () => {
    await assertSucceeds(
      setDoc(doc(alice, "products_egp", "dress2"), { title: { en: "Another" }, status: "active" })
    );
  });

  console.log(`\n${passed} rules checks passed`);
};

try {
  await readRules();
} finally {
  await testEnv.cleanup();
}
