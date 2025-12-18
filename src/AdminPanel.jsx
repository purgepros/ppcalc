import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import firebaseConfig from './firebaseConfig'; 

// Initialize Firebase using the imported config
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/**
 * A reusable input field component
 * Updated to accept 'type' prop for numeric handling
 */
const AdminInput = ({ label, value, onChange, placeholder, type = "text" }) => (
  <label className="block">
    <span className="text-sm font-medium text-gray-700">{label}</span>
    <input
      type={type}
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
 * A reusable toggle switch
 */
const AdminToggle = ({ label, checked, onChange }) => (
  <label className="flex items-center justify-between p-3 border rounded-lg bg-gray-50 cursor-pointer">
    <span className="text-sm font-medium text-gray-700">{label}</span>
    <div className="relative inline-flex items-center cursor-pointer">
      <input type="checkbox" className="sr-only peer" checked={checked || false} onChange={onChange} />
      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
    </div>
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
  
  // 2. Handle "deep" state changes for nested objects (Safe Version with Array Checks)
  const handleChange = (e, section, key, subKey = null, subSubKey = null) => {
    const { value, type, checked } = e.target;
    
    // Parse numbers correctly
    const val = type === 'checkbox' ? checked : (type === 'number' ? Number(value) : value);

    setConfig(prevConfig => {
      const newConfig = JSON.parse(JSON.stringify(prevConfig));
      
      // Ensure base paths exist and are OBJECTS (not arrays)
      if (!newConfig[section] || Array.isArray(newConfig[section])) newConfig[section] = {};
      if (!newConfig[section][key] || Array.isArray(newConfig[section][key])) newConfig[section][key] = {};

      if (subSubKey) {
        // Ensure the parent (subKey) is an object before setting property
        // FIX: Explicitly check !Array.isArray to prevent "array with properties" bug
        if (!newConfig[section][key][subKey] || typeof newConfig[section][key][subKey] !== 'object' || Array.isArray(newConfig[section][key][subKey])) {
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

  // 3. Handle changes to items in an array (Robust for deep nesting)
  const handleArrayChange = (e, section, key, subKey, index, subSubKey = null) => {
    const { value } = e.target;
    setConfig(prevConfig => {
      const newConfig = JSON.parse(JSON.stringify(prevConfig));
      
      // Ensure path exists and are OBJECTS
      if (!newConfig[section] || Array.isArray(newConfig[section])) newConfig[section] = {};
      if (!newConfig[section][key] || Array.isArray(newConfig[section][key])) newConfig[section][key] = {};
      
      // FIX: Ensure subKey is a plain object, NOT an array
      if (!newConfig[section][key][subKey] || (subSubKey && (typeof newConfig[section][key][subKey] !== 'object' || Array.isArray(newConfig[section][key][subKey])))) {
          newConfig[section][key][subKey] = {};
      }

      let targetArray;
      if (subSubKey) {
         if (!Array.isArray(newConfig[section][key][subKey][subSubKey])) {
             newConfig[section][key][subKey][subSubKey] = [];
         }
         targetArray = newConfig[section][key][subKey][subSubKey];
      } else {
         if (!Array.isArray(newConfig[section][key][subKey])) {
             newConfig[section][key][subKey] = [];
         }
         targetArray = newConfig[section][key][subKey];
      }

      targetArray[index] = value;
      return newConfig;
    });
  };

  // 4. SPECIAL: Handle converting TextArea newlines to Array
  const handleFeaturesChange = (e, planKey) => {
    const rawText = e.target.value;
    const lines = rawText.split('\n');
    
    setConfig(prevConfig => {
      const newConfig = JSON.parse(JSON.stringify(prevConfig));
      if (!newConfig.data) newConfig.data = {};
      if (!newConfig.data.planDetails) newConfig.data.planDetails = {};
      if (!newConfig.data.planDetails[planKey]) newConfig.data.planDetails[planKey] = {};
      
      newConfig.data.planDetails[planKey].features = lines;
      return newConfig;
    });
  };
  
  // 5. SPECIAL: Handle ZIP Codes
  const handleZipChange = (e) => {
    const rawText = e.target.value;
    const zips = rawText.split(',');
    
    setConfig(prevConfig => ({
      ...prevConfig,
      data: {
        ...prevConfig.data,
        APPROVED_ZIP_CODES: zips
      }
    }));
  };

  // --- Load from Local Config.json ---
  const handleLoadFromLocal = async () => {
    if (!window.confirm("Warning: This will overwrite the current Admin view with data from your 'config.json' file. You must click 'Save' afterwards to update the database. Continue?")) return;
    
    setStatus('loading');
    try {
      const res = await fetch('/config.json');
      if (!res.ok) throw new Error('Failed to load local config');
      const localConfig = await res.json();
      setConfig(localConfig);
      setStatus('success');
      setTimeout(() => setStatus(''), 2000);
    } catch (err) {
      console.error(err);
      setError('Failed to load config.json: ' + err.message);
      setStatus('error');
    }
  };
  
  // 6. Handle saving data to the backend
  const handleSave = async () => {
    setStatus('saving');
    setError('');
    
    const cleanConfig = JSON.parse(JSON.stringify(config));

    // Clean Features
    ['biWeekly', 'weekly', 'twiceWeekly'].forEach(plan => {
       if (cleanConfig.data?.planDetails?.[plan]?.features) {
         cleanConfig.data.planDetails[plan].features = cleanConfig.data.planDetails[plan].features
           .map(f => f.trim())
           .filter(f => f !== '');
       }
    });

    // Clean Zips
    if (cleanConfig.data?.APPROVED_ZIP_CODES) {
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
        body: JSON.stringify(cleanConfig) 
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || 'Server error');
      }
      
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

  // Helpers to safely get arrays (Prevent "map is not a function" crashes)
  const getSafeArray = (obj, path) => {
    const val = path.reduce((acc, curr) => acc && acc[curr], obj);
    return Array.isArray(val) ? val : [val || ""];
  };

  // Safe access to simple values
  const stripeMode = config.data?.STRIPE_MODE || 'test';

  // --- Render the UI ---
  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <h2 className="text-2xl font-bold">Admin Dashboard</h2>
        <div className="flex items-center gap-4">
            <button
                onClick={handleLoadFromLocal}
                className="bg-gray-200 text-gray-700 text-sm font-bold py-2 px-4 rounded hover:bg-gray-300 transition-colors"
            >
                Load Defaults from Code
            </button>
            <button
            onClick={() => signOut(auth)}
            className="text-sm text-gray-600 hover:text-blue-600"
            >
            Sign Out
            </button>
        </div>
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
              value={config.data?.FACEBOOK_PIXEL_ID}
              onChange={(e) => handleChange(e, 'data', 'FACEBOOK_PIXEL_ID')}
            />
            
            <div className="p-3 border-2 border-gray-200 rounded-lg bg-gray-100 flex flex-col justify-center">
              <span className="text-sm font-medium text-gray-700 mb-1">Google Tag ID</span>
              <p className="text-xs text-gray-500">
                This is hardcoded in index.html for verification.
              </p>
            </div>

            <AdminInput 
              label="Favicon URL"
              value={config.data?.FAVICON_URL}
              onChange={(e) => handleChange(e, 'data', 'FAVICON_URL')}
            />
          </div>
        </div>

        {/* --- PROMOTIONS SECTION --- */}
        <div className="p-4 border-2 border-green-200 bg-green-50 rounded-lg shadow-sm">
          <h3 className="text-lg font-bold text-green-800 mb-2 flex items-center">
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
            Promotions & Offers
          </h3>
          <p className="text-xs text-green-700 mb-4">
            Activate a "50% Off First Month" trial. You must create coupons in Stripe Dashboard with "Duration: Once" and "Percentage off: 50%".
          </p>
          
          <div className="grid grid-cols-1 gap-4">
             <AdminToggle 
               label="ACTIVATE '50% Off First Month' Trial"
               checked={config.data?.promotions?.isActive}
               onChange={(e) => handleChange(e, 'data', 'promotions', 'isActive')}
             />
             
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <AdminInput 
                  label="Test Mode Coupon ID (From Stripe)"
                  placeholder="e.g. 8K9sJ2Lp"
                  value={config.data?.promotions?.couponIdTest}
                  onChange={(e) => handleChange(e, 'data', 'promotions', 'couponIdTest')}
                />
                <AdminInput 
                  label="Live Mode Coupon ID (From Stripe)"
                  placeholder="e.g. PROMO50"
                  value={config.data?.promotions?.couponIdLive}
                  onChange={(e) => handleChange(e, 'data', 'promotions', 'couponIdLive')}
                />
             </div>
             
             <AdminInput 
               label="Banner Text (Displayed on Packages)"
               placeholder="Limited Time: Get 50% Off Your First Month!"
               value={config.data?.promotions?.bannerText}
               onChange={(e) => handleChange(e, 'data', 'promotions', 'bannerText')}
             />
          </div>
        </div>

        {/* --- Section for Prices --- */}
        <div className="p-4 border rounded-lg">
          <h3 className="text-lg font-semibold mb-4">Base Pricing</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label className="block">
              <span className="text-sm font-medium">Base Bi-Weekly ($)</span>
              <input
                type="number"
                value={config.data?.basePrices?.biWeekly}
                onChange={(e) => handleChange(e, 'data', 'basePrices', 'biWeekly')}
                className="w-full p-2 border-2 border-gray-200 rounded-lg mt-1"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Base Weekly ($)</span>
              <input
                type="number"
                value={config.data?.basePrices?.weekly}
                onChange={(e) => handleChange(e, 'data', 'basePrices', 'weekly')}
                className="w-full p-2 border-2 border-gray-200 rounded-lg mt-1"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Base Twice-Weekly ($)</span>
              <input
                type="number"
                value={config.data?.basePrices?.twiceWeekly}
                onChange={(e) => handleChange(e, 'data', 'basePrices', 'twiceWeekly')}
                className="w-full p-2 border-2 border-gray-200 rounded-lg mt-1"
              />
            </label>
          </div>

          {/* --- NEW LOT SIZE FEES SECTION --- */}
          <h4 className="text-md font-semibold mt-6 mb-2">Lot Size Upcharges ($/mo)</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AdminInput
              type="number"
              label="Medium Lot (Tier 1)"
              value={config.data?.lotFees?.tier1}
              onChange={(e) => handleChange(e, 'data', 'lotFees', 'tier1')}
            />
            <AdminInput
              type="number"
              label="Large Lot (Tier 2)"
              value={config.data?.lotFees?.tier2}
              onChange={(e) => handleChange(e, 'data', 'lotFees', 'tier2')}
            />
          </div>

          <h4 className="text-md font-semibold mt-6 mb-2">Additional Dog Fees ($)</h4>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <AdminInput
              type="number"
              label="Price Per Extra Dog (Over 1)"
              value={config.data?.extraDogPrice}
              onChange={(e) => handleChange(e, 'data', 'extraDogPrice')}
            />
          </div>
          <h4 className="text-md font-semibold mt-6 mb-2">Add-on Pricing ($)</h4>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <AdminInput
              type="number"
              label="Yard+ Coverage Add-on"
              value={config.data?.yardPlusPrice || 20}
              onChange={(e) => handleChange(e, 'data', 'yardPlusPrice')}
            />
          </div>
        </div>

        {/* --- Section for Plan Features --- */}
        <div className="p-4 border rounded-lg">
          <h3 className="text-lg font-semibold mb-4">Package Features & Titles</h3>
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
                    <div className="grid grid-cols-2 gap-4">
                        <AdminInput 
                          label="Plan Name Display"
                          value={config.data?.planDetails?.[planKey]?.name}
                          onChange={(e) => handleChange(e, 'data', 'planDetails', planKey, 'name')}
                        />
                        <AdminInput 
                          label="Service Frequency"
                          value={config.data?.planDetails?.[planKey]?.frequency}
                          onChange={(e) => handleChange(e, 'data', 'planDetails', planKey, 'frequency')}
                        />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 bg-white p-2 rounded border">
                        <AdminInput 
                          label="Main Service Title (Hidden on Card)"
                          placeholder="e.g. Maintenance Level Service"
                          value={config.data?.planDetails?.[planKey]?.serviceTitle || ""}
                          onChange={(e) => handleChange(e, 'data', 'planDetails', planKey, 'serviceTitle')}
                        />
                        <AdminInput 
                          label="Service Sub-Title (Shows on Card)"
                          placeholder="e.g. (2 Visits/Month)"
                          value={config.data?.planDetails?.[planKey]?.serviceSubTitle || ""}
                          onChange={(e) => handleChange(e, 'data', 'planDetails', planKey, 'serviceSubTitle')}
                        />
                    </div>

                    <AdminTextArea
                      label="Features List (One per line)"
                      rows={7}
                      value={(config.data?.planDetails?.[planKey]?.features || []).join('\n')}
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
            value={(config.data?.APPROVED_ZIP_CODES || []).join(',')}
            onChange={handleZipChange}
           />
        </div>

        {/* --- Section for Page Text --- */}
        <div className="p-4 border rounded-lg">
          <h3 className="text-lg font-semibold mb-4">Page Content</h3>
          <div className="space-y-4">
            <AdminInput 
              label="Zip Page Title"
              value={config.text?.zipView?.title}
              onChange={(e) => handleChange(e, 'text', 'zipView', 'title')}
            />
            <AdminTextArea 
              label="Special Offer Body (HTML allowed)"
              value={config.text?.globals?.specialOfferBody}
              onChange={(e) => handleChange(e, 'text', 'globals', 'specialOfferBody')}
            />
             <AdminTextArea 
              label="Checkout: 'What Happens Next' Text (HTML)"
              value={config.text?.checkoutView?.whatHappensNextBody}
              rows={6}
              onChange={(e) => handleChange(e, 'text', 'checkoutView', 'whatHappensNextBody')}
            />
          </div>
        </div>
        
        {/* --- Section for Modals --- */}
        <div className="p-4 border rounded-lg">
          <h3 className="text-lg font-semibold mb-4">Modal Text ("i" Buttons)</h3>
          
          <div className="space-y-4">
            <div className="p-3 border rounded-md bg-green-50 border-green-200">
              <h4 className="text-md font-semibold mb-2 text-green-800">Satisfaction Guarantee Modal (Header)</h4>
              <AdminInput 
                label="Title"
                value={config.text?.modals?.satisfactionInfo?.title || "100% Satisfaction Guaranteed"}
                onChange={(e) => handleChange(e, 'text', 'modals', 'satisfactionInfo', 'title')}
              />
              <AdminTextArea 
                label="Body Text"
                value={config.text?.modals?.satisfactionInfo?.body || ""}
                onChange={(e) => handleChange(e, 'text', 'modals', 'satisfactionInfo', 'body')}
              />
              <AdminInput 
                label="Footer Text"
                value={config.text?.modals?.satisfactionInfo?.footer || ""}
                onChange={(e) => handleChange(e, 'text', 'modals', 'satisfactionInfo', 'footer')}
              />
            </div>

            <div className="p-3 border rounded-md">
              <h4 className="text-md font-semibold mb-2">Service Info Modal</h4>
              <AdminInput 
                label="Title"
                value={config.text?.modals?.serviceInfo?.title}
                onChange={(e) => handleChange(e, 'text', 'modals', 'serviceInfo', 'title')}
              />
              {getSafeArray(config, ['text', 'modals', 'serviceInfo', 'body']).map((text, index) => (
                <AdminTextArea
                  key={index}
                  label={`Paragraph ${index + 1} (HTML)`}
                  value={text}
                  onChange={(e) => handleArrayChange(e, 'text', 'modals', 'serviceInfo', index, 'body')}
                />
              ))}
            </div>

            <div className="p-3 border rounded-md">
              <h4 className="text-md font-semibold mb-2">Alerts Info Modal</h4>
              <AdminInput 
                label="Title"
                value={config.text?.modals?.alertsInfo?.title}
                onChange={(e) => handleChange(e, 'text', 'modals', 'alertsInfo', 'title')}
              />
              <AdminTextArea 
                label="Body Text"
                value={config.text?.modals?.alertsInfo?.body}
                onChange={(e) => handleChange(e, 'text', 'modals', 'alertsInfo', 'body')}
              />
              {getSafeArray(config, ['text', 'modals', 'alertsInfo', 'bullets']).map((text, index) => (
                <AdminInput
                  key={index}
                  label={`Bullet ${index + 1} (HTML)`}
                  value={text}
                  onChange={(e) => handleArrayChange(e, 'text', 'modals', 'alertsInfo', index, 'bullets')}
                />
              ))}
            </div>

            <div className="p-3 border rounded-md">
              <h4 className="text-md font-semibold mb-2">Pricing Info Modal</h4>
              <AdminInput 
                label="Title"
                value={config.text?.modals?.pricingInfo?.title}
                onChange={(e) => handleChange(e, 'text', 'modals', 'pricingInfo', 'title')}
              />
              {getSafeArray(config, ['text', 'modals', 'pricingInfo', 'body']).map((text, index) => (
                 <AdminTextArea 
                  key={index}
                  label={`Paragraph ${index + 1} (HTML)`}
                  value={text}
                  onChange={(e) => handleArrayChange(e, 'text', 'modals', 'pricingInfo', index, 'body')}
                />
              ))}
              {getSafeArray(config, ['text', 'modals', 'pricingInfo', 'bullets']).map((text, index) => (
                <AdminInput
                  key={index}
                  label={`Bullet ${index + 1} (HTML)`}
                  value={text}
                  onChange={(e) => handleArrayChange(e, 'text', 'modals', 'pricingInfo', index, 'bullets')}
                />
              ))}
               <AdminInput 
                label="Footer Text"
                value={config.text?.modals?.pricingInfo?.footer}
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
              value={config.text?.footer?.address}
              onChange={(e) => handleChange(e, 'text', 'footer', 'address')}
            />
             <AdminInput 
              label="Phone 1"
              value={config.text?.footer?.phone1}
              onChange={(e) => handleChange(e, 'text', 'footer', 'phone1')}
            />
             <AdminInput 
              label="Phone 2"
              value={config.text?.footer?.phone2}
              onChange={(e) => handleChange(e, 'text', 'footer', 'phone2')}
            />
             <AdminInput 
              label="Email"
              value={config.text?.footer?.email}
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