import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import firebaseConfig from './firebaseConfig'; // Explicit extension removed

// Initialize Firebase using the imported config
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/**
 * A reusable input field component
 */
const AdminInput = ({ label, value, onChange, placeholder }) => (
  <label className="block">
    <span className="text-sm font-medium text-gray-700">{label}</span>
    <input
      type="text"
      value={value || ''}
      onChange={onChange}
      placeholder={placeholder}
      className="w-full p-2 border-2 border-gray-200 rounded-lg mt-1"
    />
  </label>
);

/**
 * A reusable text area component
 */
const AdminTextArea = ({ label, value, onChange, rows = 3, placeholder }) => (
  <label className="block">
    <span className="text-sm font-medium text-gray-700">{label}</span>
    <textarea
      rows={rows}
      value={value || ''}
      onChange={onChange}
      placeholder={placeholder}
      className="w-full p-2 border-2 border-gray-200 rounded-lg mt-1"
    />
  </label>
);

/**
 * A reusable select component
 */
const AdminSelect = ({ label, value, onChange, options }) => (
  <label className="block">
    <span className="text-sm font-medium text-gray-700">{label}</span>
    <select
      value={value || ''}
      onChange={onChange}
      className="w-full p-2 border-2 border-gray-200 rounded-lg mt-1 bg-white"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  </label>
);

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
      try {
        const docRef = doc(db, 'config', 'production');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setConfig(docSnap.data());
        } else {
          setError('Could not find config document in Firestore.');
        }
      } catch (err) {
        console.error(err);
        setError('Error fetching configuration.');
      }
      setStatus('');
    };
    fetchData();
  }, []);
  
  // 2. Handle "deep" state changes for nested objects
  const handleChange = (e, section, key, subKey = null, subSubKey = null) => {
    const { value, type, checked } = e.target;
    const val = type === 'checkbox' ? checked : value;

    setConfig(prevConfig => {
      const newConfig = JSON.parse(JSON.stringify(prevConfig));
      
      if (subSubKey) {
        // --- NEW: Safe Object Creation ---
        // If the intermediate object (e.g. satisfactionInfo) is missing, create it.
        if (!newConfig[section][key][subKey]) {
            newConfig[section][key][subKey] = {};
        }
        newConfig[section][key][subKey][subSubKey] = val;
      } else if (subKey) {
        newConfig[section][key][subKey] = val;
      } else {
        newConfig[section][key] = val;
      }
      return newConfig;
    });
  };

  // 3. Handle changes to items in an array (like modal bullets)
  const handleArrayChange = (e, section, key, subKey, index) => {
    const { value } = e.target;
    setConfig(prevConfig => {
      const newConfig = JSON.parse(JSON.stringify(prevConfig));
      newConfig[section][key][subKey][index] = value;
      return newConfig;
    });
  };

  // 4. SPECIAL: Handle converting TextArea newlines to Array (for Plan Features)
  const handleFeaturesChange = (e, planKey) => {
    const rawText = e.target.value;
    // BUG FIX: Do NOT trim or filter here. Just split.
    // This preserves spaces and empty lines while typing.
    const lines = rawText.split('\n');
    
    setConfig(prevConfig => {
      const newConfig = JSON.parse(JSON.stringify(prevConfig));
      newConfig.data.planDetails[planKey].features = lines;
      return newConfig;
    });
  };
  
  // 5. SPECIAL: Handle ZIP Codes
  const handleZipChange = (e) => {
    const rawText = e.target.value;
    // BUG FIX: Do not trim/filter here. Allow the raw split to exist in state.
    const zips = rawText.split(',');
    
    setConfig(prevConfig => ({
      ...prevConfig,
      data: {
        ...prevConfig.data,
        APPROVED_ZIP_CODES: zips
      }
    }));
  };
  
  // 6. Handle saving data to the backend
  const handleSave = async () => {
    setStatus('saving');
    setError('');
    
    // --- CLEANUP STEP ---
    // Before saving, we sanitize the data to remove empty lines/spaces
    const cleanConfig = JSON.parse(JSON.stringify(config));

    // Clean Features
    ['biWeekly', 'weekly', 'twiceWeekly'].forEach(plan => {
       if (cleanConfig.data.planDetails[plan]?.features) {
         cleanConfig.data.planDetails[plan].features = cleanConfig.data.planDetails[plan].features
           .map(f => f.trim())
           .filter(f => f !== '');
       }
    });

    // Clean Zips
    if (cleanConfig.data.APPROVED_ZIP_CODES) {
      cleanConfig.data.APPROVED_ZIP_CODES = cleanConfig.data.APPROVED_ZIP_CODES
        .map(z => z.trim())
        .filter(z => z !== '');
    }
    
    try {
      const idToken = await auth.currentUser.getIdToken(true);
      
      const response = await fetch('/.netlify/functions/update-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify(cleanConfig) // Send the CLEAN config
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || 'Server error');
      }
      
      // Update local state with the clean version too, so UI reflects the save
      setConfig(cleanConfig);

      setStatus('success');
      setTimeout(() => setStatus(''), 2000);
      
    } catch (err) {
      setError(err.message);
      setStatus('error');
    }
  };

  if (!config) {
    return <div className="p-8 text-center"><span className="loader"></span> Loading configuration...</div>;
  }

  // Safely access keys in case they don't exist yet in Firestore
  const stripeMode = config.data.STRIPE_MODE || 'test';
  const googleTagId = config.data.GOOGLE_TAG_ID || '';

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
        
        {/* --- Global Data --- */}
        <div className="p-4 border rounded-lg bg-gray-50">
          <h3 className="text-lg font-semibold mb-4">Global Config & Tracking</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <AdminSelect 
              label="Stripe Environment Mode"
              value={stripeMode}
              onChange={(e) => handleChange(e, 'data', 'STRIPE_MODE')}
              options={[
                { value: 'test', label: 'Test Mode (Safe)' },
                { value: 'live', label: 'LIVE PRODUCTION (Charging Real Money)' }
              ]}
            />
            <AdminInput 
              label="Facebook Pixel ID"
              value={config.data.FACEBOOK_PIXEL_ID}
              onChange={(e) => handleChange(e, 'data', 'FACEBOOK_PIXEL_ID')}
            />
            <AdminInput 
              label="Google Tag ID (G-XXXXXXXXXX)"
              value={googleTagId}
              placeholder="G-XXXXXXXXXX"
              onChange={(e) => handleChange(e, 'data', 'GOOGLE_TAG_ID')}
            />
            <AdminInput 
              label="Favicon URL"
              value={config.data.FAVICON_URL}
              onChange={(e) => handleChange(e, 'data', 'FAVICON_URL')}
            />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            * Changing Stripe Mode requires you to Save, then refresh the main site. Ensure you have both Test and Live keys set up in your Netlify Environment Variables.
          </p>
        </div>

        {/* --- Section for Prices --- */}
        <div className="p-4 border rounded-lg">
          <h3 className="text-lg font-semibold mb-4">Base Pricing</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label className="block">
              <span className="text-sm font-medium">Base Bi-Weekly ($)</span>
              <input
                type="number"
                value={config.data.basePrices.biWeekly}
                onChange={(e) => handleChange(e, 'data', 'basePrices', 'biWeekly')}
                className="w-full p-2 border-2 border-gray-200 rounded-lg mt-1"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Base Weekly ($)</span>
              <input
                type="number"
                value={config.data.basePrices.weekly}
                onChange={(e) => handleChange(e, 'data', 'basePrices', 'weekly')}
                className="w-full p-2 border-2 border-gray-200 rounded-lg mt-1"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Base Twice-Weekly ($)</span>
              <input
                type="number"
                value={config.data.basePrices.twiceWeekly}
                onChange={(e) => handleChange(e, 'data', 'basePrices', 'twiceWeekly')}
                className="w-full p-2 border-2 border-gray-200 rounded-lg mt-1"
              />
            </label>
          </div>
          <h4 className="text-md font-semibold mt-6 mb-2">Additional Dog Fees ($)</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <label className="block">
              <span className="text-sm font-medium">3 Dogs (Fee)</span>
              <input
                type="number"
                value={config.data.dogFeeMap['3']}
                onChange={(e) => handleChange(e, 'data', 'dogFeeMap', '3')}
                className="w-full p-2 border-2 border-gray-200 rounded-lg mt-1"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">4 Dogs (Fee)</span>
              <input
                type="number"
                value={config.data.dogFeeMap['4']}
                onChange={(e) => handleChange(e, 'data', 'dogFeeMap', '4')}
                className="w-full p-2 border-2 border-gray-200 rounded-lg mt-1"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">5 Dogs (Fee)</span>
              <input
                type="number"
                value={config.data.dogFeeMap['5']}
                onChange={(e) => handleChange(e, 'data', 'dogFeeMap', '5')}
                className="w-full p-2 border-2 border-gray-200 rounded-lg mt-1"
              />
            </label>
          </div>
          
          {/* --- NEW: YARD+ PRICE EDITING --- */}
          <h4 className="text-md font-semibold mt-6 mb-2">Add-on Pricing ($)</h4>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <AdminInput
              label="Yard+ Coverage Add-on"
              value={config.data.yardPlusPrice || 20}
              onChange={(e) => handleChange(e, 'data', 'yardPlusPrice')}
            />
          </div>
        </div>

        {/* --- NEW: Section for Plan Features --- */}
        <div className="p-4 border rounded-lg">
          <h3 className="text-lg font-semibold mb-4">Package Features</h3>
          <p className="text-sm text-gray-500 mb-4">
             Enter one feature per line. Use "!" at the start of a line to strikethrough (exclude) that feature.
          </p>
          
          <div className="space-y-6">
            {['biWeekly', 'weekly', 'twiceWeekly'].map((planKey) => (
               <div key={planKey} className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                 <div className="flex items-center justify-between mb-2">
                   <h4 className="font-bold text-gray-800 capitalize">{planKey.replace(/([A-Z])/g, ' $1').trim()} Plan</h4>
                 </div>
                 
                 <div className="grid grid-cols-1 gap-4">
                    <AdminInput 
                      label="Plan Name Display"
                      value={config.data.planDetails[planKey].name}
                      onChange={(e) => handleChange(e, 'data', 'planDetails', planKey, 'name')}
                    />
                    <AdminTextArea
                      label="Features List (One per line)"
                      rows={7}
                      value={config.data.planDetails[planKey].features.join('\n')}
                      onChange={(e) => handleFeaturesChange(e, planKey)}
                    />
                 </div>
               </div>
            ))}
          </div>
        </div>

        {/* --- Section for ZIP Codes --- */}
        <div className="p-4 border rounded-lg">
          <h3 className="text-lg font-semibold mb-4">Approved ZIP Codes</h3>
           <AdminTextArea
            label="ZIP Codes (comma-separated)"
            rows={5}
            value={config.data.APPROVED_ZIP_CODES.join(',')}
            onChange={handleZipChange}
           />
        </div>

        {/* --- Section for Page Text --- */}
        <div className="p-4 border rounded-lg">
          <h3 className="text-lg font-semibold mb-4">Page Content</h3>
          <div className="space-y-4">
            <AdminInput 
              label="Zip Page Title"
              value={config.text.zipView.title}
              onChange={(e) => handleChange(e, 'text', 'zipView', 'title')}
            />
            <AdminTextArea 
              label="Special Offer Body (HTML allowed)"
              value={config.text.globals.specialOfferBody}
              onChange={(e) => handleChange(e, 'text', 'globals', 'specialOfferBody')}
            />
             <AdminTextArea 
              label="Checkout: 'What Happens Next' Text (HTML)"
              value={config.text.checkoutView.whatHappensNextBody}
              rows={6}
              onChange={(e) => handleChange(e, 'text', 'checkoutView', 'whatHappensNextBody')}
            />
          </div>
        </div>
        
        {/* --- Section for Modals ("i" buttons) --- */}
        <div className="p-4 border rounded-lg">
          <h3 className="text-lg font-semibold mb-4">Modal Text ("i" Buttons)</h3>
          
          <div className="space-y-4">
            {/* Satisfaction Info Modal */}
            <div className="p-3 border rounded-md bg-green-50 border-green-200">
              <h4 className="text-md font-semibold mb-2 text-green-800">Satisfaction Guarantee Modal (Header)</h4>
              <AdminInput 
                label="Title"
                value={config.text.modals.satisfactionInfo?.title || "100% Satisfaction Guaranteed"}
                onChange={(e) => handleChange(e, 'text', 'modals', 'satisfactionInfo', 'title')}
              />
              <AdminTextArea 
                label="Body Text"
                value={config.text.modals.satisfactionInfo?.body || ""}
                onChange={(e) => handleChange(e, 'text', 'modals', 'satisfactionInfo', 'body')}
              />
              <AdminInput 
                label="Footer Text"
                value={config.text.modals.satisfactionInfo?.footer || ""}
                onChange={(e) => handleChange(e, 'text', 'modals', 'satisfactionInfo', 'footer')}
              />
            </div>

            {/* Service Info Modal */}
            <div className="p-3 border rounded-md">
              <h4 className="text-md font-semibold mb-2">Service Info Modal (WYSIwash)</h4>
              <AdminInput 
                label="Title"
                value={config.text.modals.serviceInfo.title}
                onChange={(e) => handleChange(e, 'text', 'modals', 'serviceInfo', 'title')}
              />
              {config.text.modals.serviceInfo.body.map((text, index) => (
                <AdminTextArea
                  key={index}
                  label={`Paragraph ${index + 1} (HTML)`}
                  value={text}
                  onChange={(e) => handleArrayChange(e, 'text', 'modals', 'serviceInfo', 'body', index)}
                />
              ))}
            </div>

            {/* Alerts Info Modal */}
            <div className="p-3 border rounded-md">
              <h4 className="text-md font-semibold mb-2">Alerts Info Modal</h4>
              <AdminInput 
                label="Title"
                value={config.text.modals.alertsInfo.title}
                onChange={(e) => handleChange(e, 'text', 'modals', 'alertsInfo', 'title')}
              />
              <AdminTextArea 
                label="Body Text"
                value={config.text.modals.alertsInfo.body}
                onChange={(e) => handleChange(e, 'text', 'modals', 'alertsInfo', 'body')}
              />
              {config.text.modals.alertsInfo.bullets.map((text, index) => (
                <AdminInput
                  key={index}
                  label={`Bullet ${index + 1} (HTML)`}
                  value={text}
                  onChange={(e) => handleArrayChange(e, 'text', 'modals', 'alertsInfo', 'bullets', index)}
                />
              ))}
            </div>

            {/* Pricing Info Modal */}
            <div className="p-3 border rounded-md">
              <h4 className="text-md font-semibold mb-2">Pricing Info Modal</h4>
              <AdminInput 
                label="Title"
                value={config.text.modals.pricingInfo.title}
                onChange={(e) => handleChange(e, 'text', 'modals', 'pricingInfo', 'title')}
              />
              {config.text.modals.pricingInfo.body.map((text, index) => (
                 <AdminTextArea 
                  key={index}
                  label={`Paragraph ${index + 1} (HTML)`}
                  value={text}
                  onChange={(e) => handleArrayChange(e, 'text', 'modals', 'pricingInfo', 'body', index)}
                />
              ))}
              {config.text.modals.pricingInfo.bullets.map((text, index) => (
                <AdminInput
                  key={index}
                  label={`Bullet ${index + 1} (HTML)`}
                  value={text}
                  onChange={(e) => handleArrayChange(e, 'text', 'modals', 'pricingInfo', 'bullets', index)}
                />
              ))}
               <AdminInput 
                label="Footer Text"
                value={config.text.modals.pricingInfo.footer}
                onChange={(e) => handleChange(e, 'text', 'modals', 'pricingInfo', 'footer')}
              />
            </div>
            
          </div>
        </div>
        
        {/* --- Section for Footer --- */}
        <div className="p-4 border rounded-lg">
          <h3 className="text-lg font-semibold mb-4">Footer Content</h3>
          <div className="space-y-4">
             <AdminInput 
              label="Address"
              value={config.text.footer.address}
              onChange={(e) => handleChange(e, 'text', 'footer', 'address')}
            />
             <AdminInput 
              label="Phone 1"
              value={config.text.footer.phone1}
              onChange={(e) => handleChange(e, 'text', 'footer', 'phone1')}
            />
             <AdminInput 
              label="Phone 2"
              value={config.text.footer.phone2}
              onChange={(e) => handleChange(e, 'text', 'footer', 'phone2')}
            />
             <AdminInput 
              label="Email"
              value={config.text.footer.email}
              onChange={(e) => handleChange(e, 'text', 'footer', 'email')}
            />
          </div>
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