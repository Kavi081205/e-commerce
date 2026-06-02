import { initializeApp } from "firebase/app";
import { getAuth, sendPasswordResetEmail } from "firebase/auth";

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

const email = "kaviyarasanmurugan78@gmail.com";

sendPasswordResetEmail(auth, email)
  .then(() => {
    console.log(`\n======================================================`);
    console.log(`Password reset email successfully sent to ${email}!`);
    console.log(`Please check your inbox (and spam folder) for the link.`);
    console.log(`======================================================\n`);
    process.exit(0);
  })
  .catch((error) => {
    console.error("Error sending reset email:", error);
    process.exit(1);
  });
