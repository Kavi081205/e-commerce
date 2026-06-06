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

async function printRawCollection(name) {
  console.log(`\n=================== ${name.toUpperCase()} ===================`);
  const snap = await getDocs(collection(db, name));
  snap.forEach(docSnap => {
    console.log(`ID: ${docSnap.id} => ${JSON.stringify(docSnap.data(), null, 2)}`);
  });
}

async function run() {
  try {
    await printRawCollection("promotions");
    await printRawCollection("offers");
    await printRawCollection("products");
  } catch (err) {
    console.error(err);
  }
}

run();
