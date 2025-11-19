import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from './firebaseConfig'; // Import from the file

// Initialize Firebase using the file-based config
// This removes the need for the massive VITE_FIREBASE_CONFIG env var
const app = initializeApp(firebaseConfig);

// Get and export the services for the rest of our app to use
export const auth = getAuth(app);
export const db = getFirestore(app);