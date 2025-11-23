import React, { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import { initializeApp, getApp, getApps } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth'; 
import firebaseConfig from './firebaseConfig.js';

// Lazily load AdminPanel
const AdminPanel = lazy(() => import('./AdminPanel.jsx'));

// --- Helper Functions ---

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

const initFacebookPixel = (pixelId) => {
  if (window.fbq || !pixelId) return;
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

const initGoogleTag = (tagId) => {
  if (!tagId || document.getElementById('google-tag-script')) return;
  const script = document.createElement('script');
  script.id = 'google-tag-script';
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${tagId}`;
  document.head.appendChild(script);
  window.dataLayer = window.dataLayer || [];
  function gtag(){window.dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', tagId);
};

const setFavicon = (href) => {
  if (!href) return;
  let link = document.querySelector("link[rel*='icon']") || document.createElement('link');
  link.type = 'image/png';
  link.rel = 'shortcut icon';
  link.href = href;
  document.getElementsByTagName('head')[0].appendChild(link);
};

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
const useExitIntent = (isFormSubmitted, onIntent) => {
  useEffect(() => {
    if (isFormSubmitted) return;
    const timerId = setTimeout(() => {
      const handleMouseLeave = (e) => {
        if (e.clientY <= 0) {
          const hasSeenModal = sessionStorage.getItem('seenExitIntentModal');
          if (!hasSeenModal) {
            onIntent();
            sessionStorage.setItem('seenExitIntentModal', 'true');
          }
        }
      };
      document.addEventListener('mouseleave', handleMouseLeave);
      return () => document.removeEventListener('mouseleave', handleMouseLeave);
    }, 1500);
    return () => clearTimeout(timerId);
  }, [isFormSubmitted, onIntent]);
};

// --- Components ---

const FullPageLoader = ({ error = null }) => (
  <div className="flex flex-col items-center justify-center min-h-[300px]">
    {error ? (
      <div className="max-w-lg w-full bg-red-100 border-l-4 border-red-500 text-red-700 p-6 rounded-lg shadow-md">
        <h3 className="font-bold text-lg mb-2">Application Error</h3>
        <p className="mb-4">Could not load application configuration.</p>
        <pre className="text-sm bg-red-50 p-2 rounded overflow-auto">{error.message || String(error)}</pre>
        {error.code === 'auth/admin-restricted-operation' && (
            <div className="mt-4 p-4 bg-yellow-100 text-yellow-800 rounded text-sm">
                <strong>Action Required:</strong> You must enable "Anonymous Authentication" in your Firebase Console (Authentication &gt; Sign-in method).
            </div>
        )}
      </div>
    ) : (
      <span className="loader"></span>
    )}
  </div>
);

const Header = ({ onSatisfactionClick }) => (
  <header className="py-6 text-center">
    <div className="container mx-auto px-4 flex flex-col items-center justify-center">
      <a href="https://itspurgepros.com/" className="transition-all hover:opacity-80 hover:scale-105 mb-4">
        <img src="https://storage.googleapis.com/msgsndr/YzqccfNpAoMTt4EZO92d/media/68140f6288b94e80fb043618.png" alt="Purge Pros Logo" className="h-32 md:h-40" />
      </a>
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
  const currentYear = new Date().getFullYear();
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
              <li>{text?.address || "Loading..."}</li>
              <li><a href={`tel:${text?.phone1}`} className="hover:text-white hover:underline">{text?.phone1}</a></li>
              <li><a href={`tel:${text?.phone2}`} className="hover:text-white hover:underline">{text?.phone2}</a></li>
              <li><a href={`mailto:${text?.email}`} className="hover:text-white hover:underline">{text?.email}</a></li>
            </ul>
          </div>
        </div>
        <div className="mt-8 border-t border-gray-700 pt-6 text-center text-gray-500 text-sm">
          &copy; {currentYear} Purge Pros. All Rights Reserved.
        </div>
      </div>
    </footer>
  );
};

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
    setError('');
    onZipValidated(zip);
  };

  return (
    <div className="bg-white p-8 rounded-xl shadow-lg fade-in">
      <h2 className="text-2xl font-bold text-slate-800 text-center mb-6">{text.title}</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="tel"
          pattern="[0-9]*"
          placeholder="Enter 5-Digit Zip Code"
          required
          maxLength="5"
          className="w-full p-4 border-2 border-gray-300 rounded-lg text-lg text-center"
          value={zip}
          onChange={(e) => setZip(e.target.value)}
        />
        {error && <p className="text-red-600 text-sm font-medium text-center">{error}</p>}
        <button type="submit" className="w-full bg-[var(--brand-green)] text-white font-bold text-lg py-4 rounded-lg hover:bg-opacity-90 shadow-lg transition-transform hover:-translate-y-0.5">
          See Prices
        </button>
      </form>
    </div>
  );
};

/**
 * VIEW 2: The Sorter (Yard Size & Dog Count)
 */
const Sorter = ({ onSortComplete, onBack, initialYardSize, initialDogCount, text, specialOffer, lotFees }) => {
  const [yardSize, setYardSize] = useState(initialYardSize || 'standard');
  const [dogCount, setDogCount] = useState(initialDogCount || '1-2');

  const getDogNumber = (val) => {
    if (val === '1-2') return 2;
    if (val === '10+') return 10;
    return parseInt(val, 10);
  };

  const handleSubmit = () => {
    const numDogs = getDogNumber(dogCount);
    onSortComplete(yardSize, numDogs, dogCount);
  };

  // Fallback values in case lotFees isn't ready
  const tier1Price = lotFees?.tier1 || 30;
  const tier2Price = lotFees?.tier2 || 60;

  return (
    <div className="bg-white p-8 rounded-xl shadow-lg fade-in">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-800 text-center mb-4">{text.yardTitle}</h2>
        <div className="space-y-3">
          <YardButton title="Standard Lot (Up to 1/4 Acre)" description="" selected={yardSize === 'standard'} onClick={() => setYardSize('standard')} />
          <YardButton title={`Medium Lot (+$${tier1Price}/mo)`} description="1/4 - 1/2 Acre" selected={yardSize === 'tier1'} onClick={() => setYardSize('tier1')} />
          <YardButton title={`Large Lot (+$${tier2Price}/mo)`} description="1/2 - 1 Acre" selected={yardSize === 'tier2'} onClick={() => setYardSize('tier2')} />
          <YardButton title="Estate / Farm (Over 1 Acre)" description="Custom Quote" selected={yardSize === 'estate'} onClick={() => setYardSize('estate')} />
        </div>
      </div>

      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-800 text-center mb-4">{text.dogTitle}</h2>
        <select value={dogCount} onChange={(e) => setDogCount(e.target.value)} className="w-full p-4 border-2 border-gray-300 rounded-lg text-lg bg-white">
          <option value="1-2">1 - 2 Dogs</option>
          <option value="3">3 Dogs</option>
          <option value="4">4 Dogs</option>
          <option value="5">5 Dogs</option>
          <option value="6">6 Dogs</option>
          <option value="7">7 Dogs</option>
          <option value="8">8 Dogs</option>
          <option value="9">9 Dogs</option>
          <option value="10+">10+ Dogs (Kennel)</option>
        </select>
      </div>

      <div className="bg-green-100 border-l-4 border-green-500 text-green-900 p-4 rounded-r-lg mb-6 shadow-sm flex items-center space-x-3">
        <div className="flex-shrink-0">
           <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
        </div>
        <div>
          <p className="font-bold">{specialOffer.specialOfferTitle}</p>
          <p className="text-sm" dangerouslySetInnerHTML={{ __html: specialOffer.specialOfferBody }} />
        </div>
      </div>

      <button onClick={handleSubmit} className="w-full bg-[var(--brand-green)] text-white font-bold text-lg py-4 rounded-lg hover:bg-opacity-90 shadow-lg transition-transform hover:-translate-y-0.5">
        See My Price
      </button>
      
      <button onClick={onBack} className="w-full text-center text-sm text-gray-600 hover:text-blue-600 hover:underline mt-4">
        &larr; Change Zip Code
      </button>
    </div>
  );
};

const YardButton = ({ title, description, selected, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center justify-between p-4 border-2 rounded-lg transition-all ${
      selected ? 'border-blue-500 bg-blue-50 shadow-md' : 'border-gray-200 hover:border-blue-300'
    }`}
  >
    <span className="font-bold text-gray-800">{title}</span>
    <span className="text-sm text-gray-500">{description}</span>
  </button>
);

const PackageSelector = ({ 
  basePrices, planDetails, 
  yardSize, numDogs, 
  lotFees, extraDogPrice, yardPlusPrice,
  onPlanSelect, onBack, onOneTimeClick, 
  onInfoClick, onAlertsInfoClick, 
  text, specialOffer, 
  yardPlusSelections, setYardPlusSelections 
}) => {

  // FIX: Add safety checks for incoming props to prevent crash on 'Next'
  if (!lotFees || !basePrices || !planDetails) {
      return <div className="p-8 text-center"><span className="loader"></span> Calculating...</div>;
  }

  let lotFee = 0;
  if (yardSize === 'tier1') lotFee = lotFees.tier1 || 0;
  if (yardSize === 'tier2') lotFee = lotFees.tier2 || 0;

  let dogFee = 0;
  if (numDogs > 2) {
    dogFee = (numDogs - 2) * extraDogPrice;
  }

  const showAllPlans = numDogs < 6;

  const handleToggle = (planKey) => {
    setYardPlusSelections(prev => ({ ...prev, [planKey]: !prev[planKey] }));
  };

  const plans = [];
  const buildPlan = (key, isPopular) => {
    const details = planDetails[key];
    const base = basePrices[details.priceKey];
    const isIncluded = key === 'twiceWeekly';
    const isSelected = !!yardPlusSelections[key];
    const addonCost = (isSelected && !isIncluded) ? yardPlusPrice : 0;

    const featuredFreeFeatures = [];
    const standardFeatures = [];
    
    // Safety check for features array
    if (details.features && Array.isArray(details.features)) {
        details.features.forEach(feature => {
            const isExcluded = feature.startsWith('!');
            const isFree = feature.toUpperCase().includes('FREE');
            if (!isExcluded && isFree) {
                featuredFreeFeatures.push(feature);
            } else {
                standardFeatures.push(feature);
            }
        });
    }

    standardFeatures.sort((a, b) => {
        const aExcluded = a.startsWith('!');
        const bExcluded = b.startsWith('!');
        if (aExcluded && !bExcluded) return 1;
        if (!aExcluded && bExcluded) return -1;
        return 0;
    });

    return {
      key,
      name: details.name,
      frequency: details.frequency,
      featuredFreeFeatures,
      standardFeatures,
      finalPrice: base + lotFee + dogFee + addonCost, 
      basePrice: base,
      popular: isPopular,
      canToggleYardPlus: !isIncluded, 
      isYardPlusIncluded: isIncluded
    };
  };

  if (showAllPlans) {
    plans.push(buildPlan('biWeekly', false));
    plans.push(buildPlan('weekly', true));
  }
  plans.push(buildPlan('twiceWeekly', !showAllPlans));

  return (
    <div className="bg-white p-6 md:p-8 rounded-xl shadow-lg fade-in">
      <button onClick={onBack} className="text-sm text-gray-600 hover:text-blue-600 hover:underline mb-4">&larr; Back</button>
      <h2 className="text-2xl font-bold text-slate-800 text-center mb-6">{text.title}</h2>

      <div className="bg-green-100 border-l-4 border-green-500 text-green-900 p-4 rounded-r-lg mb-6 flex items-center space-x-3">
         <div className="flex-shrink-0"><svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg></div>
         <div>
           <p className="font-bold">{specialOffer.specialOfferTitle}</p>
           <p className="text-sm" dangerouslySetInnerHTML={{__html: specialOffer.specialOfferBody}}/>
         </div>
      </div>

      <div className="space-y-6">
        {plans.map((plan) => (
          <div key={plan.key} className={`relative p-6 border-2 rounded-xl transition-all ${plan.popular ? 'border-[var(--brand-green)] shadow-lg scale-[1.02]' : 'border-gray-200'}`}>
            {plan.popular && <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[var(--brand-green)] text-white text-xs font-bold px-3 py-1 rounded-full">BEST VALUE</span>}
            
            <div className="text-center">
              <h3 className="text-2xl font-bold text-slate-800">{plan.name}</h3>
              <div className="mt-2 mb-4">
                <span className="text-4xl font-extrabold text-slate-900">${plan.finalPrice}</span>
                <span className="text-slate-500 font-medium">/mo</span>
              </div>
            </div>

            {plan.isYardPlusIncluded && (
              <div className="mb-4 bg-green-100 text-green-800 text-xs font-bold px-2 py-2 rounded text-center border border-green-200">
                Yard+ Coverage Included FREE!
              </div>
            )}
            {yardPlusSelections[plan.key] && !plan.isYardPlusIncluded && (
              <div className="mb-4 bg-blue-100 text-blue-800 text-xs font-bold px-2 py-2 rounded text-center border border-blue-200">
                Includes Yard+ Coverage (+${yardPlusPrice})
              </div>
            )}

            {plan.featuredFreeFeatures.map((feature, idx) => {
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

            <ul className="space-y-2 mb-6 mt-4">
              <li className="flex items-start text-sm text-slate-600">
                <svg className="w-5 h-5 text-green-500 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                <span>Service for <strong>{numDogs} Dogs</strong></span>
              </li>
              {plan.standardFeatures.map((feat, i) => {
                const isExcluded = feat.startsWith('!');
                const text = isExcluded ? feat.substring(1) : feat;
                return (
                  <li key={i} className={`flex items-start text-sm ${isExcluded ? 'text-slate-400 line-through' : 'text-slate-600'}`}>
                    {isExcluded ? (
                      <svg className="w-5 h-5 text-red-400 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    ) : (
                      <svg className="w-5 h-5 text-green-500 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    )}
                    <div className="flex-grow">
                      {text}
                      {(text.includes('Automated Reminders')) && !isExcluded && (
                        <button onClick={onAlertsInfoClick} className="ml-1 text-blue-500 hover:text-blue-700"><svg className="w-4 h-4 inline" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg></button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>

            {plan.canToggleYardPlus && (
              <label className="flex items-center justify-between p-3 bg-slate-50 rounded-lg mb-4 cursor-pointer border border-slate-200 hover:bg-slate-100">
                <span className="text-sm font-semibold text-slate-700">Add Yard+ Coverage (+${yardPlusPrice})</span>
                <input 
                  type="checkbox" 
                  className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                  checked={!!yardPlusSelections[plan.key]} 
                  onChange={() => handleToggle(plan.key)} 
                />
              </label>
            )}

            <button onClick={() => onPlanSelect(plan)} className="w-full bg-[var(--brand-green)] text-white font-bold py-3 rounded-lg hover:bg-opacity-90 shadow transition-transform hover:-translate-y-0.5">
              Select Plan
            </button>
          </div>
        ))}
      </div>

      <button type="button" onClick={onOneTimeClick} className="block w-full text-center text-sm text-gray-500 hover:text-blue-600 hover:underline mt-8 cursor-pointer">
        {text.oneTimeLink}
      </button>
    </div>
  );
};

const PaymentPlanSelector = ({ packageSelection, onPaymentSelect, onBack, quarterlyDiscount, text }) => {
  const monthly = packageSelection.finalPrice;
  const plans = [
    { term: 'Monthly', label: 'Pay Monthly', totalDue: monthly, savingsText: null, savingsValue: 0 },
    { term: 'Quarterly', label: 'Pay Quarterly', totalDue: (monthly * 3) - quarterlyDiscount, savingsText: `Save $${quarterlyDiscount} per Quarter!`, savingsValue: quarterlyDiscount, isPopular: false },
    { term: 'Annual', label: 'Pay Yearly', totalDue: monthly * 11, savingsText: `Get 1 Month FREE (Save $${monthly})!`, savingsValue: monthly, isPopular: true }
  ];

  return (
    <div className="bg-white p-6 md:p-8 rounded-xl shadow-lg fade-in">
      <button onClick={onBack} className="text-sm text-gray-600 hover:text-blue-600 hover:underline mb-4">&larr; Back to Plans</button>
      <h2 className="text-2xl font-bold text-slate-800 text-center mb-2">{text.title}</h2>
      <p className="text-center text-slate-600 mb-6">for <strong>{packageSelection.name}</strong> plan</p>
      <div className="space-y-4">
        {plans.map((p) => (
          <button key={p.term} onClick={() => onPaymentSelect(p)} className={`relative w-full text-left p-5 border-2 rounded-xl transition-all hover:-translate-y-1 ${p.isPopular ? 'border-[var(--brand-green)] bg-green-50 shadow-md' : 'border-gray-200 bg-white hover:border-blue-300'}`}>
            {p.isPopular && <span className="absolute -top-3 right-4 bg-[var(--brand-green)] text-white text-xs font-bold px-2 py-1 rounded">BEST VALUE</span>}
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-slate-800">{p.label}</h3>
                {p.savingsText && <p className="text-sm font-bold text-green-600">{p.savingsText}</p>}
              </div>
              <div className="text-right">
                <span className="block text-2xl font-extrabold text-slate-900">${p.totalDue}</span>
                <span className="text-xs text-slate-500">due today</span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

const CheckoutForm = ({ packageSelection, paymentSelection, zipCode, dogCount, yardSize, onBack, onSubmitSuccess, stripeInstance, cardElement, text, stripeMode, yardPlusSelected }) => {
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', address: '', terms: false });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const totalDue = paymentSelection.totalDue;
  const totalSavings = 99.99 + paymentSelection.savingsValue;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.terms) { setError('Please agree to the terms.'); return; }
    if (!stripeInstance || !cardElement) { setError('Payment system not ready. Please wait or refresh.'); return; }
    
    setIsSubmitting(true);
    setError('');

    try {
      const { error: stripeError, paymentMethod } = await stripeInstance.createPaymentMethod({
        type: 'card',
        card: cardElement,
        billing_details: { name: formData.name, email: formData.email, phone: formData.phone, address: { line1: formData.address, postal_code: zipCode } }
      });

      if (stripeError) throw new Error(stripeError.message);

      const payload = {
        stripeMode,
        paymentMethodId: paymentMethod.id,
        customer: formData,
        quote: { zipCode, dogCount, planName: packageSelection.name, planKey: packageSelection.key, paymentTerm: paymentSelection.term, totalDueToday: totalDue, yardSize, yardPlusSelected },
        leadData: { ...formData, zip: zipCode, plan: packageSelection.name, total: totalDue, term: paymentSelection.term },
        emailParams: { ...formData, plan: packageSelection.name, total_monthly: `$${packageSelection.finalPrice}/mo`, final_charge: `$${totalDue}`, savings: `$${totalSavings.toFixed(2)}` }
      };

      const res = await fetch('/.netlify/functions/create-stripe-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok || data.status !== 'success') throw new Error(data.message || 'Payment failed.');
      onSubmitSuccess();
    } catch (err) {
      setError(err.message);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white p-6 md:p-8 rounded-xl shadow-lg fade-in">
      <button onClick={onBack} className="text-sm text-gray-600 hover:underline mb-4">&larr; Back</button>
      <h2 className="text-2xl font-bold text-center mb-6">{text.title}</h2>
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-6 text-sm">
        <div className="flex justify-between mb-2">
          <span>{packageSelection.name} ({paymentSelection.term})</span>
          <span className="font-bold">${totalDue.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-green-600 font-semibold">
          <span>Total Savings Today:</span>
          <span>-${totalSavings.toFixed(2)}</span>
        </div>
      </div>
      <div className="bg-blue-50 p-4 rounded-lg mb-6 text-sm text-blue-800" dangerouslySetInnerHTML={{__html: text.whatHappensNextBody}} />
      <form onSubmit={handleSubmit} className="space-y-4">
        <input className="w-full p-3 border rounded" placeholder="Full Name" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
        <input className="w-full p-3 border rounded" type="email" placeholder="Email" required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
        <input className="w-full p-3 border rounded" type="tel" placeholder="Phone" required value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
        <input className="w-full p-3 border rounded" placeholder="Address" required value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
        
        {/* Stripe Element Container - Ensuring it's visible and mounted */}
        <div className="p-3 border rounded bg-white min-h-[50px]">
          {stripeInstance ? <div id="card-element" /> : <p className="text-gray-400 text-center">Loading Payment System...</p>}
        </div>

        <label className="flex items-start text-xs text-gray-500 gap-2">
          <input type="checkbox" className="mt-1" checked={formData.terms} onChange={e => setFormData({...formData, terms: e.target.checked})} />
          <span>I agree to the Terms of Service & Privacy Policy.</span>
        </label>
        {error && <p className="text-red-600 text-center text-sm">{error}</p>}
        <button disabled={isSubmitting} className="w-full bg-[var(--brand-green)] text-white font-bold py-4 rounded-lg hover:bg-opacity-90">
          {isSubmitting ? 'Processing...' : `Pay $${totalDue.toFixed(2)} & Start`}
        </button>
      </form>
    </div>
  );
};

const LeadForm = ({ title, description, onBack, onSubmitSuccess, zipCode, dogCount }) => {
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', address: '', notes: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
       const res = await fetch('/.netlify/functions/create-lead', {
         method: 'POST',
         headers: {'Content-Type': 'application/json'},
         body: JSON.stringify({
           leadType: 'customQuote',
           leadData: { ...formData, zip: zipCode, dog_count: dogCount, lead_status: 'Custom Quote Req' },
           emailParams: { ...formData, description: title }
         })
       });
       if (res.ok) onSubmitSuccess();
    } catch (e) { console.error(e); setIsSubmitting(false); }
  };

  return (
    <div className="bg-white p-8 rounded-xl shadow-lg fade-in">
      <h2 className="text-2xl font-bold text-center mb-2">{title}</h2>
      <p className="text-center text-gray-600 mb-6">{description}</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input className="w-full p-3 border rounded" placeholder="Name" required onChange={e => setFormData({...formData, name: e.target.value})} />
        <input className="w-full p-3 border rounded" placeholder="Email" required onChange={e => setFormData({...formData, email: e.target.value})} />
        <input className="w-full p-3 border rounded" placeholder="Phone" required onChange={e => setFormData({...formData, phone: e.target.value})} />
        <textarea className="w-full p-3 border rounded" placeholder="Tell us about your property..." onChange={e => setFormData({...formData, notes: e.target.value})} />
        <button disabled={isSubmitting} className="w-full bg-[var(--brand-green)] text-white font-bold py-3 rounded">
          {isSubmitting ? 'Sending...' : 'Request Quote'}
        </button>
      </form>
      <button onClick={onBack} className="w-full text-center text-sm text-blue-600 mt-4 underline">Go Back</button>
    </div>
  );
};

const OneTimeCheckoutForm = ({ zipCode, dogCount, onBack, onSubmitSuccess, stripeInstance, cardElement, text, stripeMode }) => {
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', address: '', terms: false });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const depositAmount = 99.99;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!formData.terms) { setError('You must agree to the Terms of Service.'); return; }
    if (!stripeInstance || !cardElement) { setError('Payment system is not ready.'); return; }
    setIsSubmitting(true);

    try {
      const { error: stripeError, paymentMethod } = await stripeInstance.createPaymentMethod({
        type: 'card',
        card: cardElement,
        billing_details: { name: formData.name, email: formData.email, phone: formData.phone, address: { line1: formData.address, postal_code: zipCode } }
      });
      if (stripeError) throw new Error(stripeError.message);

      const res = await fetch('/.netlify/functions/create-stripe-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stripeMode, paymentMethodId: paymentMethod.id,
          customer: formData,
          quote: { zipCode, dogCount, planName: 'One-Time Yard Reset', planKey: 'oneTime', paymentTerm: 'One-Time Deposit', totalDueToday: depositAmount },
          leadData: { ...formData, zip: zipCode, lead_status: 'Complete - PAID (One-Time)', quote_type: 'One-Time Yard Reset' },
          emailParams: { ...formData, description: 'One-Time Yard Reset', final_charge: `$${depositAmount} (Deposit)` }
        })
      });
      const data = await res.json();
      if (!res.ok || data.status !== 'success') throw new Error(data.message || 'Payment processing failed.');
      onSubmitSuccess();
    } catch (err) {
      console.error('Submission Error:', err);
      setError(err.message);
      setIsSubmitting(false);
    }
  };
  
  return (
    <div className="bg-white p-6 md:p-8 rounded-xl shadow-lg fade-in">
      <button onClick={onBack} className="text-sm text-gray-600 hover:text-blue-600 hover:underline mb-4">&larr; Back</button>
      <h2 className="text-2xl font-bold text-slate-800 text-center mb-6">{text.title}</h2>
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-6 text-sm">
        <div className="flex justify-between"><span>One-Time Yard Reset</span><span className="font-medium text-slate-900">$99.99</span></div>
        <div className="border-t border-slate-300 pt-2 mt-2 flex justify-between text-xl"><span className="font-bold text-slate-900">Total Deposit:</span><span className="font-extrabold text-slate-900">${depositAmount.toFixed(2)}</span></div>
      </div>
      <div className="bg-blue-50 p-4 rounded-lg mb-6 text-sm text-blue-800" dangerouslySetInnerHTML={{ __html: text.whatHappensNextBody }} />
      <form onSubmit={handleSubmit} className="space-y-4">
        <input className="w-full p-3 border rounded" placeholder="Full Name" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
        <input className="w-full p-3 border rounded" type="email" placeholder="Email" required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
        <input className="w-full p-3 border rounded" type="tel" placeholder="Phone" required value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
        <input className="w-full p-3 border rounded" placeholder="Service Address" required value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
        <div className="p-3 border rounded bg-white min-h-[50px]">
          {stripeInstance ? <div id="card-element" /> : <p className="text-gray-400 text-center">Loading Payment System...</p>}
        </div>
        <label className="flex items-start text-xs text-gray-500 gap-2">
          <input type="checkbox" className="mt-1" checked={formData.terms} onChange={e => setFormData({...formData, terms: e.target.checked})} />
          <span>I agree to the Terms of Service & Privacy Policy.</span>
        </label>
        {error && <p className="text-red-600 text-center text-sm">{error}</p>}
        <button disabled={isSubmitting} className="w-full bg-[var(--brand-blue)] text-white font-bold text-lg py-4 rounded-lg hover:bg-opacity-90">
          {isSubmitting ? 'Processing...' : `Pay $${depositAmount.toFixed(2)} Deposit`}
        </button>
      </form>
    </div>
  );
};

const Site = () => {
  const [config, setConfig] = useState(null);
  const [view, setView] = useState('zip'); 
  const [zipCode, setZipCode] = useState('');
  const [yardSize, setYardSize] = useState('standard');
  const [numDogs, setNumDogs] = useState(2); 
  const [dogCountLabel, setDogCountLabel] = useState('1-2'); 
  const [yardPlusSelections, setYardPlusSelections] = useState({});
  const [packageSelection, setPackageSelection] = useState(null); 
  const [paymentSelection, setPaymentSelection] = useState(null); 
  const [isExitModalOpen, setIsExitModalOpen] = useState(false);
  const [stripeInstance, setStripeInstance] = useState(null);
  const [cardElement, setCardElement] = useState(null);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showAlertsModal, setShowAlertsModal] = useState(false);
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [showSatisfactionModal, setShowSatisfactionModal] = useState(false);
  const [isFormSubmitted, setIsFormSubmitted] = useState(false);
  const [configError, setConfigError] = useState(null);
  const [configSource, setConfigSource] = useState('Checking...');

  useEffect(() => {
    const init = async () => {
      let loadedConfig; 
      try {
        let app;
        if (getApps().length > 0) {
           app = getApp(); 
        } else {
           app = initializeApp(firebaseConfig); 
        }
        
        const auth = getAuth(app);
        await signInAnonymously(auth);

        const db = getFirestore(app);
        const docSnap = await getDoc(doc(db, 'config', 'production'));
        if (docSnap.exists()) {
           loadedConfig = docSnap.data();
           setConfigSource('🔥 Live Database');
        }
      } catch (e) { 
          console.error('Offline mode error:', e); 
          setConfigError(e); 
      }
      
      if (!loadedConfig) {
        const res = await fetch('/config.json');
        loadedConfig = await res.json();
        setConfigSource('⚠️ Offline Mode');
      }
      setConfig(loadedConfig);

      const stripeKey = loadedConfig.data.STRIPE_MODE === 'live' 
        ? import.meta.env.VITE_STRIPE_PK_LIVE 
        : (import.meta.env.VITE_STRIPE_PK_TEST || 'pk_test_51SOAayGelkvkkUqXzl9sYTm9SDaWBYSIhzlQMPPxFKvrEn01f3VLimIe59vsEgnJdatB9JTAvNt4GH0n8YTLMYzK00LZXRTnXZ');
      
      await loadScript('https://js.stripe.com/v3/', 'stripe-js');
      if (window.Stripe) {
        const stripe = window.Stripe(stripeKey);
        setStripeInstance(stripe);
        const elements = stripe.elements();
        setCardElement(elements.create('card', { style: { base: { fontSize: '16px' } } }));
      }
    };
    init();
  }, []);

  useEffect(() => {
    if ((view === 'checkout' || view === 'onetime_checkout') && cardElement) {
      const mountPoint = document.getElementById('card-element');
      if (mountPoint) {
        setTimeout(() => { try { cardElement.mount('#card-element'); } catch (e) { if(!e.message.includes('already')) console.error(e); } }, 100);
      }
    }
  }, [view, cardElement]);

  const handleSorter = (size, dogs, label) => {
    setYardSize(size); setNumDogs(dogs); setDogCountLabel(label);
    if (size === 'estate') setView('lead_estate');
    else if (dogs >= 10) setView('lead_kennel');
    else setView('packages');
  };

  if (!config) return <FullPageLoader error={configError} />;

  return (
    <>
      <div className={`fixed bottom-4 left-4 z-[9999] px-4 py-2 rounded-full text-xs font-bold text-white shadow-lg ${configSource.includes('Live') ? 'bg-green-600' : 'bg-red-600'}`}>
        Status: {configSource}
      </div>

      <Header onSatisfactionClick={() => setShowSatisfactionModal(true)} />
      
      <main className="container mx-auto px-4 max-w-xl pb-12">
        {view === 'zip' && <ZipCodeValidator onZipValidated={(z) => { setZipCode(z); setView('sorter'); }} approvedZipCodes={config.data.APPROVED_ZIP_CODES} text={config.text.zipView} />}
        {view === 'sorter' && <Sorter onSortComplete={handleSorter} text={config.text.sorterView} specialOffer={config.text.globals} onBack={() => setView('zip')} lotFees={config.data.lotFees} />}
        {view === 'lead_estate' && <LeadForm title={config.text.customQuoteView.title} description={config.text.customQuoteView.descEstate} zipCode={zipCode} dogCount={dogCountLabel} onBack={() => setView('sorter')} onSubmitSuccess={() => setView('success')} />}
        {view === 'lead_kennel' && <LeadForm title={config.text.customQuoteView.title} description={config.text.customQuoteView.descMultiDog} zipCode={zipCode} dogCount={dogCountLabel} onBack={() => setView('sorter')} onSubmitSuccess={() => setView('success')} />}
        {view === 'packages' && <PackageSelector basePrices={config.data.basePrices} planDetails={config.data.planDetails} yardSize={yardSize} numDogs={numDogs} lotFees={config.data.lotFees} extraDogPrice={config.data.extraDogPrice} yardPlusPrice={config.data.yardPlusPrice} yardPlusSelections={yardPlusSelections} setYardPlusSelections={setYardPlusSelections} text={config.text.packagesView} specialOffer={config.text.globals} onBack={() => setView('sorter')} onPlanSelect={(plan) => { setPackageSelection(plan); setView('payment'); }} onOneTimeClick={() => setView('onetime')} onInfoClick={() => setShowInfoModal(true)} onAlertsInfoClick={() => setShowAlertsModal(true)} />}
        {view === 'payment' && <PaymentPlanSelector packageSelection={packageSelection} quarterlyDiscount={config.data.quarterlyDiscount} text={config.text.paymentPlanView} onPaymentSelect={(p) => { setPaymentSelection(p); setView('checkout'); }} onBack={() => setView('packages')} />}
        {view === 'checkout' && <CheckoutForm packageSelection={packageSelection} paymentSelection={paymentSelection} zipCode={zipCode} dogCount={dogCountLabel} yardSize={yardSize} yardPlusSelected={!!yardPlusSelections[packageSelection.key]} stripeInstance={stripeInstance} cardElement={cardElement} text={config.text.checkoutView} stripeMode={config.data.STRIPE_MODE} onBack={() => setView('payment')} onSubmitSuccess={() => { setIsFormSubmitted(true); setView('success'); }} />}
        {view === 'onetime' && (
            <div className="bg-white p-6 md:p-8 rounded-xl shadow-lg fade-in">
              <button onClick={() => setView('packages')} className="text-sm text-gray-600 hover:text-blue-600 hover:underline mb-4">&larr; Back to Plans</button>
              <h2 className="text-2xl font-bold text-slate-800 text-center mb-4">{config.text.oneTimeView.title}</h2>
              <div className="text-center my-6 py-4 border-y border-gray-200"><span className="text-5xl font-extrabold text-slate-900">$99.99</span><p className="text-sm text-slate-500 mt-1">{config.text.oneTimeView.subTitle}</p></div>
              <p className="text-slate-600 text-center mb-4">{config.text.oneTimeView.description}</p>
              <p className="text-slate-600 text-center text-sm mb-6">{config.text.oneTimeView.estatePrompt} <button onClick={() => { setView('custom_quote'); setYardSize('estate'); }} className="font-bold underline text-blue-600 hover:text-blue-700">{config.text.oneTimeView.estateLinkText}</button>.</p>
              <div className="bg-green-50 border-l-4 border-green-500 text-green-800 p-4 rounded-r-lg mb-6"><p className="font-bold">{config.text.oneTimeView.psTitle}</p><p className="text-sm"><span dangerouslySetInnerHTML={{ __html: config.text.oneTimeView.psBody.replace('{price}', config.data.basePrices.weekly + (config.data.dogFeeMap?.['1-2'] || 0)) }} /> <button onClick={() => setView('packages')} className="font-bold underline ml-1 hover:text-green-600">{config.text.oneTimeView.psLinkText}</button></p></div>
              <button type="button" onClick={() => setView('onetime_checkout')} className="w-full bg-[var(--brand-blue)] text-white font-bold text-lg py-4 rounded-lg hover:bg-opacity-90 shadow-lg">Book One-Time Cleanup</button>
            </div>
        )}
        {view === 'onetime_checkout' && <OneTimeCheckoutForm zipCode={zipCode} dogCount={dogCountLabel} onBack={() => setView('onetime')} onSubmitSuccess={() => { setIsFormSubmitted(true); setView('success'); }} stripeInstance={stripeInstance} cardElement={cardElement} text={config.text.oneTimeCheckoutView} stripeMode={config.data.STRIPE_MODE} />}
        {view === 'success' && (
          <div className="bg-white p-8 rounded-xl shadow-lg text-center fade-in">
            <div className="w-16 h-16 bg-green-100 text-green-600 flex items-center justify-center rounded-full mx-auto mb-4"><svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg></div>
            <h2 className="text-2xl font-bold text-gray-800">All Set!</h2>
            <p className="text-gray-600 mt-2">We've received your info. A team member will contact you shortly!</p>
          </div>
        )}
      </main>

      <Footer text={config.text.footer} />

      {showInfoModal && <ServiceInfoModal onClose={() => setShowInfoModal(false)} text={config.text.modals.serviceInfo} />}
      {showAlertsModal && <AlertsInfoModal onClose={() => setShowAlertsModal(false)} text={config.text.modals.alertsInfo} />}
      {showPricingModal && <PricingInfoModal onClose={() => setShowPricingModal(false)} text={config.text.modals.pricingInfo} />}
      {showSatisfactionModal && <SatisfactionModal onClose={() => setShowSatisfactionModal(false)} text={config.text.modals.satisfactionInfo} />}
      
      {isExitModalOpen && !isFormSubmitted && <ExitIntentModal currentPlan={packageSelection || {}} zipCode={zipCode} yardSize={yardSize} planDetails={config.data.planDetails} text={config.text.modals.exitIntent} onClose={() => setIsExitModalOpen(false)} />}
    </>
  );
};

const GlobalStyles = () => (
  <style dangerouslySetInnerHTML={{ __html: `
    body { font-family: 'Inter', sans-serif; background-color: #f8fafc; background-image: url('https://storage.googleapis.com/msgsndr/YzqccfNpAoMTt4EZO92d/media/68e43822ccdd18bea416654b.png'); background-repeat: repeat; }
    :root { --brand-blue: #00A9E0; --brand-green: #22c55e; }
    @keyframes fadeIn { 0% { opacity: 0; transform: translateY(20px); } 100% { opacity: 1; transform: translateY(0); } }
    .fade-in { animation: fadeIn 0.5s ease-out forwards; }
    .loader { width: 24px; height: 24px; border: 3px solid rgba(0,0,0,0.2); border-top-color: var(--brand-blue); border-radius: 50%; animation: rotation 0.8s linear infinite; }
    @keyframes rotation { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    #card-element { padding: 10px 0; }
    .StripeElement { box-sizing: border-box; height: 40px; padding: 10px 12px; border-radius: 8px; background-color: white; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06); }
    .StripeElement--focus { border-color: #3182ce; box-shadow: 0 0 0 3px rgba(66,153,225,0.5); }
    .StripeElement--invalid { border-color: #fa755a; }
    .StripeElement--webkit-autofill { background-color: #fefde5 !important; }
  `}} />
);

const App = () => (
  <Router>
    <GlobalStyles />
    <Suspense fallback={<FullPageLoader />}>
      <Routes>
        <Route path="/admin" element={<AdminPanel />} />
        <Route path="/" element={<Site />} />
      </Routes>
    </Suspense>
  </Router>
);

export default App;