import { readFileSync } from "node:fs";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, getDoc, getDocs, collection, deleteDoc } from "firebase/firestore";
import { getAuth, signInWithCustomToken } from "firebase/auth";

const custom = readFileSync("C:/Users/BODA~1.DES/AppData/Local/Temp/opencode/admin_custom.txt", "utf8").trim();
const cfg = { apiKey:"AIzaSyB-zDX6AzSZ6ccS6XeqITC8oucFcwlWwDo", projectId:"mina-terek-samir-shein", appId:"1:204099991190:web:ba4e9d9a848e64a3f474b7" };
const mk = (n) => initializeApp(cfg, n + Math.random().toString(36).slice(2));

const anon = mk("anon"); const anonDb = getFirestore(anon, "default");
const adm = mk("adm");
const auth = getAuth(adm);
const r = await fetch("https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=" + cfg.apiKey, { method:"POST", headers:{"content-type":"application/json"}, body: JSON.stringify({ token: custom, returnSecureToken:true })});
const { idToken } = await r.json();
await signInWithCustomToken(auth, custom);
const admDb = getFirestore(adm, "default");

const t = async (label, fn) => { try { const v = await fn(); console.log(`  ${label.padEnd(42)} ALLOWED${v!==undefined?"  "+v:""}`); } catch (e) { console.log(`  ${label.padEnd(42)} BLOCKED  (${e.code ?? e.message})`); } };

console.log("STOREFRONT (anonymous)");
await t("read products_egp (catalogue)", async () => (await getDocs(collection(anonDb, "products_egp"))).size + " docs");
await t("read categories", async () => (await getDocs(collection(anonDb, "categories"))).size + " docs");
await t("write products_egp", () => setDoc(doc(anonDb, "products_egp", "__hack"), { x:1 }));
await t("read orders_egp (customer data)", async () => (await getDocs(collection(anonDb, "orders_egp"))).size + " docs");
await t("create an order directly", () => setDoc(doc(anonDb, "orders_egp", "__hack"), { x:1 }));

console.log("ADMIN (authenticated, admin:true)");
const probe = doc(admDb, "products_egp", "__probe_admin_write");
await t("write products_egp", () => setDoc(probe, { probe: true, at: Date.now() }));
await t("read back what it wrote", async () => (await getDoc(probe)).data()?.probe === true ? "ok" : "mismatch");
await deleteDoc(probe).catch(() => {});
console.log("  probe document removed");
