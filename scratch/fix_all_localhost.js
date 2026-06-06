import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, updateDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBjRIqKGqfbIgvVU7KCyDN1gVtYrB_JOUA",
  authDomain: "aurex-ecommerce.firebaseapp.com",
  projectId: "aurex-ecommerce",
  storageBucket: "aurex-ecommerce.firebasestorage.app",
  messagingSenderId: "1019338009642",
  appId: "1:1019338009642:web:e5d9c341ca3c001299e753",
  measurementId: "G-DDSLBPKJ2Z",
};

const PRODUCTION_URL = "https://e-commerce-smkp-traders.vercel.app";
const LOCALHOST_PATTERNS = [
  /https?:\/\/localhost:\d+/g
];

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

function fixLocalhostUrls(value) {
  if (typeof value !== 'string') return { fixed: value, changed: false };
  let result = value;
  for (const pattern of LOCALHOST_PATTERNS) {
    if (pattern.test(result)) {
      result = result.replace(pattern, PRODUCTION_URL);
    }
    // Reset lastIndex in case of global regex
    pattern.lastIndex = 0;
  }
  return { fixed: result, changed: result !== value };
}

function fixObjectDeep(obj) {
  if (!obj || typeof obj !== 'object') {
    const { fixed, changed } = fixLocalhostUrls(obj);
    return { fixed, changed };
  }
  if (Array.isArray(obj)) {
    let changed = false;
    const fixed = obj.map(item => {
      const result = fixObjectDeep(item);
      if (result.changed) changed = true;
      return result.fixed;
    });
    return { fixed, changed };
  }
  let changed = false;
  const fixed = {};
  for (const key of Object.keys(obj)) {
    const result = fixObjectDeep(obj[key]);
    if (result.changed) {
      console.log(`  [${key}]: "${obj[key]}" -> "${result.fixed}"`);
      changed = true;
    }
    fixed[key] = result.fixed;
  }
  return { fixed, changed };
}

async function fixCollection(collectionName) {
  console.log(`\n=== Scanning: ${collectionName} ===`);
  const snap = await getDocs(collection(db, collectionName));
  let count = 0;
  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    const { fixed, changed } = fixObjectDeep(data);
    if (changed) {
      console.log(`Fixing document [${docSnap.id}] in [${collectionName}]...`);
      await updateDoc(doc(db, collectionName, docSnap.id), fixed);
      console.log(`  ✅ Updated!`);
      count++;
    }
  }
  console.log(`Done. ${count} documents updated.`);
}

async function run() {
  try {
    await fixCollection("products");
    await fixCollection("offers");
    await fixCollection("promotions");
    console.log("\n✅ All localhost URLs fixed in Firestore!");
  } catch (err) {
    console.error("Error:", err);
  }
}

run();
