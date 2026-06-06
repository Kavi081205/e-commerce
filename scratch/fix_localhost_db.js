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

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

function cleanUrl(url) {
  if (typeof url !== "string") return url;
  
  // Replace localhost:7070 or localhost:37857 with relative path
  // Match http://localhost:7070/something.png or http://localhost:37857/something.png
  // and convert it to /images/something.png or keep filename if it's already under /images/
  const regex = /https?:\/\/localhost:(7070|37857)\/(images\/)?([^\s?#]+)/g;
  if (regex.test(url)) {
    const cleaned = url.replace(regex, (match, port, imgFolder, filename) => {
      console.log(`    Replacing URL: "${match}" -> "/images/${filename}"`);
      return `/images/${filename}`;
    });
    return cleaned;
  }
  return url;
}

// Deep clean object fields
function cleanObject(obj, modifiedContainer) {
  if (!obj) return obj;
  let changed = false;

  if (typeof obj === "string") {
    const cleaned = cleanUrl(obj);
    if (cleaned !== obj) {
      modifiedContainer.changed = true;
      return cleaned;
    }
  } else if (Array.isArray(obj)) {
    return obj.map(item => cleanObject(item, modifiedContainer));
  } else if (typeof obj === "object") {
    const result = {};
    Object.keys(obj).forEach(key => {
      result[key] = cleanObject(obj[key], modifiedContainer);
    });
    return result;
  }
  return obj;
}

async function fixCollection(collectionName) {
  console.log(`\nProcessing collection: ${collectionName}`);
  const snap = await getDocs(collection(db, collectionName));
  let count = 0;
  
  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    const id = docSnap.id;
    const container = { changed: false };
    const cleanedData = cleanObject(data, container);
    
    if (container.changed) {
      console.log(`Updating document [${id}] in collection [${collectionName}]...`);
      await updateDoc(doc(db, collectionName, id), cleanedData);
      console.log(`Document [${id}] successfully updated.`);
      count++;
    }
  }
  console.log(`Finished collection [${collectionName}]. Updated ${count} documents.`);
}

async function run() {
  try {
    await fixCollection("products");
    await fixCollection("offers");
    await fixCollection("promotions");
    console.log("\nDatabase clean complete!");
  } catch (err) {
    console.error("Migration error:", err);
  }
}

run();
