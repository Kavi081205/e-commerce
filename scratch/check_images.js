import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBjRIqKGqfbIgvVU7KCyDN1gVtYrB_JOUA",
  authDomain: "aurex-ecommerce.firebaseapp.com",
  projectId: "aurex-ecommerce",
  storageBucket: "aurex-ecommerce.firebasestorage.app",
  messagingSenderId: "1019338009642",
  appId: "1:1019338009642:web:e5d9c341ca3c001299e753",
  measurementId: "G-DDSLBPKJ2Z",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkCollection(name) {
  console.log(`\nChecking collection: ${name}`);
  const snap = await getDocs(collection(db, name));
  snap.forEach(docSnap => {
    const data = docSnap.data();
    const id = docSnap.id;
    // Check all fields recursively for localhost or 127.0.0.1
    const str = JSON.stringify(data);
    if (str.includes("localhost:") || str.includes("127.0.0.1")) {
      console.log(`Document ID: ${id} matches!`);
      // Print fields that contain localhost:
      findLocalhostFields(data, id);
    }
  });
}

function findLocalhostFields(obj, id, path = "") {
  if (!obj) return;
  if (typeof obj === "string") {
    if (obj.includes("localhost:") || obj.includes("127.0.0.1")) {
      console.log(`  -> Field [${path}]: "${obj}"`);
    }
  } else if (Array.isArray(obj)) {
    obj.forEach((item, idx) => {
      findLocalhostFields(item, id, `${path}[${idx}]`);
    });
  } else if (typeof obj === "object") {
    Object.keys(obj).forEach(key => {
      findLocalhostFields(obj[key], id, path ? `${path}.${key}` : key);
    });
  }
}

async function run() {
  try {
    await checkCollection("products");
    await checkCollection("offers");
    await checkCollection("promotions");
    await checkCollection("categories");
  } catch (err) {
    console.error(err);
  }
}

run();
