// Minimal in-memory Firestore stand-in for testing the server order path.
//
// Supports only what api/_core/orderCore.js uses: doc(), collection().doc(),
// runTransaction() with get/update/set, and the increment / serverTimestamp
// sentinels. Writes are staged and only committed when the callback resolves,
// which is how the real Firestore behaves - so a test that expects a throw
// also proves nothing was written.

export function createFakeFirestore(seed = {}) {
  const store = structuredClone(seed);
  let autoId = 0;

  const resolve = (path) => path.split("/").filter(Boolean);

  const makeRef = (collectionPath, id = null) => ({
    __ref: true,
    path: id ? `${collectionPath}/${id}` : collectionPath,
    id,
    // docRef.collection(name) -> subcollection
    collection: (name) => makeRef(`${collectionPath}/${id ? id + "/" : ""}${name}`),
    // collectionRef.doc(id) -> document in this collection
    doc: (childId) => makeRef(collectionPath, childId ?? `auto${++autoId}`),
    // Query chain on a collection: where(field, '==', value).limit(n).get()
    where: (field, op, value) =>
      makeQuery(collectionPath, [{ field, op, value }], null),
    limit: (n) => makeQuery(collectionPath, [], n),
    // Document read: { exists, id, data() }, matching the Admin SDK shape
    // closely enough for the catalog builder and its tests.
    get: async () => {
      if (!id) return makeQuery(collectionPath, [], null).get();
      const snap = readRef({ path: `${collectionPath}/${id}` });
      return {
        exists: snap.exists,
        id,
        data: () => snap.data,
        ref: makeRef(collectionPath, id)
      };
    }
  });

  // Equality-only query shim: enough for where('slug','==',x).limit(1) and
  // the catalog builder's collection listing.
  const makeQuery = (collectionPath, filters = [], cap = null) => ({
    where: (field, op, value) => makeQuery(collectionPath, [...filters, { field, op, value }], cap),
    orderBy: () => makeQuery(collectionPath, filters, cap),
    limit: (n) => makeQuery(collectionPath, filters, n),
    get: async () => {
      const base = listCollection(collectionPath);
      const docs = base.docs.filter((d) =>
        filters.every(({ field, value }) => d.data()[field] === value)
      );
      const capped = cap == null ? docs : docs.slice(0, cap);
      return { docs: capped, size: capped.length, empty: capped.length === 0 };
    }
  });

  const listCollection = (collectionPath) => {
    const parts = resolve(collectionPath);
    let node = store;
    for (const part of parts) {
      if (node == null || typeof node !== "object") node = undefined;
      else node = node[part];
    }
    const docs = Object.entries(node && typeof node === "object" ? node : {}).map(([cid, data]) => ({
      id: cid,
      ref: makeRef(`${collectionPath}/${cid}`),
      data: () => data
    }));
    return { docs, size: docs.length, empty: docs.length === 0 };
  };

  const readRef = (ref) => {
    const parts = resolve(ref.path);
    let node = store;
    for (const part of parts) {
      if (node == null || typeof node !== "object") return { exists: false, data: undefined };
      node = node[part];
    }
    if (node === undefined) return { exists: false, data: undefined };
    return { exists: true, data: JSON.parse(JSON.stringify(node)) };
  };

  const writeRef = (ref, patch) => {
    const parts = resolve(ref.path);
    let node = store;
    for (let i = 0; i < parts.length - 1; i++) {
      if (typeof node[parts[i]] !== "object" || node[parts[i]] === null) node[parts[i]] = {};
      node = node[parts[i]];
    }
    const last = parts[parts.length - 1];
    const current = node[last];
    const base = current && typeof current === "object" ? current : {};
    node[last] = { ...base, ...JSON.parse(JSON.stringify(patch)) };
  };

  const db = {
    doc: (path) => makeRef(path.split("/")[0], path.split("/").slice(1).join("/") || null),
    collection: (name) => makeRef(name),

    async runTransaction(callback) {
      const staged = [];
      const tx = {
        async get(ref) {
          // Reads must not see staged writes, matching Firestore.
          const stagedForPath = staged.find((w) => w.ref.path === ref.path);
          if (stagedForPath) return readRef(ref);
          return readRef(ref);
        },
        update(ref, patch) {
          staged.push({ kind: "update", ref, patch });
        },
        set(ref, data, options = {}) {
          staged.push({ kind: "set", ref, data, merge: options.merge === true });
        }
      };

      const result = await callback(tx);

      for (const write of staged) {
        const current = readRef(write.ref);
        const currentData = current.exists ? current.data : {};

        if (write.kind === "set") {
          if (write.merge) {
            const current = readRef(write.ref);
            writeRef(write.ref, {
              ...(current.exists ? current.data : {}),
              ...stripSentinels(write.data)
            });
          } else {
            writeRef(write.ref, stripSentinels(write.data));
          }
          continue;
        }

        const next = { ...currentData };
        for (const [key, value] of Object.entries(write.patch)) {
          if (value && value.__op === "increment") {
            next[key] = Number(next[key] ?? 0) + value.n;
          } else if (value && value.__op === "serverTimestamp") {
            next[key] = { __ts: true };
          } else {
            next[key] = value;
          }
        }
        writeRef(write.ref, next);
      }

      return result;
    },

    // Batched writes, applied on commit. The catalog builder uses one batch
    // so a half-published snapshot can never be served.
    batch() {
      const ops = [];
      const batch = {
        set(ref, data, options = {}) {
          ops.push({ kind: "set", ref, data, merge: options.merge === true });
        },
        update(ref, patch) {
          ops.push({ kind: "update", ref, patch });
        },
        delete(ref) {
          ops.push({ kind: "delete", ref });
        },
        async commit() {
          for (const op of ops) {
            if (op.kind === "delete") {
              const parts = resolve(op.ref.path);
              let node = store;
              for (let i = 0; i < parts.length - 1; i++) {
                if (typeof node?.[parts[i]] !== "object" || node[parts[i]] === null) break;
                node = node[parts[i]];
              }
              if (node && typeof node === "object") delete node[parts[parts.length - 1]];
              continue;
            }
            if (op.kind === "set" && op.merge) {
              const current = readRef(op.ref);
              writeRef(op.ref, { ...(current.exists ? current.data : {}), ...stripSentinels(op.data) });
              continue;
            }
            if (op.kind === "set") {
              writeRef(op.ref, stripSentinels(op.data));
              continue;
            }
            const current = readRef(op.ref);
            const next = { ...(current.exists ? current.data : {}) };
            for (const [key, value] of Object.entries(op.patch)) {
              next[key] = value && value.__op === "increment" ? Number(next[key] ?? 0) + value.n : value;
            }
            writeRef(op.ref, next);
          }
        }
      };
      return batch;
    },

    // test helpers
    __store: store,
    __read: (path) => {
      const snap = readRef(makeRef(path.split('/')[0], path.split('/').slice(1).join('/') || null));
      return snap.exists ? snap.data : undefined;
    },
    __exists: (path) =>
      readRef(makeRef(path.split('/')[0], path.split('/').slice(1).join('/') || null)).exists,
    __seed(path, value) {
      writeRef(makeRef(path.split('/')[0], path.split('/').slice(1).join('/') || null), value);
    }
  };

  return db;
}

function stripSentinels(data) {
  const out = {};
  for (const [k, v] of Object.entries(data)) {
    if (v && v.__op === "serverTimestamp") out[k] = { __ts: true };
    else if (v && v.__op === "increment") out[k] = 0;
    else out[k] = v;
  }
  return out;
}

export function seedFixture(overrides = {}) {
  return {
    egp_settings: { general: { freeShippingThreshold: 800, currency: "EGP" } },
    egp_governorate_costs: { cairo: { cost: 60, minOrder: 0, active: true } },
    products_egp: {
      dress: {
        title: { ar: "فستان", en: "Dress" },
        price: 450,
        status: "active",
        images: [{ url: "https://img/dress.jpg" }],
        totalStock: 10,
        soldCount: 0,
        variants: {
          red_M: { colorId: "red", color: "Red", size: "M", stock: 5, active: true },
          red_L: { colorId: "red", color: "Red", size: "L", stock: 1, active: true },
          black_M: { colorId: "black", color: "Black", size: "M", stock: 0, active: true }
        }
      },
      archived: { title: "Old", price: 100, status: "archived", variants: {} },
      override: {
        title: "Override",
        price: 450,
        status: "active",
        images: [],
        variants: { red_M: { colorId: "red", color: "Red", size: "M", stock: 5, active: true, priceOverride: 399 } }
      }
    },
    egp_coupons: {
      SAVE10: { code: "SAVE10", type: "fixed", value: 10, minOrder: 0, maxUses: 5, usedCount: 0, active: true },
      HALF: { code: "HALF", type: "percent", value: 50, minOrder: 0, maxUses: null, usedCount: 0, active: true },
      ONEUSE: { code: "ONEUSE", type: "fixed", value: 20, minOrder: 0, maxUses: 1, usedCount: 1, active: true },
      BIGMIN: { code: "BIGMIN", type: "fixed", value: 20, minOrder: 5000, maxUses: null, usedCount: 0, active: true },
      DEAD: { code: "DEAD", type: "fixed", value: 20, minOrder: 0, maxUses: null, usedCount: 0, active: false },
      OLD: { code: "OLD", value: 30, minOrder: 0, maxUses: null, usedCount: 0, active: true }
    },
    ...overrides
  };
}