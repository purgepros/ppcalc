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

// Get your service account key from Netlify Environment Variables
// (We will set this up in the next step)
let serviceAccount;
try {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} catch (e) {
  console.error("ERROR: FIREBASE_SERVICE_ACCOUNT env var is not set or invalid JSON.", e);
}

// Initialize Firebase Admin
try {
  initializeApp({
    credential: cert(serviceAccount)
  });
} catch (e) {
  // This try/catch avoids a Netlify hot-reload error
  if (!/already exists/.test(e.message)) {
    console.error('Firebase admin initialization error', e.stack);
  }
}

exports.handler = async (event, context) => {
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
    // You could set a "custom claim" to make only *you* an admin.
    // For now, we'll just check if they are an authenticated user.
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