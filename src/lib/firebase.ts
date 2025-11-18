import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, browserLocalPersistence, setPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// IMPORTANT: Replace with your own Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);

// Set persistence to localStorage to maintain auth state across page refreshes
// This ensures the user stays logged in after page refresh
if (typeof window !== "undefined") {
  // browserLocalPersistence is the default, but we set it explicitly to ensure it's enabled
  // This stores the auth state in localStorage
  setPersistence(auth, browserLocalPersistence)
    .then(() => {
      // Persistence set successfully
    })
    .catch((error) => {
      console.error("Failed to set auth persistence:", error);
    });
}

const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage };
