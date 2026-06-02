import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, doc, setDoc } from "firebase/firestore";

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
const auth = getAuth(app);
const db = getFirestore(app);

const email = "kaviyarasanmurugan78@gmail.com";
const password = "Kavi@0812";
const displayName = "Kaviyarasan";

async function run() {
  let user;
  try {
    console.log("Attempting to create user...");
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    user = userCredential.user;
    console.log("User created successfully. UID:", user.uid);
  } catch (error) {
    if (error.code === 'auth/email-already-in-use') {
      console.log("User already exists. Logging in...");
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      user = userCredential.user;
      console.log("Logged in successfully. UID:", user.uid);
    } else {
      console.error("Error creating/logging in user:", error);
      process.exit(1);
    }
  }

  try {
    console.log("Updating Firestore user doc to admin...");
    const userRef = doc(db, 'users', user.uid);
    await setDoc(userRef, {
      uid: user.uid,
      email: email,
      displayName: displayName,
      role: "admin",
      createdAt: new Date().toISOString()
    }, { merge: true });
    console.log("Firestore document set to admin successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Error setting Firestore doc:", error);
    process.exit(1);
  }
}

run();
