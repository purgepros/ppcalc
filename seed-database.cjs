/*
 * --- FIREBASE DATABASE SEEDER ---
 *
 * This is a one-time script to copy your app's configuration
 * from `public/config.json` into your new Firestore database.
 *
 * TO RUN:
 * 1. Make sure you've run: npm install firebase
 * 2. Run this file from your terminal: node seed-database.js
 *
 * After it's successful, you can delete this file.
 */

// Node.js file system and path modules
const fs = require('fs');
const path = require('path');

// Firebase modules
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc } = require('firebase/firestore');

// --- YOUR FIREBASE CONFIG ---
// This is the config you just generated
const firebaseConfig = {
  apiKey: "AIzaSyDoe0DltSSjI81KA39u5WmlvJ3Kt3e3Hc4",
  authDomain: "purge-pros-admin.firebaseapp.com",
  projectId: "purge-pros-admin",
  storageBucket: "purge-pros-admin.firebasestorage.app",
  messagingSenderId: "87983189740",
  appId: "1:87983189740:web:119e1410d5728c50e47fc9"
};

// --- OUR SCRIPT LOGIC ---
async function seedDatabase() {
  try {
    console.log('Initializing Firebase...');
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    
    console.log('Reading config.json...');
    const configPath = path.join(__dirname, 'public', 'config.json');
    const configFile = fs.readFileSync(configPath, 'utf8');
    const configData = JSON.parse(configFile);

    if (!configData || !configData.data || !configData.text) {
      console.error('Error: config.json seems to be in the wrong format or empty.');
      return;
    }

    // We will store this entire config object in a single document:
    // Collection: 'config'
    // Document:   'production'
    const docRef = doc(db, 'config', 'production');

    console.log('Writing data to Firestore (config/production)...');
    await setDoc(docRef, configData);

    console.log('\n✅ --- Database seeded successfully! --- ✅');
    console.log("You can now check your Firestore console to see the data.");

  } catch (error) {
    console.error('\n❌ --- Error seeding database --- ❌');
    console.error(error);
  }
  
  // We must manually exit the script
  process.exit(0);
}

// Run the script
seedDatabase();