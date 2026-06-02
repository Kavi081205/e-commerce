import { initializeApp } from "firebase/app";
import { getFirestore, collection, query, where, getDocs, doc, setDoc } from "firebase/firestore";

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

const email = "kaviyarasanmurugan78@gmail.com";

async function run() {
  try {
    console.log("Querying users collection for email...");
    const q = query(collection(db, "users"), where("email", "==", email));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      console.log("No user document found in Firestore with email:", email);
      console.log("We will write a new admin document with a placeholder/default UID or wait.");
      
      // Let's create a deterministic/placeholder UID or let's create one.
      // Wait, if they log in, the onAuthStateChanged listener or SetupAdmin creates a user document using their Firebase Auth UID.
      // If we don't know their Firebase Auth UID yet because we can't log in, what should we do?
      // Wait, we can send a password reset email so they can log in, or we can check if they have a known UID.
      // Let's first check if there are ANY documents in users collection to see if we can find it.
      const allUsers = await getDocs(collection(db, "users"));
      console.log("Total users in Firestore:", allUsers.size);
      allUsers.forEach(doc => {
        console.log(`User: ${doc.id} => email: ${doc.data().email}, role: ${doc.data().role}`);
      });
    } else {
      querySnapshot.forEach(async (docSnap) => {
        const uid = docSnap.id;
        console.log(`Found user document! UID: ${uid}`);
        console.log("Updating role to admin...");
        await setDoc(doc(db, "users", uid), {
          role: "admin",
          email: email,
          displayName: "Kaviyarasan",
          createdAt: new Date().toISOString()
        }, { merge: true });
        console.log("Firestore role successfully updated to admin!");
      });
    }
  } catch (error) {
    console.error("Error running script:", error);
  }
}

run();
