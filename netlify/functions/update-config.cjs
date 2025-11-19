/*
 * --- SECURE BACKEND TO UPDATE CONFIG ---
 *
 * This function will:
 * 1. Verify the user is authenticated (logged in) using their auth token.
 * 2. If yes, it will update the `config/production` document in Firestore.
 * 3. If no, it will reject the request.
 *
 * This is a .cjs file because your project has "type": "module" in package.json
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

// --- 1. SET UP FIREBASE ADMIN ---
// We must initialize the Admin SDK with a "Service Account"
// This gives it "God Mode" permissions on your Firebase project.

let serviceAccount;
try {
  // OPTION A: Check for the Full JSON Variable (Legacy/Standard)
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } 
  // OPTION B: Check for Individual Variables (Space Saving for Netlify)
  // This is the "Lite" version that avoids the 4KB limit
  else if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
    // Construct the object manually from smaller parts
    serviceAccount = {
      projectId: process.env.FIREBASE_PROJECT_ID || 'purrge-pros', // Fallback or env
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // Handle newlines in private key which are sometimes escaped in env vars
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    };
  }
  else {
    throw new Error('Missing FIREBASE_SERVICE_ACCOUNT or FIREBASE_PRIVATE_KEY/EMAIL env vars.');
  }

} catch (e) {
  console.error("ERROR: Could not load Firebase credentials.", e);
}

// Initialize Firebase Admin
try {
  // Check if the default app is already initialized
  if (!require('firebase-admin/app').getApps().length && serviceAccount) {
    initializeApp({
      credential: cert(serviceAccount)
    });
  }
} catch (e) {
  // This try/catch avoids a Netlify hot-reload error
  if (!/already exists/.test(e.message)) {
    console.error('Firebase admin initialization error', e.stack);
  }
}

exports.handler = async (event, context) => {
  // Check if service account is loaded
  if (!serviceAccount) {
    return { statusCode: 500, body: JSON.stringify({ message: 'Server configuration error: Firebase Admin SDK not initialized.' }) };
  }
  
  // 1. Check for auth token
  if (!event.headers.authorization) {
    return { statusCode: 401, body: JSON.stringify({ message: 'Not authorized' }) };
  }
  
  try {
    const idToken = event.headers.authorization.split('Bearer ')[1];
    
    // 2. Verify the auth token
    // This proves the user is logged into *your* Firebase project
    const decodedToken = await getAuth().verifyIdToken(idToken);
    
    // 3. Token is valid! Now, get the database and the data
    const db = getFirestore();
    const newData = JSON.parse(event.body);

    // 4. Get the *actual* user from our auth list
    const user = await getAuth().getUser(decodedToken.uid);
    
    // --- 5. OPTIONAL: Check for Admin Role ---
    if (!user) {
      return { statusCode: 403, body: JSON.stringify({ message: 'Forbidden' }) };
    }
    
    // 6. Save the data
    // All checks passed! Write the new config to the database.
    const docRef = db.collection('config').doc('production');
    await docRef.set(newData);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Configuration saved!' })
    };

  } catch (error) {
    console.error('Error in update-config:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'An internal error occurred', error: error.message })
    };
  }
};