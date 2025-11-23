import React, { useState, useEffect, useMemo, lazy, Suspense } from 'react';
// 1. Import the router components
import { HashRouter as Router, Routes, Route } from 'react-router-dom';

// --- Import Firebase for Site component ---
import { initializeApp, getApp, getApps } from 'firebase/app';
import { getFirestore, doc, getDoc, enableNetwork, disableNetwork } from 'firebase/firestore';
// FIX: Using relative path with explicit extension for reliability
import firebaseConfig from './firebaseConfig.js'; 

// 2. Lazily load the AdminPanel
// FIX: Using relative path with explicit extension
const AdminPanel = lazy(() => import('./AdminPanel.jsx'));

// --- Helper Functions ---

/**
 * Loads an external script dynamically.
 * @param {string} src - The URL of the script to load.
 * @param {string} id - An ID to assign to the script element.
 * @returns {Promise<void>}
 */
const loadScript = (src, id) => {
  return new Promise((resolve, reject) => {
    if (document.getElementById(id)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.id = id;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.body.appendChild(script);
  });
};

/**
 * Initializes the Facebook Pixel.
 * @param {string} pixelId - The Facebook Pixel ID from config.
 */
const initFacebookPixel = (pixelId) => {
  if (window.fbq || !pixelId) return; // Already initialized or no ID
  !function(f,b,e,v,n,t,s)
  {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
  n.callMethod.apply(n,arguments):n.queue.push(arguments)};
  if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
  n.queue=[];t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];
  s.parentNode.insertBefore(t,s)}(window, document,'script',
  'https://connect.facebook.net/en_US/fbevents.js');
  fbq('init', pixelId);
  fbq('track', 'PageView');
};

/**
 * Initializes Google Analytics / Google Ads (GTag).
 * @param {string} tagId - The Google Tag ID (e.g., G-XXXXXX or AW-XXXXXX).
 */
const initGoogleTag = (tagId) => {
  if (!tagId || document.getElementById('google-tag-script')) return;

  // 1. Load the script
  const script = document.createElement('script');
  script.id = 'google-tag-script';
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${tagId}`;
  document.head.appendChild(script);

  // 2. Initialize dataLayer
  window.dataLayer = window.dataLayer || [];
  function gtag(){window.dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', tagId);
};

/**
 * Sets the website's favicon.
 * @param {string} href - The URL of the favicon.
 */
const setFavicon = (href) => {
  if (!href) return;
  let link = document.querySelector("link[rel*='icon']") || document.createElement('link');
  link.type = 'image/png';
  link.rel = 'shortcut icon';
  link.href = href;
  document.getElementsByTagName('head')[0].appendChild(link);
};


/**
 * --- Generates a shareable quote link ---
 * @param {object} quoteState - An object with current selections
 * @returns {string} - A full URL with query parameters
 */
const generateQuoteLink = (quoteState) => {
  const baseUrl = window.location.origin + window.location.pathname;
  const params = new URLSearchParams();
  
  if (quoteState.zip) params.set('zip', quoteState.zip);
  if (quoteState.yardSize) params.set('yardSize', quoteState.yardSize);
  if (quoteState.dogCount) params.set('dogCount', quoteState.dogCount);
  if (quoteState.plan) params.set('plan', quoteState.plan);
  if (quoteState.paymentTerm) params.set('paymentTerm', quoteState.paymentTerm);

  return `${baseUrl}?${params.toString()}`;
};


// --- Exit Intent Hook ---
/**
 * @param {boolean} isFormSubmitted - Pass true if the main form was submitted, to prevent the modal.
 * @param {function} onIntent - Callback to fire when exit intent is detected.
 */
const useExitIntent = (isFormSubmitted, onIntent) => {
  useEffect(() => {
    if (isFormSubmitted) return; // Don't run if form is already submitted

    // Add a delay to prevent firing on page load
    const timerId = setTimeout(() => {
      const handleMouseLeave = (e) => {
        // Check if mouse is near the top of the viewport
        if (e.clientY <= 0) {
          const hasSeenModal = sessionStorage.getItem('seenExitIntentModal');
          if (!hasSeenModal) {
            onIntent(); // Fire the callback
            sessionStorage.setItem('seenExitIntentModal', 'true');
          }
        }
      };
      document.addEventListener('mouseleave', handleMouseLeave);

      // Cleanup
      return () => {
        document.removeEventListener('mouseleave', handleMouseLeave);
      };
    }, 1500); // 1.5 second delay

    // Cleanup timer if component unmounts
    return () => clearTimeout(timerId);

  }, [isFormSubmitted, onIntent]); // Re-check if form gets submitted
};


// --- Child Components ---

/**
 * A full-page loader with optional error message.
 */
const FullPageLoader = ({ error = null }) => (
  <div className="flex flex-col items-center justify-center min-h-[300px]">
    {error ? (
      <div className="max-w-lg w-full bg-red-100 border-l-4 border-red-500 text-red-700 p-6 rounded-lg shadow-md">
        <h3 className="font-bold text-lg mb-2">Application Error</h3>
        <p className="mb-4">Could not load application configuration.</p>
        <pre className="text-sm bg-red-50 p-2 rounded">
          {error.message ? error.message : String(error)}
        </pre>
      </div>
    ) : (
      <span className="loader"></span>
    )}
  </div>
);

// ... (Child components kept exactly as they were) ...

/**
 * VIEW 1: The Gate (Zip Code Validator)
 */
const ZipCodeValidator = ({ onZipValidated, approvedZipCodes, text }) => {
  const [zip, setZip] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!/^\d{5}$/.test(zip)) {
      setError('Please enter a valid 5-digit ZIP code.');
      return;
    }
    if (!approvedZipCodes.includes(zip)) {
      setError("We're sorry, but we do not service this area at this time.");
      return;
    }
    // Valid zip
    setError('');
    onZipValidated(zip);
  };

  return (
    <div className="bg-white p-8 rounded-xl shadow-lg fade-in">
      <h2 className="text-2xl font-bold text-slate-800 text-center mb-6">{text.title}</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="tel"
          name="zip"
          inputMode="numeric"
          pattern="[0-9]*"
          placeholder="Enter 5-Digit Zip Code"
          required
          maxLength="5"
          className="w-full p-4 border-2 border-gray-300 rounded-lg text-lg text-center"
          value={zip}
          onChange={(e) => setZip(e.target.value)}
        />
        {error && (
          <p className="text-red-600 text-sm font-medium text-center">{error}</p>
        )}
        <button
          type="submit"
          className="w-full bg-[var(--brand-green)] text-white font-bold text-lg py-4 rounded-lg hover:bg-opacity-90 transition-all duration-200 transform hover:-translate-y-0.5 shadow-lg hover:shadow-xl flex items-center justify-center h-14"
        >
          See Prices
        </button>
      </form>
    </div>
  );
};


/**
 * VIEW 2: The Sorter (Yard Size & Dog Count)
 */
const Sorter = ({ onSortComplete, onBack, initialYardSize, initialDogCount, dogFeeMap, text, specialOffer }) => {
  const [yardSize, setYardSize] = useState(initialYardSize);
  const [dogCount, setDogCount] = useState(initialDogCount);

  const handleSubmit = () => {
    const fee = dogFeeMap[dogCount] ?? 0; // Default to 0 if 6+
    onSortComplete(yardSize, dogCount, fee);
  };

  return (
    <div className="bg-white p-8 rounded-xl shadow-lg fade-in">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-800 text-center mb-2">{text.yardTitle}</h2>
        <div className="space-y-4">
          <YardButton
            title="Standard Residential Lot"
            description="Up to 1/2 Acre"
            icon={<svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6-4a1 1 0 001-1v-1a1 1 0 10-2 0v1a1 1 0 001 1z" /></svg>}
            onClick={() => setYardSize('standard')}
            isSelected={yardSize === 'standard'}
          />
          <YardButton
            title="Large Lot / Estate"
            description="Over 1/2 Acre"
            icon={<svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
            onClick={() => setYardSize('estate')}
            isSelected={yardSize === 'estate'}
          />
        </div>
      </div>

      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-800 text-center mb-4">{text.dogTitle}</h2>
        <select
          value={dogCount}
          onChange={(e) => setDogCount(e.target.value)}
          className="w-full p-4 border-2 border-gray-300 rounded-lg text-lg"
        >
          <option value="1-2">1-2 Dogs</option>
          <option value="3">3 Dogs</option>
          <option value="4">4 Dogs</option>
          <option value="5">5 Dogs</option>
          <option value="6+">6+ Dogs</option>
        </select>
      </div>
      
      <div className="bg-green-100 border-l-4 border-green-500 text-green-900 p-4 rounded-r-lg mb-6 shadow-md flex items-center space-x-3 special-offer-glow">
        <svg className="w-8 h-8 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
        <div>
          <p className="font-bold text-lg">{specialOffer.specialOfferTitle}</p>
          <p className="text-sm font-semibold" dangerouslySetInnerHTML={{ __html: specialOffer.specialOfferBody }} />
        </div>
      </div>

      <button
        onClick={handleSubmit}
        className="w-full bg-[var(--brand-green)] text-white font-bold text-lg py-4 rounded-lg hover:bg-opacity-90 transition-all duration-200 transform hover:-translate-y-0.5 shadow-lg hover:shadow-xl flex items-center justify-center mt-6"
      >
        See My Plans
      </button>

      <button
        onClick={onBack}
        className="w-full text-center text-sm text-gray-600 hover:text-blue-600 hover:underline transition-colors mt-6"
      >
        &larr; Change Zip Code
      </button>
    </div>
  );
};


const YardButton = ({ title, description, icon, onClick, isSelected }) => (
  <button
    onClick={onClick}
    className={`w-full text-left p-6 border-2 rounded-xl transition-all hover:-translate-y-1 ${
      isSelected
        ? 'border-blue-500 bg-blue-50 shadow-lg hover:shadow-xl'
        : 'border-gray-300 bg-white hover:border-blue-400 hover:shadow-lg'
    }`}
  >
    <div className="flex items-center">
      <div className="flex-shrink-0 w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center mr-4">
        {icon}
      </div>
      <div>
        <h3 className="text-lg font-bold text-slate-800">{title}</h3>
        <p className="text-sm text-slate-600">{description}</p>
      </div>
    </div>
  </button>
);

/**
 * VIEW 3B: The "Package Selection"
 */
const PackageSelector = ({ basePrices, planDetails, dogFee, dogCount, yardPlusPrice, onPlanSelect, onBack, onOneTimeClick, onInfoClick, onAlertsInfoClick, text, specialOffer, yardPlusSelections, setYardPlusSelections }) => {
  
  const handleToggle = (planKey) => {
    setYardPlusSelections(prev => ({
      ...prev,
      [planKey]: !prev[planKey]
    }));
  };

  // FIX: Cast yardPlusPrice to Number to prevent NaN bugs if config data is missing or string
  const safeYardPlusPrice = Number(yardPlusPrice) || 0;

  // Calculate prices based on selection
  const plans = [
    { 
      key: 'biWeekly', 
      ...planDetails.biWeekly, 
      // Add Yard+ price ONLY if selected for THIS plan
      finalPrice: basePrices[planDetails.biWeekly.priceKey] + dogFee + (yardPlusSelections['biWeekly'] ? safeYardPlusPrice : 0) 
    },
    { 
      key: 'weekly', 
      ...planDetails.weekly, 
      // Add Yard+ price ONLY if selected for THIS plan
      finalPrice: basePrices[planDetails.weekly.priceKey] + dogFee + (yardPlusSelections['weekly'] ? safeYardPlusPrice : 0), 
      popular: true 
    },
    { 
      key: 'twiceWeekly', 
      ...planDetails.twiceWeekly, 
      // NEVER add Yard+ price (it's included)
      finalPrice: basePrices[planDetails.twiceWeekly.priceKey] + dogFee 
    },
  ];
  
  const dogText = dogCount === '1-2' ? 'up to 2 Dog' : `up to ${dogCount} Dog`;

  return (
    <div className="bg-white p-6 md:p-8 rounded-xl shadow-lg fade-in">
      <button onClick={onBack} className="text-sm text-gray-600 hover:text-blue-600 hover:underline mb-4">&larr; Back to Selections</button>
      <h2 className="text-2xl font-bold text-slate-800 text-center mb-6">{text.title}</h2>
      
      <div className="bg-green-100 border-l-4 border-green-500 text-green-900 p-4 rounded-r-lg mb-6 shadow-md flex items-center space-x-3 special-offer-glow">
        <svg className="w-8 h-8 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
        <div>
          <p className="font-bold text-lg">{specialOffer.specialOfferTitle}</p>
          <p className="text-sm font-semibold" dangerouslySetInnerHTML={{ __html: specialOffer.specialOfferBody }} />
        </div>
      </div>

      <div className="space-y-4">
        {plans.map((plan) => {
          // --- FEATURE SORTING LOGIC (Modified) ---
          // We separate "Included Free Features" to highlight them as Badges
          const featuredFreeFeatures = [];
          const standardFeatures = [];

          plan.features.forEach(feature => {
            const isExcluded = feature.startsWith('!');
            // Case insensitive check for "FREE"
            const isFree = feature.toUpperCase().includes('FREE');
            
            if (!isExcluded && isFree) {
              featuredFreeFeatures.push(feature);
            } else {
              standardFeatures.push(feature);
            }
          });
          
          // Standard features are still sorted to keep excluded items at bottom
          standardFeatures.sort((a, b) => {
            const aExcluded = a.startsWith('!');
            const bExcluded = b.startsWith('!');
            if (aExcluded && !bExcluded) return 1;
            if (!aExcluded && bExcluded) return -1;
            return 0;
          });

          // Determine if we show the "Yard+ Included" badge
          const isPristinePlus = plan.key === 'twiceWeekly';
          const canToggleYardPlus = plan.key === 'biWeekly' || plan.key === 'weekly';
          const isYardPlusChecked = !!yardPlusSelections[plan.key];

          return (
            <div key={plan.key} className={`relative p-6 border-2 rounded-xl transition-all ${plan.popular ? 'border-[var(--brand-green)] shadow-lg best-value-glow' : 'border-gray-300'}`}>
              {plan.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[11px] font-bold text-white bg-[var(--brand-green)] px-3 py-0.5 rounded-full">
                  Best Value
                </span>
              )}
              <h3 className="text-2xl font-bold text-slate-800 text-center">{plan.name}</h3>
              <div className="text-center my-4 py-4 border-y border-gray-200">
                <span className="text-5xl font-extrabold text-slate-900">${plan.finalPrice}</span>
                <span className="text-xl font-medium text-slate-600">/mo</span>
              </div>
              
              {/* --- FEATURED FREE ITEMS (BADGES) --- */}
              {/* 1. Static Yard+ Badge (Only for Pristine-Plus) */}
              {isPristinePlus && (
                 <div className="mb-2 bg-green-100 text-green-800 text-xs font-bold px-2 py-2 rounded text-center border border-green-200 shadow-sm">
                   <span className="block">Yard+ Coverage Included FREE!</span>
                 </div>
              )}
              
              {/* 2. Dynamic Yard+ Badge (When Toggled ON) */}
              {isYardPlusChecked && (
                 <div className="mb-2 bg-blue-100 text-blue-800 text-xs font-bold px-2 py-2 rounded text-center border border-blue-200 shadow-sm">
                   <span className="block">Includes Yard+ Coverage (+$20)</span>
                 </div>
              )}

              {/* 3. Configured Free Items (Treats, Deodorizer, etc.) */}
              {featuredFreeFeatures.map((feature, idx) => {
                // Extract subtext if it exists: "FREE Deodorizer (1x/Week - a $40 Value!)"
                let featureText = feature;
                let featureSubtext = '';
                if (feature.includes('(') && feature.endsWith(')')) {
                  const parts = feature.split('(');
                  featureText = parts[0].trim();
                  featureSubtext = `(${parts[1]}`;
                }

                return (
                  <div key={idx} className="mb-2 bg-green-100 text-green-800 text-xs font-bold px-2 py-2 rounded text-center border border-green-200 shadow-sm">
                     <div className="flex items-center justify-center">
                        <span>{featureText} Included FREE!</span>
                        {/* Info button for Deodorizer/WYSIwash */}
                        {(feature.includes('Deodorizer') || feature.includes('WYSIwash')) && (
                        <button onClick={onInfoClick} className="ml-2 text-green-600 hover:text-green-800">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
                        </button>
                        )}
                     </div>
                     {featureSubtext && <span className="block font-normal text-green-700 mt-0.5">{featureSubtext}</span>}
                  </div>
                )
              })}
              
              <ul className="space-y-3 my-6 text-left max-w-xs mx-auto">
                {/* 1. Dog Household */}
                <li className="flex items-start text-slate-600">
                  <svg className="w-5 h-5 text-green-500 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <div className="flex-grow">
                    <span>Service for {dogText} Household</span>
                  </div>
                </li>
                
                {/* 2. Frequency */}
                <li className="flex items-start text-slate-600">
                  <svg className="w-5 h-5 text-green-500 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <div className="flex-grow">
                    <span>{plan.frequency}</span>
                  </div>
                </li>

                {/* 3. The rest of the features (Standard & Excluded) */}
                {standardFeatures.map((feature, index) => {
                  const isIncluded = !feature.startsWith('!');
                  let featureText = isIncluded ? feature : feature.substring(1);
                  let featureSubtext = '';

                  if (featureText.includes('(') && featureText.endsWith(')')) {
                    const parts = featureText.split('(');
                    featureText = parts[0].trim(); 
                    featureSubtext = `(${parts[1]}`;
                  }
                  
                  return (
                    <li key={index} className={`flex items-start ${isIncluded ? 'text-slate-600' : 'text-slate-400 line-through'}`}>
                      {isIncluded ? (
                        <svg className="w-5 h-5 text-green-500 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      ) : (
                        <svg className="w-5 h-5 text-red-500 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )}
                      
                      <div className="flex-grow">
                        <span>{featureText}</span>
                        {featureSubtext && (
                          <span className="block text-xs text-slate-500 -mt-1">
                            {featureSubtext}
                          </span>
                        )}
                      </div>
                      
                      {/* Info button for Alerts (check original feature string) */}
                      {(feature.includes('Automated Reminders')) && isIncluded && (
                        <button onClick={onAlertsInfoClick} className="ml-2 text-gray-400 hover:text-gray-600 transition-transform hover:scale-125 flex-shrink-0">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
              
              {/* --- Yard+ Toggle Inside Card --- */}
              {canToggleYardPlus && (
                <div className="mb-6 pt-4 border-t border-gray-100">
                  <label className="flex items-center justify-between cursor-pointer select-none">
                    <div className="mr-3">
                      <span className="block text-sm font-bold text-gray-800">Add "Yard+ Coverage"</span>
                      <span className="block text-xs text-gray-500">Full Front/Side Yards (+$20)</span>
                    </div>
                    <div className="relative">
                      <input 
                        type="checkbox" 
                        className="sr-only peer"
                        checked={isYardPlusChecked}
                        onChange={() => handleToggle(plan.key)}
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--brand-blue)]"></div>
                    </div>
                  </label>
                </div>
              )}
              
              <button
                onClick={() => onPlanSelect(plan.name, plan.finalPrice, plan.key)}
                className="w-full bg-[var(--brand-green)] text-white font-bold text-lg py-4 rounded-lg hover:bg-opacity-90 transition-all duration-200 transform hover:-translate-y-0.5 shadow-lg hover:shadow-xl"
              >
                Select {plan.name}
              </button>
            </div>
          )
        })}
      </div>
      
      <button
        onClick={onOneTimeClick}
        className="w-full text-center text-sm text-gray-600 hover:text-blue-600 hover:underline transition-colors mt-8"
      >
        {text.oneTimeLink}
      </button>
    </div>
  );
};

/**
 * VIEW 4: The "Cash Multiplier"
 */
const PaymentPlanSelector = ({ packageSelection, onPaymentSelect, onBack, text }) => {
  
  const monthly = packageSelection.finalMonthlyPrice;
  
  const plans = [
    {
      term: 'Monthly',
      priceLabel: `$${monthly}/month`,
      total: monthly,
      savings: null,
      savingsValue: 0,
    },
    {
      term: 'Quarterly',
      priceLabel: `$${(monthly * 3) - 30} / 3 Months`,
      total: (monthly * 3) - 30,
      savings: 'You save $30!',
      savingsValue: 30,
    },
    {
      term: 'Annual',
      priceLabel: `$${monthly * 11} / Year`,
      total: monthly * 11,
      savings: `You save $${monthly} - 1 Month FREE!`,
      savingsValue: monthly,
      popular: true,
    }
  ];

  return (
    <div className="bg-white p-6 md:p-8 rounded-xl shadow-lg fade-in">
      <button onClick={onBack} className="text-sm text-gray-600 hover:text-blue-600 hover:underline mb-4">&larr; Back to Plans</button>
      <h2 className="text-2xl font-bold text-slate-800 text-center mb-6">{text.title}</h2>
      <p className="text-center text-slate-600 mb-6 -mt-4">You've selected the <strong>{packageSelection.name}</strong> plan.</p>
      
      <div className="space-y-4">
        {plans.map((plan) => (
          <button
            key={plan.term}
            onClick={() => onPaymentSelect(plan.term, plan.total, plan.savings, plan.savingsValue)}
            className={`relative w-full text-left p-6 border-2 bg-white rounded-xl transition-all hover:-translate-y-1 hover:border-blue-400 hover:shadow-lg ${plan.popular ? 'border-[var(--brand-green)] shadow-lg best-value-glow' : 'border-gray-300'}`}
          >
            {plan.popular && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[11px] font-bold text-white bg-[var(--brand-green)] px-3 py-0.5 rounded-full">
                Best Value
              </span>
            )}
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-2xl font-bold text-slate-800">{plan.term} Plan</h3>
              {plan.savings && (
                <span className="text-sm font-bold text-white bg-[var(--brand-green)] px-3 py-1 rounded-full hidden sm:block">
                  {plan.savings}
                </span>
              )}
            </div>
            <p className="text-3xl font-extrabold text-slate-900">{plan.priceLabel}</p>
            {plan.savings && (
              <span className="text-sm font-bold text-[var(--brand-green)] mt-1 sm:hidden">
                {plan.savings}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};


/**
 * VIEW 5: The "Checkout"
 */
const CheckoutForm = ({ packageSelection, paymentSelection, zipCode, dogCount, planKey, onBack, onBailout, onSubmitSuccess, stripeInstance, cardElement, text, stripeMode, yardPlusSelected }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    terms: false,
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState('');

  // --- Calculate Order Summary ---
  const initialResetFee = 99.99;
  const termDiscount = paymentSelection.savingsValue || 0;
  const totalSavings = initialResetFee + termDiscount;
  const totalDueToday = paymentSelection.total;

  // --- Form Handlers ---
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.terms) {
      setError('You must agree to the Terms of Service.');
      return;
    }
    
    if (!stripeInstance || !cardElement) {
      // Stripe.js has not yet loaded.
      setError('Payment system is not ready. Please wait a moment and try again.');
      return;
    }

    setIsSubmitting(true);

    // --- 1. Create Stripe Payment Method ---
    const { error: stripeError, paymentMethod } = await stripeInstance.createPaymentMethod({
      type: 'card',
      card: cardElement,
      billing_details: {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        address: {
            line1: formData.address, // Stripe can use this for validation
            postal_code: zipCode,
        }
      },
    });

    if (stripeError) {
      setError(stripeError.message || 'An error occurred during payment validation.');
      setIsSubmitting(false);
      return;
    }

    // --- 2. Build ALL Data Payloads ---
    
    // Calculate per_visit for the email
    let perVisitPrice = 'N/A';
    if (planKey) {
      const visitsPerMonth = { biWeekly: 26/12, weekly: 52/12, twiceWeekly: 104/12 };
      perVisitPrice = (packageSelection.finalMonthlyPrice / visitsPerMonth[planKey]).toFixed(2);
    }
    
    const leadData = {
        ...formData,
        zip: zipCode,
        lead_status: 'Complete - PAID',
        quote_type: packageSelection.name,
        plan: packageSelection.name,
        dog_count: dogCount,
        total_monthly_rate: packageSelection.finalMonthlyPrice,
        payment_term: paymentSelection.term,
        final_charge_amount: totalDueToday,
        savings: paymentSelection.savings,
        yard_plus: yardPlusSelected ? 'Yes' : 'No', // Log this for GHL
        quote_link: generateQuoteLink({
            zip: zipCode,
            dogCount: dogCount,
            plan: packageSelection.name,
            paymentTerm: paymentSelection.term,
        }),
    };
    
    // --- Pre-build conditional HTML for EmailJS ---
    let term_discount_row_html = '';
    let term_savings_row_html = '';

    if (termDiscount > 0) {
      term_discount_row_html = `
        <div style="display: -webkit-box; display: -ms-flexbox; display: flex; -webkit-box-pack: justify; -ms-flex-pack: justify; justify-content: space-between; margin-bottom: 8px;">
          <span>${paymentSelection.term} Discount</span>
          <span style="text-decoration: line-through;">$${termDiscount.toFixed(2)}</span>
        </div>
      `;
      
      term_savings_row_html = `
        <div style="display: -webkit-box; display: -ms-flexbox; display: flex; -webkit-box-pack: justify; -ms-flex-pack: justify; justify-content: space-between; margin-bottom: 8px; color: #166534; font-weight: 500;">
          <span>${paymentSelection.term} Savings</span>
          <span><strong>-$${termDiscount.toFixed(2)}</strong></span>
        </div>
      `;
    }

    const emailParams = {
        ...leadData,
        description: `Plan: ${packageSelection.name} (${paymentSelection.term}) ${yardPlusSelected ? '+ Yard+ Coverage' : ''}`,
        total_monthly: `$${packageSelection.finalMonthlyPrice}/mo`,
        per_visit: `$${perVisitPrice}`,
        final_charge: totalDueToday.toFixed(2), // Use consistent var
        total_savings: totalSavings.toFixed(2),
        initial_savings: initialResetFee.toFixed(2),
        term_savings: termDiscount.toFixed(2),
        
        term_discount_row: term_discount_row_html,
        term_savings_row: term_savings_row_html
      };

    // --- 3. Send ALL Data to our backend ---
    try {
      // This is our *only* fetch call now
      const response = await fetch('/.netlify/functions/create-stripe-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stripeMode: stripeMode, // PASS THE MODE (live/test)
          paymentMethodId: paymentMethod.id,
          customer: {
            name: formData.name,
            email: formData.email,
            phone: formData.phone,
            address: formData.address,
          },
          quote: {
            zipCode: zipCode,
            dogCount: dogCount,
            planName: packageSelection.name, // e.g., "Pristine-Clean"
            planKey: planKey,                // e.g., "weekly"
            paymentTerm: paymentSelection.term, // e.g., "Quarterly"
            totalDueToday: totalDueToday,
            yardPlusSelected: yardPlusSelected, // PASS THE ADDON FLAG
          },
          leadData: leadData,     // For GHL
          emailParams: emailParams  // For EmailJS
        })
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.message || 'An error occurred on the server.');
      }

      if (responseData.status !== 'success') {
        throw new Error(responseData.message || 'Payment processing failed. Please check your card details and try again.');
      }
      
      // All successful!
      setIsSubmitting(false);
      setIsSubmitted(true);
      onSubmitSuccess();

    } catch (err) {
      console.error('Submission Error:', err);
      setError(err.message || 'An unknown error occurred.');
      setIsSubmitting(false);
    }
  };
  
  // --- Thank You View ---
  if (isSubmitted) {
    return (
      <div className="bg-white p-8 rounded-xl shadow-lg text-center fade-in">
        <div className="w-16 h-16 bg-green-100 text-green-600 flex items-center justify-center rounded-full mx-auto mb-4">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
        </div>
        <h2 className="text-2xl font-bold text-slate-800">Success! Welcome Aboard!</h2>
        <p className="text-slate-600 mt-2">
          Your payment was successful! We've sent a confirmation email to {formData.email}. We will contact you shortly to schedule your first visit!
        </p>
      </div>
    );
  }
  
  // --- Main Checkout Form View ---
  
  // Create dynamic "what happens next" text
  const termMap = {
    'Monthly': 'month',
    'Quarterly': '3 months',
    'Annual': '12 months'
  };
  const termText = termMap[paymentSelection.term] || 'term';
  const whatHappensNextBody = text.whatHappensNextBody.replace('{term}', termText);
  
  return (
    <div className="bg-white p-6 md:p-8 rounded-xl shadow-lg fade-in">
      <button onClick={onBack} className="text-sm text-gray-600 hover:text-blue-600 hover:underline mb-4">&larr; Back to Payment Plan</button>
      <h2 className="text-2xl font-bold text-slate-800 text-center mb-6">{text.title}</h2>
      
      {/* --- UI COMPONENT 1: The Order Summary --- */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-6">
        <h3 className="text-lg font-bold text-slate-800 mb-2 text-center">Your Order Summary</h3>
        <p className="text-center text-green-600 font-semibold text-lg mb-4">You're saving ${totalSavings.toFixed(2)}+ today!</p>
        
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-600">{packageSelection.name} ({paymentSelection.term} Plan)</span>
            <span className="font-medium text-slate-900">${paymentSelection.total.toFixed(2)}</span>
          </div>
          
          {yardPlusSelected && (
             <div className="flex justify-between">
               <span className="text-slate-600 italic">+ Yard+ Coverage Add-on</span>
               <span className="text-slate-500 text-xs">(Included in total)</span>
             </div>
          )}
          
          <div className="flex justify-between">
            <span className="text-slate-600">One-Time Initial Yard Reset</span>
            <span className="font-medium text-slate-900 line-through">$99.99+</span>
          </div>
          
          {termDiscount > 0 && (
            <div className="flex justify-between">
              <span className="text-slate-600">{paymentSelection.term} Discount</span>
              <span className="font-medium text-slate-900 line-through">${termDiscount.toFixed(2)}</span>
            </div>
          )}
          
          <div className="flex justify-between text-green-600">
            <span className="font-semibold">Your "Free First Clean" Bonus</span>
            <span className="font-semibold">-$99.99+</span>
          </div>
          
            {termDiscount > 0 && (
            <div className="flex justify-between text-green-600">
              <span className="font-semibold">{paymentSelection.term} Savings</span>
              <span className="font-semibold">-${termDiscount.toFixed(2)}</span>
            </div>
          )}
          
          <div className="border-t border-slate-300 pt-2 mt-2 flex justify-between text-xl">
            <span className="font-bold text-slate-900">Total Due Today:</span>
            <span className="font-extrabold text-slate-900">${totalDueToday.toFixed(2)}</span>
          </div>
        </div>
      </div>
      
      {/* --- UI COMPONENT 2: The Clarification Text --- */}
      <div className="bg-blue-50 border-l-4 border-blue-500 text-blue-900 p-4 rounded-r-lg mb-6">
        <p className="font-bold">{text.whatHappensNextTitle}</p>
        <p className="text-sm" dangerouslySetInnerHTML={{ __html: whatHappensNextBody }} />
      </div>

      <form onSubmit={handleSubmit}>
        {/* --- UI COMPONENT 3: The Form --- */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-slate-800">Enter Your Details & Payment</h3>
          <input type="text" name="name" placeholder="Full Name*" required className="w-full p-3 border-2 border-gray-300 rounded-lg" onChange={handleChange} value={formData.name} />
          <input type="email" name="email" placeholder="Email Address*" required className="w-full p-3 border-2 border-gray-300 rounded-lg" onChange={handleChange} value={formData.email} />
          <input type="tel" name="phone" placeholder="Phone Number*" required className="w-full p-3 border-2 border-gray-300 rounded-lg" onChange={handleChange} value={formData.phone} />
          <input type="text" name="address" placeholder="Service Address*" required className="w-full p-3 border-2 border-gray-300 rounded-lg" onChange={handleChange} value={formData.address} />
          
          {/* --- Stripe Payment Module --- */}
          <div className="p-3 border-2 border-gray-300 rounded-lg">
              {/* This div is the mount point for the Stripe CardElement */}
            <div id="card-element"></div>
          </div>

          <div className="pt-2">
            <label className="flex items-start text-xs text-gray-500 cursor-pointer" htmlFor="terms-consent-checkout">
              <input type="checkbox" id="terms-consent-checkout" name="terms" checked={formData.terms} onChange={handleChange} className="mt-0.5 mr-3 h-5 w-5 rounded border-gray-300 text-[var(--brand-blue)] focus:ring-[var(--brand-blue)] flex-shrink-0" />
              <div>
                <span className="text-red-500 font-bold">*</span> I agree to the <a href="https://itspurgepros.com/terms-conditions" target="_blank" rel="noopener noreferrer" className="text-[var(--brand-blue)] font-semibold underline">Terms of Service</a> & <a href="https://itspurgepros.com/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-[var(--brand-blue)] font-semibold underline">Privacy Policy</a>. I also agree to receive calls and texts for marketing and service communication. Msg & data rates may apply. Reply STOP to opt out.
              </div>
            </label>
          </div>

          {/* --- Error Display --- */}
          {error && (
            <p className="text-red-600 text-sm font-medium text-center p-3 bg-red-50 rounded-lg">{error}</p>
          )}

          {/* --- Submit Button --- */}
          <div className="border-t pt-6">
            <button
              type="submit"
              disabled={isSubmitting || !stripeInstance}
              className="w-full bg-[var(--brand-green)] text-white font-bold text-lg py-4 rounded-lg hover:bg-opacity-90 transition-all duration-200 transform hover:-translate-y-0.5 shadow-lg hover:shadow-xl flex items-center justify-center h-14"
            >
              {isSubmitting ? <span className="loader"></span> : `Pay $${totalDueToday.toFixed(2)} & Start Service`}
            </button>
          </div>
        </div>
      </form>

      {/* --- The "Bailout" Link --- */}
      <div className="text-center mt-6">
        <button
          onClick={onBailout}
          className="text-sm text-gray-600 hover:text-blue-600 hover:underline"
        >
          {text.bailoutLink}
        </button>
      </div>
    </div>
  );
};


/**
 * VIEW 3A / One-Time: The Lead Form (Custom Quote & One-Time)
 */
const LeadForm = ({ title, description, onBack, onSubmitSuccess, zipCode, dogCount, text }) => {
  // ... (Same as before)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    notes: '',
    terms: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.terms) {
      setError('You must agree to the Terms of Service.');
      return;
    }

    setIsSubmitting(true);

    let leadData, emailParams, quoteLinkState;
    
    quoteLinkState = { zip: zipCode, dogCount: dogCount };
    
    let leadStatus, quoteType, planName;
    
    leadStatus = dogCount === '6+' ? 'Custom - Multi-Pet' : 'Custom - Estate';
    quoteType = 'Custom Quote Request';
    planName = 'Custom Quote';

    leadData = {
      ...formData,
      zip: zipCode,
      lead_status: leadStatus,
      quote_type: quoteType,
      plan: planName,
      dog_count: dogCount,
      quote_link: generateQuoteLink(quoteLinkState),
    };
    
    emailParams = {
      ...formData,
      ...leadData,
      description: title,
      total_monthly: 'Custom Quote',
      per_visit: 'N/A',
      final_charge: 'N/A',
      savings: 'N/A',
    };
    
    // --- Send to our backend ---
    try {
      const response = await fetch('/.netlify/functions/create-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadData: leadData,
          emailParams: emailParams,
          leadType: 'customQuote' // Differentiates from exitIntent
        })
      });

      if (!response.ok) {
        throw new Error('Server error, please try again.');
      }

      setIsSubmitting(false);
      setIsSubmitted(true);
      if (onSubmitSuccess) {
        onSubmitSuccess();
      }

    } catch (err) {
      console.error('Submission Error:', err);
      setError(err.message || 'An unknown error occurred.');
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="bg-white p-8 rounded-xl shadow-lg text-center fade-in">
        <div className="w-16 h-16 bg-green-100 text-green-600 flex items-center justify-center rounded-full mx-auto mb-4">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
        </div>
        <h2 className="text-2xl font-bold text-slate-800">Thank You!</h2>
        <p className="text-slate-600 mt-2">
          We've received your request and will contact you shortly to provide your free custom quote.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white p-8 rounded-xl shadow-lg fade-in">
      <h2 className="text-2xl font-bold text-slate-800 text-center">{title}</h2>
      <p className="text-slate-600 mt-2 text-center mb-6">{description}</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="text"
          name="name"
          placeholder="Full Name*"
          required
          className="w-full p-3 border-2 border-gray-300 rounded-lg"
          onChange={handleChange}
        />
        <input
          type="email"
          name="email"
          placeholder="Email Address*"
          required
          className="w-full p-3 border-2 border-gray-300 rounded-lg"
          onChange={handleChange}
        />
        <input
          type="tel"
          name="phone"
          placeholder="Phone Number*"
          required
          className="w-full p-3 border-2 border-gray-300 rounded-lg"
          onChange={handleChange}
        />
        <input
          type="text"
          name="address"
          placeholder="Service Address*"
          required
          className="w-full p-3 border-2 border-gray-300 rounded-lg"
          onChange={handleChange}
        />
        <textarea
          name="notes"
          placeholder="Additional Notes (optional)"
          rows="2"
          className="w-full p-3 border-2 border-gray-300 rounded-lg"
          onChange={handleChange}
        />
        <div className="pt-2">
          <label className="flex items-start text-xs text-gray-500 cursor-pointer" htmlFor="terms-consent">
            <input
              type="checkbox"
              id="terms-consent"
              name="terms"
              checked={formData.terms}
              onChange={handleChange}
              className="mt-0.5 mr-3 h-5 w-5 rounded border-gray-300 text-[var(--brand-blue)] focus:ring-[var(--brand-blue)] flex-shrink-0"
            />
            <div>
              <span className="text-red-500 font-bold">*</span> I agree to the <a href="https://itspurgepros.com/terms-conditions" target="_blank" rel="noopener noreferrer" className="text-[var(--brand-blue)] font-semibold underline">Terms of Service</a> & <a href="https://itspurgepros.com/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-[var(--brand-blue)] font-semibold underline">Privacy Policy</a>. I also agree to receive calls and texts for marketing and service communication. Msg & data rates may apply. Reply STOP to opt out.
            </div>
          </label>
        </div>
        {error && (
          <p className="text-red-600 text-sm font-medium text-center">{error}</p>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-[var(--brand-green)] text-white font-bold text-lg py-4 rounded-lg hover:bg-opacity-90 transition-all duration-200 transform hover:-translate-y-0.5 shadow-lg hover:shadow-xl flex items-center justify-center h-14"
        >
          {isSubmitting ? <span className="loader"></span> : 'Request My Quote'}
        </button>
      </form>
      <button
        onClick={onBack}
        className="w-full text-center text-sm text-gray-600 hover:text-blue-600 hover:underline transition-colors mt-6"
        dangerouslySetInnerHTML={{ __html: text.backLink }}
      />
    </div>
  );
};

// --- NEW: VIEW 5B: One-Time Cleanup Checkout Form ---
const OneTimeCheckoutForm = ({ zipCode, dogCount, onBack, onSubmitSuccess, stripeInstance, cardElement, text, stripeMode }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    terms: false,
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState('');

  const depositAmount = 99.99;

  // --- Form Handlers ---
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.terms) {
      setError('You must agree to the Terms of Service.');
      return;
    }
    
    if (!stripeInstance || !cardElement) {
      setError('Payment system is not ready. Please wait a moment and try again.');
      return;
    }

    setIsSubmitting(true);

    // --- 1. Create Stripe Payment Method ---
    const { error: stripeError, paymentMethod } = await stripeInstance.createPaymentMethod({
      type: 'card',
      card: cardElement,
      billing_details: {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        address: {
            line1: formData.address,
            postal_code: zipCode,
        }
      },
    });

    if (stripeError) {
      setError(stripeError.message || 'An error occurred during payment validation.');
      setIsSubmitting(false);
      return;
    }

    // --- 2. Build ALL Data Payloads ---
    
    const leadData = {
        ...formData,
        zip: zipCode,
        lead_status: 'Complete - PAID (One-Time)',
        quote_type: 'One-Time Yard Reset',
        plan: 'One-Time Yard Reset',
        dog_count: dogCount,
        total_monthly_rate: 'N/A',
        payment_term: 'One-Time Deposit',
        final_charge_amount: depositAmount,
        savings: 'N/A',
        quote_link: '', // No quote link for one-time
    };
    
    const emailParams = {
        ...leadData,
        description: `One-Time Yard Reset (Deposit Paid)`,
        total_monthly: 'N/A',
        per_visit: 'N/A',
        final_charge: `$${depositAmount.toFixed(2)} (Deposit)`,
    };

    // --- 3. Send ALL Data ---
    try {
      const response = await fetch('/.netlify/functions/create-stripe-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stripeMode: stripeMode, // PASS THE MODE
          paymentMethodId: paymentMethod.id,
          customer: {
            name: formData.name,
            email: formData.email,
            phone: formData.phone,
            address: formData.address,
          },
          quote: {
            zipCode: zipCode,
            dogCount: dogCount,
            planName: 'One-Time Yard Reset',
            planKey: 'oneTime', // This is the new flag
            paymentTerm: 'One-Time Deposit',
            totalDueToday: depositAmount,
          },
          leadData: leadData,
          emailParams: emailParams
        })
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.message || 'An error occurred on the server.');
      }

      if (responseData.status !== 'success') {
        throw new Error(responseData.message || 'Payment processing failed. Please check your card details and try again.');
      }
      
      // All successful!
      setIsSubmitting(false);
      setIsSubmitted(true);
      onSubmitSuccess();

    } catch (err) {
      console.error('Submission Error:', err);
      setError(err.message || 'An unknown error occurred.');
      setIsSubmitting(false);
    }
  };
  
  // --- Thank You View ---
  if (isSubmitted) {
    return (
      <div className="bg-white p-8 rounded-xl shadow-lg text-center fade-in">
        <div className="w-16 h-16 bg-green-100 text-green-600 flex items-center justify-center rounded-full mx-auto mb-4">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
        </div>
        <h2 className="text-2xl font-bold text-slate-800">Deposit Paid!</h2>
        <p className="text-slate-600 mt-2">
          Your deposit was successful! We've sent a confirmation email to {formData.email}. We will contact you shortly to get your cleanup scheduled!
        </p>
      </div>
    );
  }
  
  // --- Main Checkout Form View ---
  return (
    <div className="bg-white p-6 md:p-8 rounded-xl shadow-lg fade-in">
      <button onClick={onBack} className="text-sm text-gray-600 hover:text-blue-600 hover:underline mb-4">&larr; Back to Options</button>
      <h2 className="text-2xl font-bold text-slate-800 text-center mb-6">{text.title}</h2>
      
      {/* --- Order Summary --- */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-6">
        <h3 className="text-lg font-bold text-slate-800 mb-2 text-center">Your Order Summary</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-600">One-Time Yard Reset</span>
            <span className="font-medium text-slate-900">$99.99</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span className="text-slate-600">(Covers first 30 minutes)</span>
          </div>
          <div className="border-t border-slate-300 pt-2 mt-2 flex justify-between text-xl">
            <span className="font-bold text-slate-900">Total Deposit Due Today:</span>
            <span className="font-extrabold text-slate-900">${depositAmount.toFixed(2)}</span>
          </div>
        </div>
      </div>
      
      {/* --- Clarification Text --- */}
      <div className="bg-blue-50 border-l-4 border-blue-500 text-blue-900 p-4 rounded-r-lg mb-6">
        <p className="font-bold">{text.whatHappensNextTitle}</p>
        <p className="text-sm" dangerouslySetInnerHTML={{ __html: text.whatHappensNextBody }} />
      </div>

      <form onSubmit={handleSubmit}>
        {/* --- The Form --- */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-slate-800">Enter Your Details & Payment</h3>
          <input type="text" name="name" placeholder="Full Name*" required className="w-full p-3 border-2 border-gray-300 rounded-lg" onChange={handleChange} value={formData.name} />
          <input type="email" name="email" placeholder="Email Address*" required className="w-full p-3 border-2 border-gray-300 rounded-lg" onChange={handleChange} value={formData.email} />
          <input type="tel" name="phone" placeholder="Phone Number*" required className="w-full p-3 border-2 border-gray-300 rounded-lg" onChange={handleChange} value={formData.phone} />
          <input type="text" name="address" placeholder="Service Address*" required className="w-full p-3 border-2 border-gray-300 rounded-lg" onChange={handleChange} value={formData.address} />
          
          {/* --- Stripe Payment Module --- */}
          <div className="p-3 border-2 border-gray-300 rounded-lg">
              {/* This div is the mount point for the Stripe CardElement */}
            <div id="card-element"></div>
          </div>

          <div className="pt-2">
            <label className="flex items-start text-xs text-gray-500 cursor-pointer" htmlFor="terms-consent-onetime">
              <input type="checkbox" id="terms-consent-onetime" name="terms" checked={formData.terms} onChange={handleChange} className="mt-0.5 mr-3 h-5 w-5 rounded border-gray-300 text-[var(--brand-blue)] focus:ring-[var(--brand-blue)] flex-shrink-0" />
              <div>
                <span className="text-red-500 font-bold">*</span> I agree to the <a href="https://itspurgepros.com/terms-conditions" target="_blank" rel="noopener noreferrer" className="text-[var(--brand-blue)] font-semibold underline">Terms of Service</a> & <a href="https://itspurgepros.com/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-[var(--brand-blue)] font-semibold underline">Privacy Policy</a>. I also agree to receive calls and texts for marketing and service communication. Msg & data rates may apply. Reply STOP to opt out.
              </div>
            </label>
          </div>

          {/* --- Error Display --- */}
          {error && (
            <p className="text-red-600 text-sm font-medium text-center p-3 bg-red-50 rounded-lg">{error}</p>
          )}

          {/* --- Submit Button --- */}
          <div className="border-t pt-6">
            <button
              type="submit"
              disabled={isSubmitting || !stripeInstance}
              className="w-full bg-[var(--brand-blue)] text-white font-bold text-lg py-4 rounded-lg hover:bg-opacity-90 transition-all duration-200 transform hover:-translate-y-0.5 shadow-lg hover:shadow-xl flex items-center justify-center h-14"
            >
              {isSubmitting ? <span className="loader"></span> : `Pay $${depositAmount.toFixed(2)} Deposit`}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};


const ServiceInfoModal = ({ onClose, text }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
    <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
      <h3 className="text-lg font-bold text-gray-900">{text.title}</h3>
      {text.body.map((p, i) => (
        <p key={i} className="text-sm text-gray-600 mt-4" dangerouslySetInnerHTML={{ __html: p }} />
      ))}
      <button
        onClick={onClose}
        className="w-full mt-6 bg-gray-200 text-gray-800 font-semibold py-2 px-4 rounded-lg hover:bg-gray-300"
      >
        Got it!
      </button>
    </div>
  </div>
);

// --- NEW: Alerts Info Modal ---
const AlertsInfoModal = ({ onClose, text }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
    <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
      <h3 className="text-lg font-bold text-gray-900">{text.title}</h3>
      <p className="text-sm text-gray-600 mt-4">{text.body}</p>
      <ul className="text-sm text-gray-600 mt-2 list-disc list-inside space-y-1">
        {text.bullets.map((item, i) => (
          <li key={i} dangerouslySetInnerHTML={{ __html: item }} />
        ))}
      </ul>
      <button
        onClick={onClose}
        className="w-full mt-6 bg-gray-200 text-gray-800 font-semibold py-2 px-4 rounded-lg hover:bg-gray-300"
      >
        Got it!
      </button>
    </div>
  </div>
);

// --- NEW: Satisfaction Modal ---
const SatisfactionModal = ({ onClose, text }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
    <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 text-center" onClick={(e) => e.stopPropagation()}>
      <div className="w-16 h-16 bg-green-100 text-green-600 flex items-center justify-center rounded-full mx-auto mb-4">
        <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
           <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
      </div>
      <h3 className="text-xl font-bold text-gray-900">{text.title}</h3>
      <p className="text-gray-600 mt-4">{text.body}</p>
      <p className="text-sm font-bold text-green-700 mt-4">{text.footer}</p>
      <button
        onClick={onClose}
        className="w-full mt-6 bg-[var(--brand-green)] text-white font-bold py-3 px-4 rounded-lg hover:bg-opacity-90"
      >
        Close
      </button>
    </div>
  </div>
);

// --- NEW: Package Review Modal ---
const PackageReviewModal = ({ onClose, planName, frequency, features, dogCount }) => {
  const dogText = dogCount === '1-2' ? 'up to 2 Dog' : `up to ${dogCount} Dog`;
  
  // Sort features: FREE items first, then standard, then excluded
  const sortedFeatures = [...features].sort((a, b) => {
    const aExcluded = a.startsWith('!');
    const bExcluded = b.startsWith('!');
    const aFree = a.toUpperCase().startsWith('FREE');
    const bFree = b.toUpperCase().startsWith('FREE');

    if (aExcluded && !bExcluded) return 1;  // a (excluded) goes to bottom
    if (!aExcluded && bExcluded) return -1; // b (excluded) goes to bottom
    if (aExcluded && bExcluded) return 0;   // both excluded, keep order

    // Neither is excluded
    if (aFree && !bFree) return -1; // a (free) goes first
    if (!aFree && bFree) return 1;  // b (free) goes first

    return 0; // both free or both not free, keep order
  });
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-gray-900">Plan Details: {planName}</h3>
        
        <ul className="space-y-3 mt-4 text-left">
          {/* 1. Dog Household */}
          <li className="flex items-start text-slate-600">
            <svg className="w-5 h-5 text-green-500 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <div className="flex-grow">
              <span>Service for {dogText} Household</span>
            </div>
          </li>
          
          {/* 2. Frequency */}
          <li className="flex items-start text-slate-600">
            <svg className="w-5 h-5 text-green-500 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <div className="flex-grow">
              <span>{frequency}</span>
            </div>
          </li>

          {/* 3. The rest of the features */}
          {sortedFeatures.map((feature, index) => {
            const isIncluded = !feature.startsWith('!');
            let featureText = isIncluded ? feature : feature.substring(1);
            let featureSubtext = '';

            // Check for the subtext
            if (featureText.includes('(') && featureText.endsWith(')')) {
              const parts = featureText.split('(');
              featureText = parts[0].trim(); // "FREE Deodorizer"
              featureSubtext = `(${parts[1]}`; // "(1x/Week - a $40 Value!)"
            }

            return (
              <li key={index} className={`flex items-start ${isIncluded ? 'text-slate-600' : 'text-slate-400 line-through'}`}>
                {isIncluded ? (
                  <svg className="w-5 h-5 text-green-500 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                ) : (
                    <svg className="w-5 h-5 text-red-500 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                )}
                
                <div className="flex-grow">
                  <span>{featureText}</span>
                  {featureSubtext && (
                    <span className="block text-xs text-slate-500 -mt-1">
                      {featureSubtext}
                    </span>
                  )}
                </div>
                
              </li>
            );
          })}
        </ul>
        
        <button
          onClick={onClose}
          className="w-full mt-6 bg-gray-200 text-gray-800 font-semibold py-2 px-4 rounded-lg hover:bg-gray-300"
        >
          Got it!
        </button>
      </div>
    </div>
  );
};


const PricingInfoModal = ({ onClose, text }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
    <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
      <h3 className="text-lg font-bold text-gray-900">{text.title}</h3>
      {text.body.map((p, i) => (
        <p key={i} className="text-sm text-gray-600 mt-4" dangerouslySetInnerHTML={{ __html: p }} />
      ))}
      <ul className="text-sm text-gray-600 mt-2 list-disc list-inside space-y-1">
        {text.bullets.map((item, i) => (
          <li key={i} dangerouslySetInnerHTML={{ __html: item }} />
        ))}
      </ul>
      <p className="text-sm text-gray-600 mt-2">{text.footer}</p>
      <button
        onClick={onClose}
        className="w-full mt-6 bg-gray-200 text-gray-800 font-semibold py-2 px-4 rounded-lg hover:bg-gray-300"
      >
        Got it!
      </button>
    </div>
  </div>
);

const ExitIntentModal = ({ onClose, currentPlan, zipCode, yardSize, planDetails, text }) => {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  
  // Calculate per_visit for the exit modal email
  let perVisitPrice = 'N/A';
  if (currentPlan && currentPlan.name) {
      const planKey = Object.keys(planDetails).find(key => planDetails[key].name === currentPlan.name);
      if (planKey) {
        // Find visitsPerMonth
        const visitsPerMonth = { biWeekly: 26/12, weekly: 52/12, twiceWeekly: 104/12 };
        perVisitPrice = (currentPlan.price / visitsPerMonth[planKey]).toFixed(2);
      }
  }


  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) return;
    setIsSubmitting(true);

    const quoteState = {
      zip: zipCode,
      yardSize: yardSize,
      dogCount: currentPlan.dogCount,
      plan: currentPlan.name,
    };
    const quote_link = generateQuoteLink(quoteState);

    const leadData = {
      email: email,
      zip: zipCode,
      lead_status: 'Exit Intent - Emailed Quote',
      quote_type: currentPlan.name,
      plan: currentPlan.name,
      total_monthly: currentPlan.price,
      dog_count: currentPlan.dogCount,
      notes: 'User captured on exit intent.',
      quote_link: quote_link,
    };

    // --- Send to our backend ---
    try {
      const response = await fetch('/.netlify/functions/create-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadData: leadData,
          emailParams: {
            email: email,
            name: 'Valued Customer',
            plan: currentPlan.name,
            total_monthly: `$${currentPlan.price}/mo`,
            dog_count: currentPlan.dogCount,
            description: 'Here is the custom quote you built on our site. We hope to see you soon!',
            notes: 'User captured on exit intent.',
            quote_link: quote_link,
            per_visit: `$${perVisitPrice}`,
            final_charge: 'N/A',
            savings: 'N/A',
          },
          leadType: 'exitIntent' // Differentiates from customQuote
        })
      });

      if (!response.ok) {
        throw new Error('Server error, please try again.');
      }
      
      setIsSubmitting(false);
      setIsSubmitted(true);
      setTimeout(onClose, 2500);

    } catch (err) {
      console.error('Submission Error:', err);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-8" onClick={(e) => e.stopPropagation()}>
        {isSubmitted ? (
          <div className="text-center fade-in">
            <div className="w-16 h-16 bg-green-100 text-green-600 flex items-center justify-center rounded-full mx-auto mb-4">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            </div>
            <h2 className="text-2xl font-bold text-slate-800">Quote Sent!</h2>
            <p className="text-slate-600 mt-2">We've sent your custom quote to {email}. Check your inbox!</p>
          </div>
        ) : (
          <>
            <h3 className="text-2xl font-bold text-gray-900 text-center">{text.title}</h3>
            <p className="text-sm text-gray-600 mt-4 text-center" dangerouslySetInnerHTML={{ __html: text.body }} />
            <form onSubmit={handleSubmit} className="space-y-4 mt-6">
              <input
                type="email"
                name="email"
                placeholder="Email Address"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-3 border-2 border-gray-300 rounded-lg"
              />
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-[var(--brand-green)] text-white font-bold text-lg py-4 rounded-lg hover:bg-opacity-90 transition-all duration-200 transform hover:-translate-y-0.5 shadow-lg hover:shadow-xl flex items-center justify-center h-14"
              >
                {isSubmitting ? <span className="loader"></span> : 'Email My Quote'}
              </button>
            </form>
            <button
              onClick={onClose}
              className="w-full mt-4 text-gray-500 text-sm font-medium text-center hover:text-gray-800"
            >
              No Thanks
            </button>
          </>
        )}
      </div>
    </div>
  );
};


const Header = ({ onSatisfactionClick }) => (
  <header className="py-6 text-center">
    <div className="container mx-auto px-4 flex flex-col items-center justify-center">
      <a href="https://itspurgepros.com/" className="transition-all hover:opacity-80 hover:scale-105 mb-4">
        <img src="https://storage.googleapis.com/msgsndr/YzqccfNpAoMTt4EZO92d/media/68140f6288b94e80fb043618.png" alt="Purge Pros Logo" className="h-32 md:h-40" />
      </a>
      {/* Satisfaction Badge */}
      <button 
        onClick={onSatisfactionClick}
        className="flex items-center justify-center space-x-2 bg-white border border-gray-200 rounded-full px-4 py-1.5 shadow-sm hover:shadow-md transition-all cursor-pointer group"
      >
        <svg className="w-5 h-5 text-[var(--brand-green)]" fill="currentColor" viewBox="0 0 20 20">
           <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
        <span className="text-sm font-bold text-gray-700 group-hover:text-[var(--brand-blue)]">100% Satisfaction Guaranteed</span>
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
      </button>
    </div>
  </header>
);

const Footer = ({ text }) => {

  useEffect(() => {
    const yearElement = document.getElementById('copyright-year');
    if (yearElement) {
      yearElement.textContent = new Date().getFullYear();
    }
  }, []); 

  return (
    <footer className="bg-[#1C1C1C] text-white mt-16">
      <div className="container mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-1">
            <img src="https://images.leadconnectorhq.com/image/f_webp/q_80/r_1200/u_https://assets.cdn.filesafe.space/YzqccfNpAoMTt4EZO92d/media/68159457ca200095a430049d.png" alt="Purge Pros Logo" className="h-14 mb-4" />
            <p className="text-gray-400 text-sm">Your Neighbors' Choice for Dog Waste Removal in Central Indiana.</p>
          </div>
          <div>
            <h3 className="text-lg font-bold mb-4">Links</h3>
            <ul className="space-y-2 text-gray-400">
              <li><a href="https://itspurgepros.com/" className="hover:text-white hover:underline">Home</a></li>
              <li><a href="https://itspurgepros.com/about" className="hover:text-white hover:underline">About Us</a></li>
              <li><a href="https://itspurgepros.com/services" className="hover:text-white hover:underline">Services</a></li>
            </ul>
          </div>
          <div>
            <h3 className="text-lg font-bold mb-4 invisible">.</h3>
            <ul className="space-y-2 text-gray-400">
              <li><a href="https://share.google/uRiDZSanR8YaFknWM" className="hover:text-white hover:underline">Testimonials</a></li>
              <li><a href="https://itspurgepros.com/terms-conditions" className="hover:text-white hover:underline">Terms & Conditions</a></li>
              <li><a href="https://itspurgepros.com/privacy-policy" className="hover:text-white hover:underline">Privacy Policy</a></li>
            </ul>
          </div>
          <div>
            <h3 className="text-lg font-bold mb-4">Locations</h3>
            <ul className="space-y-2 text-gray-400">
              <li>{text.address}</li>
              <li><a href={`tel:${text.phone1}`} className="hover:text-white hover:underline">{text.phone1}</a></li>
              <li><a href={`tel:${text.phone2}`} className="hover:text-white hover:underline">{text.phone2}</a></li>
              <li><a href={`mailto:${text.email}`} className="hover:text-white hover:underline">{text.email}</a></li>
            </ul>
          </div>
        </div>
        <div className="mt-8 border-t border-gray-700 pt-6 text-center text-gray-500 text-sm">
          &copy; <span id="copyright-year" style={{ cursor: 'auto' }}></span> Purge Pros. All Rights Reserved.
        </div>
      </div>
    </footer>
  );
};

const GlobalStyles = () => (
  <style dangerouslySetInnerHTML={{ __html: `
    body {
      font-family: 'Inter', sans-serif;
      background-color: #f8fafc;
      background-image: url('https://storage.googleapis.com/msgsndr/YzqccfNpAoMTt4EZO92d/media/68e43822ccdd18bea416654b.png');
      background-repeat: repeat;
    }
    :root {
      --brand-blue: #00A9E0;
      --brand-green: #22c55e;
    }
    @keyframes fadeIn { 0% { opacity: 0; transform: translateY(20px); } 100% { opacity: 1; transform: translateY(0); } }
    .fade-in { animation: fadeIn 0.5s ease-out forwards; }
    
    .loader {
      width: 24px; height: 24px; border: 3px solid rgba(0,0,0,0.2);
      border-top-color: var(--brand-blue); border-radius: 50%;
      animation: rotation 0.8s linear infinite;
    }
    @keyframes rotation { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    
    /* NEW: Stripe Card Element Styling */
    #card-element {
      padding: 10px 0;
    }
    .StripeElement {
      box-sizing: border-box;
      height: 40px;
      padding: 10px 12px;
      border-radius: 8px;
      background-color: white;
      box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
    }
    .StripeElement--focus {
      border-color: #3182ce;
      box-shadow: 0 0 0 3px rgba(66,153,225,0.5);
    }
    .StripeElement--invalid {
      border-color: #fa755a;
    }
    .StripeElement--webkit-autofill {
      background-color: #fefde5 !important;
    }
    
    /* NEW: Glow Effects */
    @keyframes pulse-green {
      0%, 100% { box-shadow: 0 0 12px rgba(34, 197, 94, 0.7); border-color: rgba(34, 197, 94, 1); }
      50% { box-shadow: 0 0 20px rgba(34, 197, 94, 1); border-color: rgba(34, 197, 94, 1); }
    }
    @keyframes pulse-shadow {
      0%, 100% { box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06), 0 0 10px rgba(34, 197, 94, 0.5); }
      50% { box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05), 0 0 20px rgba(34, 197, 94, 1); }
    }
    .best-value-glow {
      animation: pulse-green 2s infinite;
    }
    .special-offer-glow {
      animation: pulse-shadow 2.5s infinite;
    }
  `}} />
);

// --- Main App Component ---

/**
 * This is the main site component.
 * It fetches config and handles all the business logic.
 */
const Site = () => {
  // --- State ---
  const [appConfig, setAppConfig] = useState(null);
  const [configError, setConfigError] = useState(null);
  // 1. NEW: Add state to track the source
  const [configSource, setConfigSource] = useState('Checking...');
  
  const [view, setView] = useState('zip'); // 'zip' -> 'sorter' -> 'custom_quote' OR 'packages' -> 'payment_plan' -> 'checkout'
  const [zipCode, setZipCode] = useState('');
  const [yardSize, setYardSize] = useState('standard');
  const [dogCount, setDogCount] = useState('1-2');
  const [multiDogFee, setMultiDogFee] = useState(0);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showAlertsModal, setShowAlertsModal] = useState(false);
  const [showPackageReviewModal, setShowPackageReviewModal] = useState(false);
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [showSatisfactionModal, setShowSatisfactionModal] = useState(false); // NEW
  const [isFormSubmitted, setIsFormSubmitted] = useState(false);
  
  // --- NEW: Addon State (Object) ---
  const [yardPlusSelections, setYardPlusSelections] = useState({});
  
  const [packageSelection, setPackageSelection] = useState({ name: null, finalMonthlyPrice: 0, key: null });
  const [paymentSelection, setPaymentSelection] = useState({ term: 'Monthly', total: 0, savings: null, savingsValue: 0 });
  const [isExitModalOpen, setIsExitModalOpen] = useState(false);

  const [stripeInstance, setStripeInstance] = useState(null);
  const [cardElement, setCardElement] = useState(null);
  const [stripeError, setStripeError] = useState(null);
  
  // --- Initialize Firebase for Site component ---
  const [db, setDb] = useState(null);

  useEffect(() => {
    try {
      // --- Use imported firebaseConfig ---
      let app;
      // Check if the "site" app is already initialized
      if (getApps().some(app => app.name === 'site')) {
        app = getApp('site');
      } else {
        // Initialize the "site" app
        app = initializeApp(firebaseConfig, "site");
      }
      setDb(getFirestore(app));
    } catch (e) {
      console.error("Firebase init error", e);
      setConfigError(new Error("Could not initialize app configuration."));
    }
  }, []);


  // --- Effects ---
  
  // 1. Fetch config from FIRESTORE on initial load
  useEffect(() => {
    // Wait until db is initialized
    if (!db) return;

    const fetchConfig = async () => {
      try {
        const docRef = doc(db, 'config', 'production');
        let config;
        
        try {
          // Attempt to fetch from Firestore first
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            config = docSnap.data();
            // SUCCESS: Set source to Live
            setConfigSource('🔥 Live Database (Firestore)');
            console.log("Connected to Firestore successfully.");
          }
        } catch (firestoreError) {
          console.warn("Firestore fetch failed (offline or blocked), falling back to local config.", firestoreError);
          // Fallback is handled below if config is still undefined
        }

        if (!config) {
           // Fallback to local JSON if Firestore failed or doc didn't exist
           console.log("Loading fallback config from /config.json");
           const response = await fetch('/config.json');
           if (!response.ok) throw new Error('Could not find config.json');
           config = await response.json();
           // FAIL: Set source to Local
           setConfigSource('⚠️ Offline Mode (Local File)');
        }

        // Safety check
        if (!config || !config.data || !config.text || !config.text.footer) {
           throw new Error('Configuration file is invalid or missing required properties.');
        }

        setAppConfig(config);
        document.title = 'Purge Pros Pet Waste Removal - Pricing';
        
        if (config.data.FAVICON_URL) {
          setFavicon(config.data.FAVICON_URL);
        }
        if (config.data.FACEBOOK_PIXEL_ID) {
          initFacebookPixel(config.data.FACEBOOK_PIXEL_ID);
        }
        // --- Initialize Google Tag ---
        if (config.data.GOOGLE_TAG_ID) {
          initGoogleTag(config.data.GOOGLE_TAG_ID);
        }
        
        // --- Dynamic Stripe Key Selection ---
        const stripeMode = config.data.STRIPE_MODE || 'test';
        
        // NOTE: You must set VITE_STRIPE_PK_LIVE and VITE_STRIPE_PK_TEST in your environment variables
        // Fallback to the hardcoded test key if the env var is missing (for safety during dev)
        const hardcodedTestKey = 'pk_test_51SOAayGelkvkkUqXzl9sYTm9SDaWBYSIhzlQMPPxFKvrEn01f3VLimIe59vsEgnJdatB9JTAvNt4GH0n8YTLMYzK00LZXRTnXZ';
        
        const stripeKey = stripeMode === 'live' 
          ? import.meta.env.VITE_STRIPE_PK_LIVE 
          : (import.meta.env.VITE_STRIPE_PK_TEST || hardcodedTestKey);

        if (!stripeKey) {
           console.error(`Stripe Public Key missing for mode: ${stripeMode}`);
           setStripeError(`Payment system configuration error (${stripeMode} mode).`);
           return;
        }

        // Load Stripe
        loadScript('https://js.stripe.com/v3/', 'stripe-js')
          .then(() => {
            if (window.Stripe) {
              const stripe = window.Stripe(stripeKey);
              setStripeInstance(stripe);
              
              const elements = stripe.elements();
              const card = elements.create('card', {
                style: {
                  base: {
                    color: "#32325d",
                    fontFamily: 'Inter, sans-serif',
                    fontSmoothing: "antialiased",
                    fontSize: "16px",
                    "::placeholder": {
                      color: "#aab7c4",
                    },
                  },
                  invalid: {
                    color: "#fa755a",
                    iconColor: "#fa755a",
                  },
                }
              });
              setCardElement(card);
            } else {
              console.error("Stripe.js loaded but window.Stripe is not available.");
              setStripeError("Failed to initialize payment system.");
            }
          })
          .catch(error => {
            console.error("Failed to load Stripe.js", error);
            setStripeError("Failed to load payment system. Please refresh.");
          });

      } catch (error) {
        console.error("Failed to load app configuration:", error);
        setConfigError(error);
      }
    };
    
    fetchConfig();
  }, [db]); 

  // 2. URL Parameter "Transposer" Logic
  useEffect(() => {
    if (!appConfig) return; // Wait for config to load

    const params = new URLSearchParams(window.location.search);
    const urlZip = params.get('zip');
    const urlYardSize = params.get('yardSize');
    const urlDogCount = params.get('dogCount');
    const urlPlan = params.get('plan');
    const urlPaymentTerm = params.get('paymentTerm');

    if (urlZip && appConfig.data.APPROVED_ZIP_CODES.includes(urlZip)) {
      setZipCode(urlZip);
      
      if (urlYardSize === 'estate') {
        setYardSize('estate');
        setDogCount(urlDogCount || '1-2');
        setView('custom_quote');
        return;
      }

      if (urlYardSize) setYardSize(urlYardSize);
      
      if (urlDogCount) {
        if (appConfig.data.dogFeeMap[urlDogCount] !== undefined) {
          setDogCount(urlDogCount);
          setMultiDogFee(appConfig.data.dogFeeMap[urlDogCount]);
        } else if (urlDogCount === '6+') {
          setDogCount('6+');
          setView('custom_quote');
          return;
        }
      }
      
      // Check for full plan and term to jump to checkout
      if (urlPlan && urlPaymentTerm) {
        const planKey = Object.keys(appConfig.data.planDetails).find(key => appConfig.data.planDetails[key].name === urlPlan);
        if (planKey) {
          const priceKey = appConfig.data.planDetails[planKey].priceKey;
          const finalPrice = appConfig.data.basePrices[priceKey] + (appConfig.data.dogFeeMap[urlDogCount] || 0);
          setPackageSelection({ name: urlPlan, finalMonthlyPrice: finalPrice, key: planKey });
          
          // Calculate payment selection
          const monthly = finalPrice;
          const plans = {
            'Monthly': { term: 'Monthly', total: monthly, savings: null, savingsValue: 0 },
            'Quarterly': { term: 'Quarterly', total: (monthly * 3) - 30, savings: 'You save $30!', savingsValue: 30 },
            'Annual': { term: 'Annual', total: monthly * 11, savings: `You save $${monthly} - 1 Month FREE!`, savingsValue: monthly },
          };
          
          if (plans[urlPaymentTerm]) {
            setPaymentSelection(plans[urlPaymentTerm]);
            setView('checkout'); 
            return;
          }
        }
      }
      
      // Fallback to sorter if zip is valid but other params aren't
      setView('sorter');
      
    } else {
      setView('zip');
    }
  }, [appConfig]); // Depends on appConfig

  // 3. Mount card element when view changes
  useEffect(() => {
    if ((view === 'checkout' || view === 'onetime_checkout') && cardElement) {
      const mountPoint = document.getElementById('card-element');
      if (mountPoint) {
        setTimeout(() => {
          try {
            cardElement.mount('#card-element');
          } catch (e) {
            if (!e.message.includes('already mounted')) {
              console.error("Error mounting card:", e.message);
            }
          }
        }, 100);
      }
    } else if (cardElement) {
      try {
        cardElement.unmount();
      } catch (e) {
        // ignore if not mounted
      }
    }
  }, [view, cardElement]);

  // 4. Scroll to top on view change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view]);

  // --- Exit Intent Hook ---
  const handleExitIntent = () => {
    if (view !== 'zip' && !view.includes('checkout') && !isFormSubmitted) {
      setIsExitModalOpen(true);
    }
  };
  useExitIntent(isFormSubmitted, handleExitIntent);
  
  const handleFormSubmissionSuccess = () => {
    setIsFormSubmitted(true);
    setIsExitModalOpen(false); 
  };

  // --- View Navigation Handlers ---
  const handleZipValidation = (validZip) => {
    setZipCode(validZip);
    setView('sorter');
  };

  const handleSorterComplete = (size, dogs, fee) => {
    setYardSize(size);
    setDogCount(dogs);
    setMultiDogFee(fee);

    if (size === 'estate' || dogs === '6+') {
      setView('custom_quote');
    } else {
      setView('packages');
    }
  };
  
  // VIEW 3B -> VIEW 4
  const handlePlanSelect = (planName, finalMonthlyPrice, planKey) => {
    setPackageSelection({ name: planName, finalMonthlyPrice: finalMonthlyPrice, key: planKey });
    setView('payment_plan');
  };

  // VIEW 4 -> VIEW 5
  const handlePaymentPlanSelect = (term, total, savings, savingsValue) => {
    setPaymentSelection({ term, total, savings, savingsValue });
    setView('checkout');
  };

  // "Bailout" link
  const handleBailout = () => {
    setView('custom_quote');
  };
  
  // --- Memos ---
  const CurrentPlanForExitModal = useMemo(() => {
    if (!appConfig) return {}; // Not ready yet
    
    const planName = packageSelection.name || appConfig.data.planDetails.weekly.name;
    const planKey = Object.keys(appConfig.data.planDetails).find(key => appConfig.data.planDetails[key].name === planName) || 'weekly';
    const plan = appConfig.data.planDetails[planKey];
    const priceKey = plan.priceKey;
    const totalMonthlyPrice = appConfig.data.basePrices[priceKey] + multiDogFee;
    
    return { 
      ...plan, 
      price: totalMonthlyPrice,
      dogCount: dogCount,
    };
  }, [appConfig, packageSelection, multiDogFee, dogCount]);
  
  const selectedPlanFeatures = useMemo(() => {
    if (!appConfig || !packageSelection.key) return [];
    return appConfig.data.planDetails[packageSelection.key]?.features || [];
  }, [appConfig, packageSelection.key]);
  
  const selectedPlanFrequency = useMemo(() => {
    if (!appConfig || !packageSelection.key) return '';
    return appConfig.data.planDetails[packageSelection.key]?.frequency || '';
  }, [appConfig, packageSelection.key]);
  
  const oneTimePSText = useMemo(() => {
    if (!appConfig) return '';
    const weeklyPriceKey = appConfig.data.planDetails.weekly.priceKey;
    const price = appConfig.data.basePrices[weeklyPriceKey] + multiDogFee;
    return appConfig.text.oneTimeView.psBody.replace('{price}', price);
  }, [appConfig, multiDogFee]);


  // --- Render Logic ---

  if (configError) {
    return (
      <>
        {/* GlobalStyles is in App now */}
        <Header />
        <main className="container mx-auto px-4 py-8">
          <FullPageLoader error={configError} />
        </main>
        {/* Pass a default object to Footer in error state */}
        <Footer text={{ address: "Loading error...", phone1: "", phone2: "", email: "" }} />
      </>
    );
  }

  if (!appConfig) {
    return (
      <>
        {/* GlobalStyles is in App now */}
        <Header />
        <main className="container mx-auto px-4 py-8">
          <FullPageLoader />
        </main>
        {/* Pass a default object to Footer in loading state */}
        <Footer text={{ address: "Loading...", phone1: "...", phone2: "...", email: "..." }} />
      </>
    );
  }

  // App is ready, render the correct view
  return (
    <>
      {/* 3. NEW: Visual Debug Badge (Bottom Left) */}
      <div className={`fixed bottom-4 left-4 z-50 px-4 py-2 rounded-full text-xs font-bold text-white shadow-lg ${
        configSource.includes('Live') ? 'bg-green-600' : 'bg-red-600'
      }`}>
        Status: {configSource}
      </div>

      {/* GlobalStyles is in App now */}
      <Header onSatisfactionClick={() => setShowSatisfactionModal(true)} />
      
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-xl mx-auto">
          
          {stripeError && (
             <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6" role="alert">
               <p className="font-bold">Payment Error</p>
               <p>{stripeError}</p>
             </div>
          )}

          {view === 'zip' && (
            <ZipCodeValidator
              onZipValidated={handleZipValidation}
              approvedZipCodes={appConfig.data.APPROVED_ZIP_CODES}
              text={appConfig.text.zipView}
            />
          )}

          {view === 'sorter' && (
            <Sorter
              onSortComplete={handleSorterComplete}
              onBack={() => setView('zip')}
              initialYardSize={yardSize}
              initialDogCount={dogCount}
              dogFeeMap={appConfig.data.dogFeeMap}
              text={appConfig.text.sorterView}
              specialOffer={appConfig.text.globals}
            />
          )}
          
          {view === 'packages' && (
            <PackageSelector
              basePrices={appConfig.data.basePrices}
              planDetails={appConfig.data.planDetails}
              dogFee={multiDogFee}
              dogCount={dogCount}
              yardPlusPrice={appConfig.data.yardPlusPrice}
              yardPlusSelections={yardPlusSelections} // Pass Object
              setYardPlusSelections={setYardPlusSelections} // Pass Setter
              onPlanSelect={handlePlanSelect}
              onBack={() => setView('sorter')}
              onOneTimeClick={() => setView('onetime')}
              onInfoClick={() => setShowInfoModal(true)}
              onAlertsInfoClick={() => setShowAlertsModal(true)}
              text={appConfig.text.packagesView}
              specialOffer={appConfig.text.globals}
            />
          )}
          
          {view === 'payment_plan' && (
            <PaymentPlanSelector
              packageSelection={packageSelection}
              onPaymentSelect={handlePaymentPlanSelect}
              onBack={() => setView('packages')}
              text={appConfig.text.paymentPlanView}
            />
          )}

          {view === 'checkout' && (
            <CheckoutForm
              packageSelection={packageSelection}
              paymentSelection={paymentSelection}
              zipCode={zipCode}
              dogCount={dogCount}
              planKey={packageSelection.key}
              onBack={() => {
                cardElement?.unmount();
                setView('payment_plan');
              }}
              onBailout={() => {
                cardElement?.unmount();
                handleBailout();
              }}
              onSubmitSuccess={handleFormSubmissionSuccess}
              stripeInstance={stripeInstance}
              cardElement={cardElement}
              text={appConfig.text.checkoutView}
              stripeMode={appConfig.data.STRIPE_MODE} // --- Pass Mode to Form ---
              yardPlusSelected={!!yardPlusSelections[packageSelection.key]} // --- Pass specific boolean based on key ---
            />
          )}
          
          {view === 'custom_quote' && (
            <LeadForm
              title={appConfig.text.customQuoteView.title}
              description={dogCount === '6+'
                ? appConfig.text.customQuoteView.descMultiDog
                : appConfig.text.customQuoteView.descEstate
              }
              zipCode={zipCode}
              dogCount={dogCount}
              onSubmitSuccess={handleFormSubmissionSuccess}
              onBack={() => setView('sorter')}
              text={appConfig.text.leadForm}
            />
          )}
          
          {view === 'onetime' && (
            <div className="bg-white p-6 md:p-8 rounded-xl shadow-lg fade-in">
              <button onClick={() => setView('packages')} className="text-sm text-gray-600 hover:text-blue-600 hover:underline mb-4">&larr; Back to Plans</button>
              <h2 className="text-2xl font-bold text-slate-800 text-center mb-4">{appConfig.text.oneTimeView.title}</h2>
              
              <div className="text-center my-6 py-4 border-y border-gray-200">
                <span className="text-5xl font-extrabold text-slate-900">$99.99</span>
                <p className="text-sm text-slate-500 mt-1">{appConfig.text.oneTimeView.subTitle}</p>
              </div>

              <p className="text-slate-600 text-center mb-4">
                {appConfig.text.oneTimeView.description}
              </p>
              <p className="text-slate-600 text-center text-sm mb-6">
                {appConfig.text.oneTimeView.estatePrompt}
                <button 
                  onClick={() => { setView('custom_quote'); setYardSize('estate'); }} 
                  className="font-bold underline text-blue-600 hover:text-blue-700"
                >
                  {appConfig.text.oneTimeView.estateLinkText}
                </button>.
              </p>

              <div className="bg-green-50 border-l-4 border-green-500 text-green-800 p-4 rounded-r-lg mb-6">
                <p className="font-bold">{appConfig.text.oneTimeView.psTitle}</p>
                <p className="text-sm">
                  <span dangerouslySetInnerHTML={{ __html: oneTimePSText }} />
                  <button onClick={() => setView('packages')} className="font-bold underline ml-1 hover:text-green-600">
                    {appConfig.text.oneTimeView.psLinkText}
                  </button>
                </p>
              </div>

              <button
                onClick={() => setView('onetime_checkout')}
                className="w-full bg-[var(--brand-blue)] text-white font-bold text-lg py-4 rounded-lg hover:bg-opacity-90 transition-all duration-200 transform hover:-translate-y-0.5 shadow-lg hover:shadow-xl"
              >
                Book One-Time Cleanup
              </button>
            </div>
          )}
          
          {view === 'onetime_checkout' && (
            <OneTimeCheckoutForm
              zipCode={zipCode}
              dogCount={dogCount}
              onBack={() => {
                cardElement?.unmount();
                setView('onetime');
              }}
              onSubmitSuccess={handleFormSubmissionSuccess}
              stripeInstance={stripeInstance}
              cardElement={cardElement}
              text={appConfig.text.oneTimeCheckoutView}
              stripeMode={appConfig.data.STRIPE_MODE} // --- Pass Mode to Form ---
            />
          )}
          
        </div>
      </main>
      
      {/* --- ALL MODALS --- */}
      {showInfoModal && (
        <ServiceInfoModal
          onClose={() => setShowInfoModal(false)}
          text={appConfig.text.modals.serviceInfo}
        />
      )}
      {showAlertsModal && (
        <AlertsInfoModal
          onClose={() => setShowAlertsModal(false)}
          text={appConfig.text.modals.alertsInfo}
        />
      )}
      {showPricingModal && (
        <PricingInfoModal
          onClose={() => setShowPricingModal(false)}
          text={appConfig.text.modals.pricingInfo}
        />
      )}
      
      {showSatisfactionModal && (
        <SatisfactionModal
          onClose={() => setShowSatisfactionModal(false)}
          text={appConfig.text.modals.satisfactionInfo}
        />
      )}
      
      {showPackageReviewModal && (
        <PackageReviewModal
          onClose={() => setShowPackageReviewModal(false)}
          planName={packageSelection.name}
          frequency={selectedPlanFrequency}
          features={selectedPlanFeatures}
          dogCount={dogCount}
        />
      )}
      
      {isExitModalOpen && (
        <ExitIntentModal
          currentPlan={CurrentPlanForExitModal}
          zipCode={zipCode}
          yardSize={yardSize}
          planDetails={appConfig.data.planDetails}
          text={appConfig.text.modals.exitIntent}
          onClose={() => setIsExitModalOpen(false)}
        />
      )}
      
      <Footer 
        text={appConfig.text.footer}
      />
    </>
  );
}


/**
 * This is the NEW main App component.
 * It sets up the router and renders the correct page.
 */
const App = () => {
  return (
    <>
      <GlobalStyles />
      <Router>
        <Suspense fallback={
          <>
            {/* We must render these components in fallback
                to prevent a layout shift and to show the loader */}
            <Header />
            <main className="container mx-auto px-4 py-8">
              <FullPageLoader />
            </main>
            <Footer 
              text={{ address: "Loading...", phone1: "...", phone2: "...", email: "..." }}
            />
          </>
        }>
          <Routes>
            {/* The /admin route renders your new admin panel */}
            <Route path="/admin" element={<AdminPanel />} />
            
            {/* The default / route renders your main site */}
            <Route path="/" element={<Site />} />
          </Routes>
        </Suspense>
      </Router>
    </>
  );
};

export default App;