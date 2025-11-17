import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';

// Paste your config here
const firebaseConfig = {
  apiKey: "AIzaSyDoe0DltSSjI81KA39u5WmlvJ3Kt3e3Hc4",
  authDomain: "purge-pros-admin.firebaseapp.com",
  projectId: "purge-pros-admin",
  storageBucket: "purge-pros-admin.firebasestorage.app",
  messagingSenderId: "87983189740",
  appId: "1:87983189740:web:119e1410d5728c50e47fc9"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/**
 * The Main Admin Panel Component
 */
const AdminPanel = () => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Listen for authentication state changes
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <span className="loader"></span>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto bg-white p-6 md:p-8 rounded-xl shadow-lg">
        {user ? (
          <AdminDashboard />
        ) : (
          <LoginForm />
        )}
      </div>
    </div>
  );
};

/**
 * The Login Form
 */
const LoginForm = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <h2 className="text-2xl font-bold text-center mb-6">Admin Login</h2>
      <form onSubmit={handleLogin} className="space-y-4">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full p-3 border-2 border-gray-300 rounded-lg"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full p-3 border-2 border-gray-300 rounded-lg"
        />
        {error && <p className="text-red-600 text-sm text-center">{error}</p>}
        <button
          type="submit"
          className="w-full bg-[var(--brand-blue)] text-white font-bold text-lg py-3 rounded-lg hover:bg-opacity-90"
        >
          Login
        </button>
      </form>
    </div>
  );
};

/**
 * The Main Dashboard (after login)
 */
const AdminDashboard = () => {
  const [config, setConfig] = useState(null);
  const [status, setStatus] = useState(''); // 'loading', 'saving', 'success', 'error'
  const [error, setError] = useState('');

  // 1. Fetch data from Firestore on load
  useEffect(() => {
    const fetchData = async () => {
      setStatus('loading');
      const docRef = doc(db, 'config', 'production');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setConfig(docSnap.data());
      } else {
        setError('Could not find config document in Firestore.');
      }
      setStatus('');
    };
    fetchData();
  }, []);
  
  // 2. Handle simple text input changes
  // This is a "deep" change handler that respects the nested JSON
  const handleChange = (e, section, key, subKey = null, subSubKey = null) => {
    const { value } = e.target;
    setConfig(prevConfig => {
      // Create deep copies to avoid state mutation issues
      const newConfig = JSON.parse(JSON.stringify(prevConfig));
      
      if (subSubKey) {
        newConfig[section][key][subKey][subSubKey] = value;
      } else if (subKey) {
        newConfig[section][key][subKey] = value;
      } else {
        newConfig[section][key] = value;
      }
      return newConfig;
    });
  };
  
  // 3. Handle saving data to the backend
  const handleSave = async () => {
    setStatus('saving');
    setError('');
    
    try {
      // Get the currently logged-in user's auth token
      const idToken = await auth.currentUser.getIdToken(true);
      
      // Send the data AND the token to our secure backend function
      const response = await fetch('/.netlify/functions/update-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}` // Send the auth token
        },
        body: JSON.stringify(config) // Send the entire updated config
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || 'Server error');
      }

      setStatus('success');
      setTimeout(() => setStatus(''), 2000); // Reset status
      
    } catch (err) {
      setError(err.message);
      setStatus('error');
    }
  };

  if (!config) {
    return <div className="p-8 text-center"><span className="loader"></span> Loading configuration...</div>;
  }

  // --- Render the UI ---
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Admin Dashboard</h2>
        <button
          onClick={() => signOut(auth)}
          className="text-sm text-gray-600 hover:text-blue-600"
        >
          Sign Out
        </button>
      </div>

      <div className="space-y-6">
        {/* --- Section for Prices --- */}
        <div className="p-4 border rounded-lg">
          <h3 className="text-lg font-semibold mb-4">Base Prices</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label className="block">
              <span className="text-sm font-medium">Bi-Weekly ($)</span>
              <input
                type="number"
                value={config.data.basePrices.biWeekly}
                onChange={(e) => handleChange(e, 'data', 'basePrices', 'biWeekly')}
                className="w-full p-2 border-2 border-gray-200 rounded-lg mt-1"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Weekly ($)</span>
              <input
                type="number"
                value={config.data.basePrices.weekly}
                onChange={(e) => handleChange(e, 'data', 'basePrices', 'weekly')}
                className="w-full p-2 border-2 border-gray-200 rounded-lg mt-1"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Twice-Weekly ($)</span>
              <input
                type="number"
                value={config.data.basePrices.twiceWeekly}
                onChange={(e) => handleChange(e, 'data', 'basePrices', 'twiceWeekly')}
                className="w-full p-2 border-2 border-gray-200 rounded-lg mt-1"
              />
            </label>
          </div>
        </div>

        {/* --- Section for Text (Example) --- */}
        <div className="p-4 border rounded-lg">
          <h3 className="text-lg font-semibold mb-4">Site Text</h3>
          <label className="block">
            <span className="text-sm font-medium">Zip Code Page Title</span>
            <input
              type="text"
              value={config.text.zipView.title}
              onChange={(e) => handleChange(e, 'text', 'zipView', 'title')}
              className="w-full p-2 border-2 border-gray-200 rounded-lg mt-1"
            />
          </label>
          <label className="block mt-4">
            <span className="text-sm font-medium">Special Offer Body (HTML allowed)</span>
            <textarea
              rows="3"
              value={config.text.globals.specialOfferBody}
              onChange={(e) => handleChange(e, 'text', 'globals', 'specialOfferBody')}
              className="w-full p-2 border-2 border-gray-200 rounded-lg mt-1"
            />
          </label>
        </div>
        
        {/* --- Section for ZIP Codes (Example) --- */}
        <div className="p-4 border rounded-lg">
          <h3 className="text-lg font-semibold mb-4">Approved ZIP Codes</h3>
           <label className="block">
            <span className="text-sm font-medium">ZIP Codes (comma-separated)</span>
            <textarea
              rows="5"
              value={config.data.APPROVED_ZIP_CODES.join(', ')}
              onChange={(e) => {
                const zips = e.target.value.split(',').map(z => z.trim()).filter(z => z.length > 0);
                setConfig(prevConfig => ({
                  ...prevConfig,
                  data: {
                    ...prevConfig.data,
                    APPROVED_ZIP_CODES: zips
                  }
                }));
              }}
              className="w-full p-2 border-2 border-gray-200 rounded-lg mt-1 font-mono"
            />
          </label>
        </div>

      </div>

      {/* --- Save Button --- */}
      <div className="mt-8 border-t pt-6 text-right">
        {status === 'success' && <p className="inline-block mr-4 text-green-600">Saved successfully!</p>}
        {status === 'error' && <p className="inline-block mr-4 text-red-600">{error}</p>}
        <button
          onClick={handleSave}
          disabled={status === 'saving'}
          className="w-full md:w-auto bg-[var(--brand-green)] text-white font-bold text-lg py-3 px-8 rounded-lg hover:bg-opacity-90 disabled:bg-gray-400"
        >
          {status === 'saving' ? 'Saving...' : 'Save All Changes'}
        </button>
      </div>
    </div>
  );
};

export default AdminPanel;