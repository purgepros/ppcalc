import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// --- CONSOLIDATED CONFIGURATION ---
// We now check for a single JSON string variable first.
// This saves space in the Netlify 4KB environment limit.

let firebaseConfig;

if (import.meta.env.VITE_FIREBASE_CONFIG) {
  try {
    firebaseConfig = JSON.parse(import.meta.env.VITE_FIREBASE_CONFIG);
  } catch (e) {
    console.error("Error parsing VITE_FIREBASE_CONFIG:", e);
    // Fallback or empty object to prevent immediate crash, though app will likely fail
    firebaseConfig = {}; 
  }
} else {
  // Fallback to individual keys (for local dev or legacy setups)
  firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
  };
}

// Initialize Firebase ONCE
const app = initializeApp(firebaseConfig);

// Get and export the services for the rest of our app to use
export const auth = getAuth(app);
export const db = getFirestore(app);