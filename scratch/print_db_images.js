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

async function printCollection(name) {
  console.log(`\n=================== COLLECTION: ${name} ===================`);
  const snap = await getDocs(collection(db, name));
  snap.forEach(docSnap => {
    const data = docSnap.data();
    const id = docSnap.id;
    console.log(`Document: ${id}`);
    if (data.name) console.log(`  Name: ${data.name}`);
    if (data.title) console.log(`  Title: ${data.title}`);
    if (data.image) console.log(`  Image: ${data.image}`);
    if (data.images) console.log(`  Images: ${JSON.stringify(data.images)}`);
    if (data.banner) console.log(`  Banner: ${data.banner}`);
    if (data.bannerImage) console.log(`  BannerImage: ${data.bannerImage}`);
    if (data.imageUrl) console.log(`  ImageUrl: ${data.imageUrl}`);
    if (data.redirectLink) console.log(`  RedirectLink: ${data.redirectLink}`);
    if (data.variants) {
      console.log(`  Variants:`);
      data.variants.forEach((v, idx) => {
        console.log(`    Variant [${idx}] (color: ${v.colorName || v.color}):`);
        if (v.image) console.log(`      Image: ${v.image}`);
        if (v.images) console.log(`      Images: ${JSON.stringify(v.images)}`);
      });
    }
  });
}

async function run() {
  try {
    await printCollection("products");
    await printCollection("offers");
    await printCollection("promotions");
  } catch (err) {
    console.error(err);
  }
}

run();
