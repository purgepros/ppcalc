import React, { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth'; 
import { db, auth } from './firebase.js'; 

import AdminPanel from './AdminPanel.jsx';
import LandingPage from './LandingPage.jsx';

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

const trackFbEvent = (eventName, params = {}) => {
  if (window.fbq) {
    window.fbq('track', eventName, params);
  }
};

const PaymentTrustBadge = () => (
  <div className="flex items-center justify-between mt-2 px-1">
    <div className="flex space-x-1 opacity-70 grayscale hover:grayscale-0 transition-all">
      <img src="https://upload.wikimedia.org/wikipedia/commons/5/5e/Visa_Inc._logo.svg" alt="Visa" className="h-5" />
      <img src="https://upload.wikimedia.org/wikipedia/commons/2/2a/Mastercard-logo.svg" alt="Mastercard" className="h-5" />
      <img src="https://upload.wikimedia.org/wikipedia/commons/3/30/American_Express_logo.svg" alt="Amex" className="h-5" />
      <img src="https://upload.wikimedia.org/wikipedia/commons/5/57/Discover_Card_logo.svg" alt="Discover" className="h-5" />
    </div>
    <div className="flex items-center text-[10px] text-gray-400 font-semibold">
      <svg className="w-3 h-3 mr-1 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
      SECURE SSL
    </div>
  </div>
);

// --- Visual Cues ---
const ClickHint = () => (
  <span className="text-[10px] text-blue-500 font-bold ml-1 uppercase tracking-tighter opacity-80 animate-pulse hover:opacity-100 cursor-pointer">
    (Click for Details)
  </span>
);

// --- Modal Components ---

const ModalOverlay = ({ children, onClose }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm fade-in" onClick={onClose}>
    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden relative animate-scaleIn max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
      <button onClick={onClose} className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 z-10 p-2">
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
      </button>
      {children}
    </div>
  </div>
);

const SatisfactionModal = ({ onClose, text }) => (
  <ModalOverlay onClose={onClose}>
    <div className="p-8 text-center">
      <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-green-200">
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
      </div>
      <h3 className="text-2xl font-bold text-slate-800 mb-3">{text?.title || "Satisfaction Guaranteed"}</h3>
      <div className="text-slate-600 mb-6 leading-relaxed" dangerouslySetInnerHTML={{__html: text?.body || "We stand behind our work."}} />
      {text?.footer && <p className="text-sm text-slate-400 font-semibold border-t pt-4">{text.footer}</p>}
      <button onClick={onClose} className="mt-6 w-full bg-[var(--brand-green)] text-white font-bold py-3 rounded-lg hover:opacity-90 transition-all shadow-md">Got it</button>
    </div>
  </ModalOverlay>
);

const YardHelperModal = ({ onClose }) => (
  <ModalOverlay onClose={onClose}>
    <div className="p-8">
      <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center">
        <span className="bg-blue-100 text-blue-600 p-2 rounded-lg mr-3">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
        </span>
        Which size is right?
      </h3>
      <div className="space-y-3 text-sm text-slate-600">
        <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
          <strong className="block text-slate-800 text-base mb-1">Standard Lot (Up to 0.25 Acre)</strong>
          <p>Most common. Typical subdivision home with a standard backyard.</p>
        </div>
        <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
          <strong className="block text-slate-800 text-base mb-1">Medium Lot (0.25 - 0.5 Acre)</strong>
          <p>A bit more elbow room. Often found in older neighborhoods or corner lots.</p>
        </div>
        <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
          <strong className="block text-slate-800 text-base mb-1">Large Lot (0.5 - 1 Acre)</strong>
          <p>Very spacious. Often feels like a double lot.</p>
        </div>
        <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
          <strong className="block text-blue-900 text-base mb-1">Estate / Farm (1+ Acre)</strong>
          <p className="text-blue-800">Massive property, rural land, or large estates. We'll need to give you a custom quote.</p>
        </div>
      </div>
      <button onClick={onClose} className="mt-6 w-full bg-slate-800 text-white font-bold py-3 rounded-lg hover:opacity-90 transition-all">Close</button>
    </div>
  </ModalOverlay>
);

const ServiceInfoModal = ({ onClose, text }) => (
  <ModalOverlay onClose={onClose}>
    <div className="p-8">
      <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center">
        <span className="bg-blue-100 text-blue-600 p-2 rounded-lg mr-3">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </span>
        {text?.title || "Service Info"}
      </h3>
      <div className="space-y-3 text-slate-600 text-sm leading-relaxed">
        {Array.isArray(text?.body) ? text.body.map((p, i) => (
          <p key={i} dangerouslySetInnerHTML={{__html: p}} />
        )) : <p dangerouslySetInnerHTML={{__html: text?.body}} />}
      </div>
      <button onClick={onClose} className="mt-6 w-full bg-slate-100 text-slate-700 font-bold py-3 rounded-lg hover:bg-slate-200 transition-all">Close</button>
    </div>
  </ModalOverlay>
);

const AlertsInfoModal = ({ onClose, text }) => (
  <ModalOverlay onClose={onClose}>
    <div className="p-8">
      <h3 className="text-xl font-bold text-slate-800 mb-4">{text?.title || "Automated Alerts"}</h3>
      <p className="text-slate-600 mb-4 text-sm">{text?.body}</p>
      <ul className="space-y-3">
        {text?.bullets?.map((bullet, i) => (
          <li key={i} className="flex items-start text-sm text-slate-600 bg-slate-50 p-3 rounded-lg">
            <svg className="w-5 h-5 text-blue-500 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            <span dangerouslySetInnerHTML={{__html: bullet}} />
          </li>
        ))}
      </ul>
      <button onClick={onClose} className="mt-6 w-full bg-blue-500 text-white font-bold py-3 rounded-lg hover:bg-blue-600 transition-all">Understood</button>
    </div>
  </ModalOverlay>
);

const PricingInfoModal = ({ onClose, text }) => (
  <ModalOverlay onClose={onClose}>
    <div className="p-8">
      <h3 className="text-xl font-bold text-slate-800 mb-4">{text?.title || "Pricing Info"}</h3>
      <div className="space-y-3 text-slate-600 text-sm mb-4">
        {Array.isArray(text?.body) ? text.body.map((p, i) => <p key={i} dangerouslySetInnerHTML={{__html: p}} />) : <p dangerouslySetInnerHTML={{__html: text?.body}} />}
      </div>
      <div className="bg-slate-100 p-4 rounded-lg mb-4">
        <ul className="space-y-2">
          {text?.bullets?.map((b, i) => (
            <li key={i} className="text-sm text-slate-700 flex items-center">
              <span className="w-2 h-2 bg-slate-400 rounded-full mr-2"></span>
              <span dangerouslySetInnerHTML={{__html: b}} />
            </li>
          ))}
        </ul>
      </div>
      {text?.footer && <p className="text-xs text-slate-400 italic text-center">{text.footer}</p>}
      <button onClick={onClose} className="mt-6 w-full bg-slate-800 text-white font-bold py-3 rounded-lg hover:opacity-90 transition-all">Close</button>
    </div>
  </ModalOverlay>
);

const SavingsInfoModal = ({ onClose }) => (
  <ModalOverlay onClose={onClose}>
    <div className="p-8">
      <div className="flex items-center mb-4">
        <div className="bg-green-100 p-2 rounded-full mr-3 text-green-600">
           <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </div>
        <h3 className="text-xl font-bold text-slate-800">Your Savings Explained</h3>
      </div>
      <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
        <p>The <strong className="text-green-700">OVER $99.99</strong> savings figure comes from our Free First Cleanup guarantee.</p>
        <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
          <p className="mb-2">A one-time cleanup typically costs <strong>$150 to $300+</strong> depending on accumulation.</p>
          <p>With a subscription, we waive this fee <strong className="text-slate-900">100%</strong>.</p>
          <p className="mt-2 text-xs text-slate-500">Plus, any seasonal promotions (like 50% off) are added on top of this value!</p>
        </div>
      </div>
      <button onClick={onClose} className="mt-6 w-full bg-slate-800 text-white font-bold py-3 rounded-lg hover:opacity-90 transition-all">Got it</button>
    </div>
  </ModalOverlay>
);

const TermsCheckbox = ({ checked, onChange, isSubscription }) => (
  <label className="flex items-start text-xs text-gray-500 gap-2 cursor-pointer mt-2">
    <input 
      type="checkbox" 
      className="mt-1 rounded border-gray-300 text-[var(--brand-green)] focus:ring-[var(--brand-green)]" 
      checked={checked} 
      onChange={(e) => onChange(e.target.checked)} 
    />
    <span>
      I agree to the{' '}
      <a href="https://itspurgepros.com/terms-conditions" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-800">Terms of Service</a>
      {' '}&{' '}
      <a href="https://itspurgepros.com/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-800">Privacy Policy</a>
      {isSubscription ? ', and I authorize Purge Pros to charge my payment method for future subscription renewals (Cancel Anytime).' : '.'}
    </span>
  </label>
);

// --- Components ---

const FullPageLoader = ({ error = null }) => (
  <div className="flex flex-col items-center justify-center min-h-[300px]">
    {error ? (
      <div className="max-w-lg w-full bg-red-100 border-l-4 border-red-500 text-red-700 p-6 rounded-lg shadow-md">
        <h3 className="font-bold text-lg mb-2">Application Error</h3>
        <p className="mb-4">Could not load application configuration.</p>
        <pre className="text-sm bg-red-50 p-2 rounded overflow-auto">{error.message || String(error)}</pre>
      </div>
    ) : (
      <span className="loader"></span>
    )}
  </div>
);

const SpecialOfferBox = ({ offer, promotions, onLearnMoreClick }) => {
  if (!offer) return null;
  
  // Always active look as requested
  return (
    <div className="bg-green-50 border-2 border-green-500 p-5 rounded-xl mb-6 shadow-sm relative overflow-hidden group transform transition-transform hover:scale-[1.01]">
      <div className="absolute top-0 right-0 bg-green-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-lg uppercase tracking-wider shadow-sm">
        ✓ ACTIVATED
      </div>
      <div className="flex items-start space-x-4">
        <div className="flex-shrink-0 bg-white p-3 rounded-full text-green-600 shadow-sm border border-green-100">
           <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
        </div>
        <div>
          <h3 className="text-lg font-extrabold text-slate-800 uppercase tracking-tight mb-1">{offer.specialOfferTitle}</h3>
          <div className="text-slate-600 text-sm leading-relaxed space-y-1" dangerouslySetInnerHTML={{ __html: offer.specialOfferBody }} />
          
          <div className="mt-2">
              <button 
                  onClick={onLearnMoreClick}
                  className="text-sm font-bold text-green-700 hover:text-green-800 underline flex items-center cursor-pointer transition-colors"
              >
                  ℹ️ See Offer Details
              </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const Header = ({ onSatisfactionClick }) => (
  <header className="py-6 text-center">
    <div className="container mx-auto px-4 flex flex-col items-center justify-center">
      <a href="https://itspurgepros.com/" className="transition-all hover:opacity-80 hover:scale-105 mb-6">
        <img src="https://storage.googleapis.com/msgsndr/YzqccfNpAoMTt4EZO92d/media/68140f6288b94e80fb043618.png" alt="Purge Pros Logo" className="h-32 md:h-40" />
      </a>
      <button 
        onClick={onSatisfactionClick}
        className="group relative flex items-center bg-white rounded-full shadow-md border border-slate-200 px-5 py-2 transition-transform hover:scale-105 hover:shadow-lg active:scale-95 cursor-pointer"
      >
        <div className="absolute inset-0 border-2 border-transparent group-hover:border-[var(--brand-green)]/30 rounded-full transition-all"></div>
        <div className="flex-shrink-0 mr-3 text-[var(--brand-green)]">
           <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
             <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
           </svg>
        </div>
        <div className="text-left flex flex-col">
          <span className="text-[10px] uppercase tracking-widest font-bold text-slate-400 leading-none mb-0.5">Purge Pros Promise</span>
          <span className="text-sm font-bold text-slate-800 group-hover:text-[var(--brand-blue)] transition-colors">100% Satisfaction Guaranteed</span>
        </div>
        <div className="ml-3 text-blue-500 bg-white rounded-full p-0.5 shadow-sm">
           <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
        </div>
        <div className="ml-2">
            <span className="text-[10px] text-blue-500 font-bold uppercase tracking-tighter opacity-90 animate-pulse hover:opacity-100">
                (Click for Details)
            </span>
        </div>
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

// --- UPDATED SORTER COMPONENT WITH COUPON VALIDATION ---
const Sorter = ({ onSortComplete, onBack, initialYardSize, initialDogCount, text, specialOffer, lotFees, onYardHelperClick, promotions, onLearnMoreClick, stripeMode }) => {
  const [yardSize, setYardSize] = useState(initialYardSize || 'standard');
  const [dogCount, setDogCount] = useState(initialDogCount || '1'); 
  const [phone, setPhone] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [couponStatus, setCouponStatus] = useState(null); // null, 'loading', 'valid', 'invalid'
  const [couponDetails, setCouponDetails] = useState(null);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState('');

  const getDogNumber = (val) => {
    if (val === '10+') return 10;
    return parseInt(val, 10);
  };

  const validateCoupon = async () => {
    if (!couponCode.trim()) {
        setCouponStatus(null);
        setCouponDetails(null);
        return;
    }
    setCouponStatus('loading');
    try {
        const res = await fetch('/.netlify/functions/validate-coupon', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ couponCode: couponCode.trim(), stripeMode })
        });
        const data = await res.json();
        
        if (data.valid) {
            setCouponStatus('valid');
            setCouponDetails(data.details);
        } else {
            setCouponStatus('invalid');
            setCouponDetails(null);
        }
    } catch (e) {
        console.error(e);
        setCouponStatus('invalid');
        setCouponDetails(null);
    }
  };

  const handleSubmit = () => {
    // 1. Validate Phone Number (Basic Regex for 10 digits)
    const phoneRegex = /^\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$/;
    if (!phone || !phoneRegex.test(phone)) {
        setError('Please enter a valid 10-digit phone number.');
        return;
    }
    if (!consent) {
        setError('Please agree to receive communications to proceed.');
        return;
    }
    setError('');
    const numDogs = getDogNumber(dogCount);
    // Pass the confirmed coupon details forward
    onSortComplete(yardSize, numDogs, dogCount, phone, consent, couponCode, couponDetails);
  };

  return (
    <div className="bg-white p-8 rounded-xl shadow-lg fade-in">
      
      {/* Moved Special Offer Box to Top */}
      <SpecialOfferBox offer={specialOffer} promotions={promotions} onLearnMoreClick={onLearnMoreClick} />

      {/* --- UPDATED COUPON FIELD --- */}
      <div className="mb-6 mt-6">
        <label className="block text-sm font-medium text-gray-700 mb-1">Have a Coupon Code?</label>
        <div className="flex gap-2">
            <input 
                type="text" 
                placeholder="Enter Code (Optional)"
                value={couponCode}
                onChange={(e) => { setCouponCode(e.target.value); setCouponStatus(null); }}
                onBlur={validateCoupon}
                className={`flex-grow p-3 border-2 rounded-lg outline-none transition-colors ${
                    couponStatus === 'invalid' ? 'border-red-300 bg-red-50' : 
                    (couponStatus === 'valid' ? 'border-green-300 bg-green-50' : 'border-gray-200 focus:border-blue-500')
                }`}
            />
            <button 
                onClick={validateCoupon}
                className="bg-gray-100 text-gray-600 font-bold px-4 rounded-lg hover:bg-gray-200 transition-colors text-sm"
                type="button"
            >
                {couponStatus === 'loading' ? '...' : 'Apply'}
            </button>
        </div>
        {couponStatus === 'valid' && couponDetails && (
            <p className="text-xs text-green-600 font-bold mt-1 animate-pulse">
                ✅ Coupon Applied: {couponDetails.percent_off ? `${couponDetails.percent_off}% OFF` : `-$${(couponDetails.amount_off/100).toFixed(2)}`}
            </p>
        )}
        {couponStatus === 'invalid' && (
            <p className="text-xs text-red-500 font-bold mt-1">❌ Invalid Coupon Code</p>
        )}
      </div>

      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
            <h2 className="text-xl font-bold text-slate-800">{text?.yardTitle || "1. Property Size?"}</h2>
            <button onClick={onYardHelperClick} className="text-xs text-blue-600 underline hover:text-blue-800 flex items-center">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Not sure?
            </button>
        </div>
        
        <select 
            value={yardSize} 
            onChange={(e) => setYardSize(e.target.value)} 
            className="w-full p-4 border-2 border-gray-300 rounded-lg text-lg bg-white cursor-pointer hover:border-blue-400 transition-colors focus:border-blue-500 outline-none appearance-none"
            style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: `right 0.5rem center`, backgroundRepeat: `no-repeat`, backgroundSize: `1.5em 1.5em`, paddingRight: '2.5rem' }}
        >
          <option value="standard">Standard Lot (Up to 1/4 Acre)</option>
          <option value="tier1">Medium Lot (1/4 - 1/2 Acre)</option>
          <option value="tier2">Large Lot (1/2 - 1 Acre)</option>
          <option value="estate">Estate / Farm (Over 1 Acre)</option>
        </select>
      </div>

      <div className="mb-8">
        <h2 className="text-xl font-bold text-slate-800 mb-2">{text?.dogTitle || "2. How many dogs?"}</h2>
        <select 
            value={dogCount} 
            onChange={(e) => setDogCount(e.target.value)} 
            className="w-full p-4 border-2 border-gray-300 rounded-lg text-lg bg-white cursor-pointer hover:border-blue-400 transition-colors focus:border-blue-500 outline-none appearance-none"
            style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: `right 0.5rem center`, backgroundRepeat: `no-repeat`, backgroundSize: `1.5em 1.5em`, paddingRight: '2.5rem' }}
        >
          <option value="1">1 Dog</option>
          <option value="2">2 Dogs</option>
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

      {/* Phone & Consent Section */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
         <h3 className="font-bold text-gray-800 mb-3">Your Contact Info</h3>
         <input 
            type="tel" 
            placeholder="Mobile Phone Number (Required)"
            className="w-full p-3 border rounded mb-3"
            value={phone}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, '');
              if (val.length <= 10) setPhone(val);
            }}
         />
         <label className="flex items-start gap-2 text-xs text-gray-600 cursor-pointer">
            <input 
                type="checkbox" 
                className="mt-1"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
            />
            <span>
                By providing my phone number, I agree to receive calls and text messages from Purge Pros, including for marketing purposes. Messaging frequency varies and message and data rate may apply. You may reply STOP to opt out. By checking this box I agree to our <a href="https://itspurgepros.com/privacy-policy" target="_blank" className="text-blue-600 underline">Privacy Policy</a>.
            </span>
         </label>
      </div>

      {error && <p className="text-red-600 font-bold text-center mb-4">{error}</p>}

      <button onClick={handleSubmit} className="w-full bg-[var(--brand-green)] text-white font-bold text-lg py-4 rounded-lg hover:bg-opacity-90 shadow-lg transition-transform hover:-translate-y-0.5">
        See My Price
      </button>
      
      <button onClick={onBack} className="w-full text-center text-sm text-gray-600 hover:text-blue-600 hover:underline mt-4">
        &larr; Change Zip Code
      </button>
    </div>
  );
};

// --- UPDATED PACKAGE SELECTOR ---
const PackageSelector = ({ 
  basePrices, planDetails, 
  yardSize, numDogs, 
  lotFees, extraDogPrice, yardPlusPrice,
  onPlanSelect, onBack, onOneTimeClick, 
  onInfoClick, onAlertsInfoClick, 
  text, specialOffer, 
  yardPlusSelections, setYardPlusSelections,
  promotions, onLearnMoreClick, couponDetails
}) => {

  const fees = lotFees || { tier1: 30, tier2: 60 };
  const prices = basePrices || { weekly: 109, biWeekly: 89, twiceWeekly: 169 };
  const detailsMap = planDetails || {
    biWeekly: { name: "Bi-Weekly Reset",HP: "biWeekly", frequency: "Every 2 Weeks", features: ["Backyard Coverage", "Waste Hauled Away"] },
    weekly: { name: "Pristine-Clean", priceKey: "weekly", frequency: "Every Week", features: ["Backyard Coverage", "Waste Hauled Away"] },
    twiceWeekly: { name: "Pristine-Plus", priceKey: "twiceWeekly", frequency: "2x Per Week", features: ["Yard+ Coverage", "Waste Hauled Away"] }
  };
  const eDogPrice = extraDogPrice || 15;
  const yPlusPrice = yardPlusPrice || 20;

  // Manual Coupon Override Logic
  const isPromoActive = couponDetails ? true : (promotions?.isActive || false);
  
  const promoBannerText = couponDetails 
    ? `Coupon Applied: <strong>${couponDetails.percent_off ? `${couponDetails.percent_off}% OFF` : `-$${(couponDetails.amount_off/100).toFixed(2)}`}</strong>` 
    : (promotions?.bannerText || "50% Off First Month!");

  let lotFee = 0;
  if (yardSize === 'tier1') lotFee = fees.tier1 || 0;
  if (yardSize === 'tier2') lotFee = fees.tier2 || 0;

  let dogFee = 0;
  if (numDogs > 1) {
    dogFee = (numDogs - 1) * eDogPrice;
  }

  const showBiWeekly = numDogs <= 2;
  const showWeekly = numDogs <= 5;

  const handleToggle = (planKey) => {
    setYardPlusSelections(prev => ({ ...prev, [planKey]: !prev[planKey] }));
  };

  const plans = [];
  const buildPlan = (key, isPopular) => {
    const details = detailsMap[key];
    if (!details) return null;

    const base = prices[details.priceKey] || 99;
    const isIncluded = key === 'twiceWeekly';
    const isSelected = !!yardPlusSelections[key];
    const addonCost = (isSelected && !isIncluded) ? yPlusPrice : 0;

    const finalPrice = base + lotFee + dogFee + addonCost;
    
    // --- Display Price Calculation ---
    let displayPrice = finalPrice;
    if (isPromoActive) {
        if (couponDetails) {
            if (couponDetails.percent_off) {
                displayPrice = finalPrice * (1 - (couponDetails.percent_off / 100));
            } else if (couponDetails.amount_off) {
                displayPrice = Math.max(0, finalPrice - (couponDetails.amount_off / 100));
            }
        } else {
            // Default global promo (50% off)
            displayPrice = finalPrice / 2;
        }
    }
    
    let divisor = 1;
    if (key === 'biWeekly') divisor = 2.17;
    if (key === 'weekly') divisor = 4.33; 
    if (key === 'twiceWeekly') divisor = 8.66;
    
    const perVisitPrice = (finalPrice / divisor).toFixed(2);

    const featuredFreeFeatures = [];
    const standardFeatures = [];
    const excludedFeatures = [];
    
    const perkKeywords = ["Seasonal Sanitation", "Treato Drop", "Waste Hauled Away", "Yard+ Coverage"];

    if (details.features && Array.isArray(details.features)) {
        details.features.forEach(feature => {
            const isExcluded = feature.startsWith('!');
            const cleanText = isExcluded ? feature.substring(1) : feature;
            const isFree = cleanText.toUpperCase().includes('FREE') || perkKeywords.some(k => cleanText.includes(k));
            
            if (isExcluded) {
                excludedFeatures.push(cleanText);
            } else if (isFree) {
                featuredFreeFeatures.push(cleanText);
            } else {
                standardFeatures.push(cleanText);
            }
        });
    }

    const renderFeatureText = (text) => {
      if (text.includes('\n')) {
        const [main, sub] = text.split('\n');
        return (
          <span>
            {main}
            <br />
            <span className="text-xs font-medium opacity-90" dangerouslySetInnerHTML={{__html: sub.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}} />
          </span>
        );
      }
      return text;
    }

    return {
      key,
      name: details.name,
      serviceTitle: details.serviceTitle || details.name,
      serviceSubTitle: details.serviceSubTitle || details.frequency,
      frequency: details.frequency,
      featuredFreeFeatures,
      standardFeatures,
      excludedFeatures,
      finalPrice, 
      displayPrice: displayPrice.toFixed(2),
      perVisitPrice, 
      isPromoActive,
      basePrice: base,
      popular: isPopular,
      limited: key === 'biWeekly',
      canToggleYardPlus: !isIncluded, 
      isYardPlusIncluded: isIncluded,
      renderFeatureText
    };
  };

  if (showBiWeekly) {
    const p1 = buildPlan('biWeekly', false);
    if (p1) plans.push(p1);
  }
  if (showWeekly) {
    const p2 = buildPlan('weekly', true);
    if (p2) plans.push(p2);
  }
  const p3 = buildPlan('twiceWeekly', !showWeekly);
  if (p3) plans.push(p3);

  // --- Theme Helper ---
  const getTheme = (key) => {
    if (key === 'biWeekly') return {
        card: 'border-2 border-yellow-400 shadow-xl hover:shadow-2xl hover:-translate-y-1',
        header: 'bg-yellow-50 text-yellow-900 border-b border-yellow-100',
        badge: 'bg-yellow-400 text-yellow-900 font-extrabold',
        badgeText: 'LIMITED AVAILABILITY',
        priceColor: 'text-yellow-900',
        subTitleColor: 'text-yellow-700/80',
        checkIcon: 'text-yellow-500',
        button: 'bg-yellow-500 hover:bg-yellow-600 text-white shadow-md shadow-yellow-200'
    };
    if (key === 'weekly') return {
        card: 'border-4 border-[#38b6ff] shadow-[0_20px_50px_rgba(56,182,255,0.25)] scale-[1.02] md:scale-105 z-10 transform transition-all duration-300 hover:-translate-y-2 relative',
        header: 'bg-[#38b6ff] text-white',
        badge: 'bg-green-500 text-white font-extrabold shadow-md animate-pulse',
        badgeText: 'MOST POPULAR • BEST VALUE',
        priceColor: 'text-white',
        subTitleColor: 'text-blue-100',
        checkIcon: 'text-[#38b6ff]',
        button: 'bg-[#38b6ff] hover:bg-[#2ea0e6] text-white shadow-xl shadow-blue-200 transform hover:scale-105'
    };
    // Twice Weekly
    return {
        card: 'border-2 border-slate-900 shadow-xl hover:shadow-2xl hover:-translate-y-1',
        header: 'bg-slate-900 text-white',
        badge: 'bg-slate-600 text-white font-bold',
        badgeText: 'PREMIUM SERVICE',
        priceColor: 'text-white',
        subTitleColor: 'text-slate-400',
        checkIcon: 'text-slate-800',
        button: 'bg-slate-800 hover:bg-slate-700 text-white shadow-md'
    };
  };

  return (
    <div className="bg-slate-50 p-6 md:p-8 rounded-xl shadow-inner fade-in min-h-[600px]">
      <div className="max-w-2xl mx-auto">
        <button onClick={onBack} className="text-sm text-gray-600 hover:text-blue-600 hover:underline mb-4 flex items-center">
            <span className="mr-1">&larr;</span> Back
        </button>
        <h2 className="text-3xl font-extrabold text-slate-800 text-center mb-2">{text?.title || "Choose Your Plan"}</h2>
        <p className="text-center text-slate-500 mb-8 font-medium">Select the cleaning frequency that fits your life.</p>

        {isPromoActive ? (
            <div className="bg-gradient-to-r from-red-500 to-red-600 text-white text-center p-4 rounded-xl mb-8 shadow-lg animate-pulse transform hover:scale-[1.01] transition-transform">
            <h3 className="text-lg font-bold uppercase tracking-wider flex items-center justify-center">
                <span className="mr-2">🔥</span> Special Offer Unlocked <span className="ml-2">🔥</span>
            </h3>
            <div 
                className="text-sm font-medium opacity-90 leading-relaxed mt-1" 
                dangerouslySetInnerHTML={{ __html: promoBannerText }} 
            />
            </div>
        ) : (
            <SpecialOfferBox offer={specialOffer} onLearnMoreClick={onLearnMoreClick} />
        )}

        <div className="space-y-8 md:space-y-10">
            {plans.map((plan) => {
                const theme = getTheme(plan.key);
                return (
                    <div key={plan.key} className={`rounded-2xl bg-white relative ${theme.card}`}>
                        
                        {/* --- CARD HEADER --- */}
                        <div className={`p-6 text-center relative rounded-t-2xl ${theme.header}`}>
                            {theme.badgeText && (
                                <div className={`absolute -top-3 left-1/2 transform -translate-x-1/2 px-4 py-1 rounded-full text-xs tracking-wider shadow-sm uppercase ${theme.badge}`}>
                                    {theme.badgeText}
                                </div>
                            )}
                            
                            <h3 className="text-2xl font-bold mt-2">{plan.name}</h3>
                            <p className={`text-xs font-bold uppercase tracking-widest mt-1 mb-4 ${theme.subTitleColor}`}>{plan.serviceSubTitle}</p>
                            
                            <div className="flex flex-col items-center justify-center">
                                {plan.isPromoActive ? (
                                    <>
                                        <span className={`text-lg line-through opacity-60 decoration-current`}>${plan.finalPrice}</span>
                                        <div className="flex items-baseline">
                                            <span className={`text-5xl font-extrabold tracking-tight ${plan.key === 'weekly' ? 'text-white' : 'text-red-600'}`}>${plan.displayPrice}</span>
                                            <span className={`text-sm font-medium ml-1 opacity-80`}>/ first mo</span>
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex items-baseline">
                                        <span className={`text-5xl font-extrabold tracking-tight ${theme.priceColor}`}>${plan.finalPrice}</span>
                                        <span className={`text-sm font-medium ml-1 opacity-80`}>/ mo</span>
                                    </div>
                                )}
                            </div>
                            
                            {/* Per Visit Pill */}
                            <div className={`inline-block mt-3 px-3 py-1 rounded-full text-xs font-bold ${plan.key === 'weekly' || plan.key === 'twiceWeekly' ? 'bg-white/20 text-white' : 'bg-slate-900/10 text-slate-700'}`}>
                                Just ${plan.perVisitPrice} / visit
                            </div>
                        </div>

                        {/* --- CARD BODY --- */}
                        <div className="p-6">
                            
                            {/* Feature Highlights */}
                            <div className="space-y-3 mb-6">
                                {plan.featuredFreeFeatures.map((feature, idx) => (
                                    <div key={idx} className="flex items-start">
                                        <div className="flex-shrink-0 mt-0.5">
                                            <svg className={`w-5 h-5 ${theme.checkIcon}`} fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
                                        </div>
                                        <div className="ml-3 text-sm text-slate-700 font-bold w-full">
                                            <span className="leading-tight">{plan.renderFeatureText(feature)}</span>
                                            {(feature.includes('Seasonal Sanitation')) && (
                                                <span className="inline-flex items-center align-middle ml-2">
                                                    <button onClick={onInfoClick} className="text-blue-500 hover:text-blue-700"><svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg></button>
                                                    <button onClick={onInfoClick}><ClickHint/></button>
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                {yardPlusSelections[plan.key] && !plan.isYardPlusIncluded && (
                                    <div className="flex items-start bg-blue-50 p-2 rounded-lg border border-blue-100">
                                        <div className="flex-shrink-0 mt-0.5"><svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg></div>
                                        <div className="ml-3 text-sm text-blue-800 font-bold">Includes Yard+ Coverage (+${yPlusPrice}/mo.)</div>
                                    </div>
                                )}
                            </div>

                            {/* Standard Features */}
                            <ul className="space-y-3 mb-8 border-t border-slate-100 pt-4">
                                <li className="flex items-start text-sm text-slate-600">
                                    <svg className="w-5 h-5 text-slate-300 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                                    <span>Service for <strong>up to {numDogs} Dogs</strong></span>
                                </li>
                                {plan.standardFeatures.map((feat, i) => (
                                    <li key={i} className="flex items-start text-sm text-slate-600">
                                        <svg className="w-5 h-5 text-slate-300 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                                        <div className="flex-grow">
                                            {plan.renderFeatureText(feat)}
                                            {(feat.includes('Automated Reminders')) && (
                                                <span className="inline-flex items-center align-middle ml-1">
                                                    <button onClick={onAlertsInfoClick} className="text-slate-400 hover:text-blue-500"><svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg></button>
                                                    <button onClick={onAlertsInfoClick}><ClickHint/></button>
                                                </span>
                                            )}
                                        </div>
                                    </li>
                                ))}
                                {plan.excludedFeatures.map((feat, i) => (
                                    <li key={`ex-${i}`} className="flex items-start text-sm text-slate-400 line-through decoration-slate-300 opacity-60">
                                        <div className="relative flex-shrink-0 mr-3">
                                            <svg className="w-5 h-5 text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                        </div>
                                        <span>{plan.renderFeatureText(feat)}</span>
                                    </li>
                                ))}
                            </ul>

                            {plan.canToggleYardPlus && (
                                <label className="flex items-center justify-between p-3 bg-slate-50 rounded-lg mb-6 cursor-pointer border border-slate-200 hover:bg-slate-100 hover:border-blue-300 transition-colors group">
                                    <span className="text-xs font-bold text-slate-600 group-hover:text-blue-800">Add Yard+ Coverage (Front & Side Yards) (+${yPlusPrice}/mo.)</span>
                                    <input 
                                        type="checkbox" 
                                        className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 border-gray-300"
                                        checked={!!yardPlusSelections[plan.key]} 
                                        onChange={() => handleToggle(plan.key)} 
                                    />
                                </label>
                            )}

                            <button onClick={() => onPlanSelect(plan.name, plan.finalPrice, plan.key)} className={`w-full font-bold py-4 rounded-xl transition-all ${theme.button}`}>
                                Select {plan.name}
                            </button>
                        </div>
                    </div>
                );
            })}
        </div>

        <button type="button" onClick={onOneTimeClick} className="block w-full text-center text-sm text-gray-500 hover:text-blue-600 hover:underline mt-10 cursor-pointer font-medium">
            {text?.oneTimeLink || "Looking for a One-Time Cleanup? Click Here"}
        </button>
      </div>
    </div>
  );
};

// --- UPDATED CHECKOUT FORM ---
const CheckoutForm = ({ packageSelection, initialPaymentSelection, zipCode, dogCount, yardSize, onBack, onSubmitSuccess, stripeInstance, cardElement, text, stripeMode, yardPlusSelected, configData, onSavingsInfoClick, promotions, quarterlyDiscount, onRiskFreeInfoClick, phoneFromSorter, couponFromSorter, couponDetails }) => {
  const [formData, setFormData] = useState({ 
      name: '', email: '', phone: phoneFromSorter || '', 
      address: '', city: '', state: 'IN', 
      dogName: '', source: '', comments: '',
      agreed: false 
  });
  const [cardNow, setCardNow] = useState(false); // Toggle for Card Now vs Later
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  const [paymentSelection, setPaymentSelection] = useState(initialPaymentSelection);

  const monthly = packageSelection.finalMonthlyPrice;
  const qDisc = quarterlyDiscount || 30;
  const isGlobalPromo = promotions?.isActive || false;
  
  // Calculate discount value
  let firstMonthDiscount = 0;
  let promoText = "";

  if (couponDetails) {
      // Manual Coupon Logic
      if (couponDetails.percent_off) {
          firstMonthDiscount = monthly * (couponDetails.percent_off / 100);
          promoText = `Coupon (${couponDetails.percent_off}% Off)`;
      } else if (couponDetails.amount_off) {
          firstMonthDiscount = couponDetails.amount_off / 100;
          promoText = `Coupon (-$${(couponDetails.amount_off/100).toFixed(2)})`;
      }
  } else if (isGlobalPromo) {
      // Global Logic
      firstMonthDiscount = monthly / 2;
      promoText = "Trial Offer (50% Off)";
  }

  // --- RECALCULATE PRICING BASED ON MANUAL COUPON IF PRESENT ---
  useEffect(() => {
      const discounted = Math.max(0, monthly - firstMonthDiscount);
      setPaymentSelection(prev => ({
          ...prev,
          total: prev.term === 'Monthly' ? discounted : prev.total, // Only apply discount to first month charge
          savingsText: promoText,
          isPromo: !!firstMonthDiscount
      }));
  }, [monthly, firstMonthDiscount]);

  const totalDue = paymentSelection.term === 'Monthly' ? Math.max(0, monthly - firstMonthDiscount) : paymentSelection.total;
  
  // Savings Display logic
  const isPromoApplied = paymentSelection.isPromo;
  const promoSavings = isPromoApplied ? firstMonthDiscount : 0;
  const totalSavings = 99.99 + paymentSelection.savingsValue + promoSavings;

  const getBreakdown = () => {
    if (!configData) return { base: 0, lot: 0, dog: 0, yardPlus: 0 };
    const prices = configData.basePrices;
    const fees = configData.lotFees || { tier1: 30, tier2: 60 };
    const eDogPrice = configData.extraDogPrice || 15;
    const yPlusPrice = configData.yardPlusPrice || 20;
    const details = configData.planDetails[packageSelection.key];
    const baseRate = prices[details.priceKey] || 0;
    
    let lotFee = 0;
    if (yardSize === 'tier1') lotFee = fees.tier1 || 0;
    if (yardSize === 'tier2') lotFee = fees.tier2 || 0;

    const numDogs = dogCount === '10+' ? 10 : parseInt(dogCount);
    let dogFee = 0;
    if (numDogs > 1) {
        dogFee = (numDogs - 1) * eDogPrice;
    }

    const yardPlusCost = (yardPlusSelected && packageSelection.key !== 'twiceWeekly') ? yPlusPrice : 0;
    const yardPlusStatus = (packageSelection.key === 'twiceWeekly') ? 'Included' : (yardPlusSelected ? `$${yPlusPrice}` : 'Not Selected');

    let effectiveMonthly = monthly; 
    if (paymentSelection.term === 'Quarterly') {
        effectiveMonthly = ((monthly * 3) - (quarterlyDiscount || 30)) / 3;
    } else if (paymentSelection.term === 'Annual') {
        effectiveMonthly = (monthly * 11) / 12;
    }

    let perVisit = 0;
    if (packageSelection.key === 'weekly') perVisit = effectiveMonthly / 4.33;
    else if (packageSelection.key === 'biWeekly') perVisit = effectiveMonthly / 2.17;
    else if (packageSelection.key === 'twiceWeekly') perVisit = effectiveMonthly / 8.66;

    return { baseRate, lotFee, dogFee, yardPlusCost, yardPlusStatus, numDogs, details, perVisit };
  };

  const bd = getBreakdown();

  // FIX: Force mount Stripe Element when container becomes visible
  useEffect(() => {
    if (cardNow && cardElement) {
        setTimeout(() => {
            try {
                cardElement.mount('#card-element');
            } catch (e) {
                console.log("Element already mounted");
            }
        }, 50);
    }
  }, [cardNow, cardElement]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.agreed) { setError('Please agree to the terms and authorization.'); return; }
    // Only require Stripe Element if "Card Now" is selected
    if (cardNow && (!stripeInstance || !cardElement)) { setError('Payment system not ready. Please wait or refresh.'); return; }
    
    setIsSubmitting(true);
    setError('');

    const yardSizeLabels = {
      'standard': 'Standard (Up to 1/4 Acre)',
      'tier1': 'Medium (1/4 - 1/2 Acre)',
      'tier2': 'Large (1/2 - 1 Acre)',
      'estate': 'Estate (Over 1 Acre)'
    };
    const readableYardSize = yardSizeLabels[yardSize] || yardSize;

    try {
      let paymentMethodId = null;

      if (cardNow) {
          const { error: stripeError, paymentMethod } = await stripeInstance.createPaymentMethod({
            type: 'card',
            card: cardElement,
            billing_details: { name: formData.name, email: formData.email, phone: formData.phone, address: { line1: formData.address, city: formData.city, state: formData.state, postal_code: zipCode } }
          });
          if (stripeError) throw new Error(stripeError.message);
          paymentMethodId = paymentMethod.id;
      }

      let termDiscountRow = '';
      let termNoun = 'Month'; 

      // Update discount row for email based on active promo
      if (firstMonthDiscount > 0) {
         termDiscountRow = `<div style="display: flex; justify-content: space-between; margin-bottom: 8px;"><span style="color: #DC2626; font-weight: bold;">${promoText}</span><span style="font-weight: bold; color: #DC2626;">-$${firstMonthDiscount.toFixed(2)}</span></div>`;
      } else if (paymentSelection.term === 'Quarterly') {
        termDiscountRow = `<div style="display: flex; justify-content: space-between; margin-bottom: 8px;"><span style="color: #166534;">Quarterly Discount</span><span style="font-weight: bold; color: #166534;">-$30.00</span></div>`;
        termNoun = 'Quarter';
      } else if (paymentSelection.term === 'Annual') {
        termDiscountRow = `<div style="display: flex; justify-content: space-between; margin-bottom: 8px;"><span style="color: #166534;">Annual Discount (1 Month Free)</span><span style="font-weight: bold; color: #166534;">-$${monthly.toFixed(2)}</span></div>`;
        termNoun = 'Year';
      }

      // Determine Coupon ID (Manual > Global)
      const finalCouponCode = couponDetails ? couponDetails.id : (isGlobalPromo ? (stripeMode === 'live' ? promotions?.couponIdLive : promotions?.couponIdTest) : null);

      const payload = {
        stripeMode,
        paymentMethodId: paymentMethodId, // Null if "Card Later"
        cardOption: cardNow ? 'now' : 'later',
        customer: { ...formData, terms: true, auth: true },
        quote: { zipCode, dogCount, planName: packageSelection.name, planKey: packageSelection.key, paymentTerm: paymentSelection.term, totalDueToday: totalDue, yardSize, yardPlusSelected },
        leadData: { ...formData, zip: zipCode, dog_count: dogCount, plan: packageSelection.name, total: totalDue, term: paymentSelection.term, yard_size: readableYardSize },
        promo: {
            applied: !!finalCouponCode,
            couponId: finalCouponCode
        },
        emailParams: { 
          name: formData.name || 'Valued Customer',
          email: formData.email || '',
          phone: formData.phone || '',
          address: formData.address || '',
          city: formData.city || '',
          state: formData.state || '',
          dog_name: formData.dogName || '',
          source: formData.source || '',
          comments: formData.comments || '',
          plan: packageSelection.name || 'Standard Plan', 
          payment_term: paymentSelection.term || 'Monthly',
          term_noun: termNoun,
          total_monthly: `$${monthly.toFixed(2)}/mo`, 
          per_visit: `$${bd.perVisit.toFixed(2)}`,
          final_charge: cardNow ? `$${totalDue.toFixed(2)}` : '$0.00 (Due Later)',
          initial_savings: "99.99",
          total_savings: totalSavings.toFixed(2),
          term_discount_row: termDiscountRow || '',
          term_savings_row: '',
          yard_plus_status: yardPlusSelected ? "Included" : "Not Selected",
          zip: zipCode || '',
          dog_count: dogCount || '',
          yard_size: readableYardSize
        }
      };

      const res = await fetch('/.netlify/functions/create-stripe-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok || data.status !== 'success') throw new Error(data.message || 'Payment failed.');
      
      // Only track purchase if they actually paid
      if (cardNow) {
          trackFbEvent('Purchase', { value: totalDue, currency: 'USD', content_name: packageSelection.name });
          if (typeof window.gtag === 'function') {
            window.gtag('event', 'conversion', { 'send_to': 'AW-17767139897/lcnyCLfUhckbELmUhJhC', 'value': totalDue, 'currency': 'USD', 'transaction_id': 'txn_' + Date.now() });
          }
      } else {
          // Track as Lead for now
          trackFbEvent('Lead', { content_name: 'Checkout - Card Later' });
      }

      onSubmitSuccess();
    } catch (err) {
      setError(err.message);
      setIsSubmitting(false);
    }
  };

  let termNounDisplay = 'month';
  if (paymentSelection.term === 'Quarterly') termNounDisplay = 'quarter';
  if (paymentSelection.term === 'Annual') termNounDisplay = 'year';

  return (
    <div className="bg-white p-6 md:p-8 rounded-xl shadow-lg fade-in">
      <button onClick={onBack} className="text-sm text-gray-600 hover:underline mb-4">&larr; Back to Plans</button>
      <h2 className="text-2xl font-bold text-center mb-6">{text?.title || "Complete Order"}</h2>
      
      {/* --- ORDER SUMMARY (UPDATED) --- */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-6 text-sm">
        <h4 className="font-bold text-slate-700 border-b border-slate-200 pb-2 mb-2">Order Summary</h4>
        <div className="flex justify-between mb-1"><span className="text-slate-600">Plan</span><span className="font-medium">{packageSelection.name}</span></div>
        <div className="flex justify-between mb-1"><span className="text-slate-600">Frequency</span><span className="font-medium">{bd.details?.frequency}</span></div>
        <div className="flex justify-between mb-1"><span className="text-slate-600">Dogs Included</span><span className="font-medium">{bd.numDogs}</span></div>
        <div className="flex justify-between mb-1"><span className="text-slate-600">Yard+ Coverage</span><span className={`font-medium ${bd.yardPlusStatus === 'Included' ? 'text-green-600 font-bold' : (bd.yardPlusCost > 0 ? '' : 'text-slate-400')}`}>{bd.yardPlusStatus}</span></div>

        <div className="border-t border-slate-200 my-3 pt-3">
           <div className="flex justify-between text-slate-500 mb-2">
             <span>First Clean Up / Yard Reset</span>
             <span className="text-slate-900 font-medium">$99.99+</span>
           </div>
           
           <div className="flex justify-between text-red-600 font-bold mb-3 items-center bg-red-50 p-2 -mx-2 rounded border border-red-100">
             <div className="flex items-center">
               <span>FREE First Clean Up / Yard Reset</span>
               <div className="flex items-center ml-1">
                  <button onClick={onSavingsInfoClick} className="text-red-500 hover:text-red-700 focus:outline-none"><svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg></button>
               </div>
             </div>
             <span>-$99.99+</span>
           </div>

           <div className="flex justify-between font-bold text-slate-800 mb-1 text-base">
             <span>Monthly Rate:</span>
             <span>${packageSelection.finalMonthlyPrice.toFixed(2)}</span>
           </div>
           
           {/* Dynamic Discount Row */}
           {firstMonthDiscount > 0 && (
             <div className="flex justify-between text-red-600 font-bold mb-1">
                <span>{promoText}:</span>
                <span>-${firstMonthDiscount.toFixed(2)}</span>
             </div>
           )}
        </div>

        <div className="bg-slate-900 text-white p-4 -mx-4 -mb-4 rounded-b-lg mt-6 shadow-inner flex justify-between items-center">
          <span className="text-lg font-medium opacity-90">Total Due Today:</span>
          <span className="text-3xl font-extrabold tracking-wide text-white">${totalDue.toFixed(2)}</span>
        </div>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Contact Info */}
        <h4 className="font-bold text-gray-800 border-b pb-1 mt-6 mb-3">1. Contact Information</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input className="w-full p-3 border rounded" placeholder="Full Name" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
            <input className="w-full p-3 border rounded" type="email" placeholder="Email" required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
        </div>
        <input className="w-full p-3 border rounded bg-gray-100" type="tel" placeholder="Phone" readOnly value={formData.phone} />

        {/* Service Address */}
        <h4 className="font-bold text-gray-800 border-b pb-1 mt-6 mb-3">2. Service Address</h4>
        <input className="w-full p-3 border rounded" placeholder="Street Address" required value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
        <div className="grid grid-cols-3 gap-4">
            <input className="col-span-2 w-full p-3 border rounded" placeholder="City" required value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} />
            <input className="w-full p-3 border rounded bg-gray-100" placeholder="State" readOnly value="IN" />
        </div>
        <input className="w-full p-3 border rounded bg-gray-100" placeholder="Zip Code" readOnly value={zipCode} />

        {/* Details */}
        <h4 className="font-bold text-gray-800 border-b pb-1 mt-6 mb-3">3. Service Details</h4>
        <input className="w-full p-3 border rounded" placeholder="Dog's Name(s) (Optional)" value={formData.dogName} onChange={e => setFormData({...formData, dogName: e.target.value})} />
        <select className="w-full p-3 border rounded bg-white" value={formData.source} onChange={e => setFormData({...formData, source: e.target.value})}>
            <option value="">How did you hear about us? (Optional)</option>
            <option value="Google">Google Search</option>
            <option value="Facebook">Facebook / Instagram</option>
            <option value="Nextdoor">Nextdoor</option>
            <option value="Referral">Friend / Neighbor</option>
            <option value="Truck">Saw Truck</option>
            <option value="Other">Other</option>
        </select>
        <textarea className="w-full p-3 border rounded" rows="2" placeholder="Gate codes, access notes, or comments (Optional)" value={formData.comments} onChange={e => setFormData({...formData, comments: e.target.value})} />

        {/* Payment */}
        <h4 className="font-bold text-gray-800 border-b pb-1 mt-6 mb-3">4. Billing</h4>
        
        <div className="mb-4">
            <label className="block text-sm font-bold text-gray-700 mb-2">A card on file is needed before services can start. Would you like to provide card information now?*</label>
            <div className="space-y-2">
                <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input type="radio" name="cardOption" className="mr-3" checked={cardNow} onChange={() => setCardNow(true)} />
                    <span className="font-medium">Yes, I'm ready to start.</span>
                </label>
                <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input type="radio" name="cardOption" className="mr-3" checked={!cardNow} onChange={() => setCardNow(false)} />
                    <span className="font-medium">No, I have question(s) about my service first.</span>
                </label>
            </div>
        </div>

        {cardNow && (
            <div className="p-3 border rounded bg-white min-h-[50px] animate-scaleIn">
                {stripeInstance ? <div id="card-element" /> : <p className="text-gray-400 text-center">Loading Payment System...</p>}
                <PaymentTrustBadge />
            </div>
        )}
        
        <TermsCheckbox checked={formData.agreed} onChange={(val) => setFormData(prev => ({...prev, agreed: val}))} isSubscription={true} />
        
        {error && <p className="text-red-600 text-center text-sm">{error}</p>}
        <button disabled={isSubmitting} className="w-full bg-[var(--brand-green)] text-white font-bold py-4 rounded-lg hover:bg-opacity-90 transition-all">
          {isSubmitting ? 'Processing...' : (cardNow ? `Pay $${totalDue.toFixed(2)} & Start Subscription` : 'Complete Order')}
        </button>
        {!cardNow && <p className="text-center text-xs text-gray-500 mt-2">A team member will contact you to finalize billing.</p>}
      </form>
    </div>
  );
};

const LeadForm = ({ title, description, onBack, onSubmitSuccess, zipCode, dogCount, yardSize }) => {
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', address: '', notes: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    const yardSizeLabels = { 'standard': 'Standard (Up to 1/4 Acre)', 'tier1': 'Medium (1/4 - 1/2 Acre)', 'tier2': 'Large (1/2 - 1 Acre)', 'estate': 'Estate (Over 1 Acre)' };
    const readableYardSize = yardSizeLabels[yardSize] || yardSize || "Custom Quote / Estate";

    try {
       const res = await fetch('/.netlify/functions/create-lead', {
         method: 'POST',
         headers: {'Content-Type': 'application/json'},
         body: JSON.stringify({
           leadType: 'customQuote',
           leadData: { ...formData, zip: zipCode, dog_count: dogCount, yard_size: readableYardSize, lead_status: 'Custom Quote Req' },
           emailParams: { 
             name: formData.name || 'Valued Customer',
             email: formData.email || '',
             phone: formData.phone || '',
             address: formData.address || '',
             description: title || 'Custom Quote Request',
             plan: 'Custom Quote',
             zip: zipCode || 'N/A',
             dog_count: dogCount || 'N/A',
             notes: formData.notes || 'No additional notes.',
             yard_size: readableYardSize
           }
         })
       });
       if (res.ok) {
         trackFbEvent('Lead', { content_name: title });
         if (typeof window.gtag === 'function') { window.gtag('event', 'conversion', { 'send_to': 'AW-17767139897/Ug4FCLCrqckbELmUhJhC' }); }
         onSubmitSuccess();
       }
    } catch (e) { console.error(e); setIsSubmitting(false); }
  };

  return (
    <div className="bg-white p-8 rounded-xl shadow-lg fade-in">
      <h2 className="text-2xl font-bold text-center mb-2">{title}</h2>
      <p className="text-center text-gray-600 mb-6">{description}</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input className="w-full p-3 border rounded" placeholder="Name" required onChange={e => setFormData({...formData, name: e.target.value})} />
        <input className="w-full p-3 border rounded" placeholder="Email" required onChange={e => setFormData({...formData, email: e.target.value})} />
        <input 
          className="w-full p-3 border rounded" 
          placeholder="Phone" 
          required 
          value={formData.phone}
          onChange={(e) => {
            const val = e.target.value.replace(/\D/g, '');
            if (val.length <= 10) setFormData({...formData, phone: val});
          }} 
        />
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
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', address: '', agreed: false });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const depositAmount = 99.99;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!formData.agreed) { setError('You must agree to the Terms of Service.'); return; }
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
          customer: { ...formData, terms: true },
          quote: { zipCode, dogCount, planName: 'One-Time Yard Reset', planKey: 'oneTime', paymentTerm: 'One-Time Deposit', totalDueToday: depositAmount },
          leadData: { ...formData, zip: zipCode, dog_count: dogCount, yard_size: "One-Time Reset (Size N/A)", lead_status: 'Complete - PAID (One-Time)', quote_type: 'One-Time Yard Reset' },
          emailParams: { 
            name: formData.name || 'Valued Customer',
            email: formData.email || '',
            phone: formData.phone || '',
            address: formData.address || '',
            description: 'One-Time Yard Reset', 
            final_charge: `$${depositAmount.toFixed(2)}`,
            zip: zipCode || 'N/A',
            dog_count: dogCount || 'N/A',
            yard_size: "One-Time Reset (Size N/A)"
          }
        })
      });
      const data = await res.json();
      if (!res.ok || data.status !== 'success') throw new Error(data.message || 'Payment processing failed.');
      trackFbEvent('Purchase', { value: depositAmount, currency: 'USD', content_name: 'One-Time Yard Reset' });
      if (typeof window.gtag === 'function') { window.gtag('event', 'conversion', { 'send_to': 'AW-17767139897/lcnyCLfUhckbELmUhJhC', 'value': depositAmount, 'currency': 'USD', 'transaction_id': 'txn_' + Date.now() }); }
      onSubmitSuccess();
    } catch (err) {
      console.error('Submission Error:', err);
      setError(err.message);
      setIsSubmitting(false);
    }
  };
  
  return (
    <div className="bg-white p-6 md:p-8 rounded-xl shadow-lg fade-in">
      <button onClick={onBack} className="text-sm text-gray-600 hover:text-blue-600 hover:text-blue-600 hover:underline mb-4">&larr; Back</button>
      <h2 className="text-2xl font-bold text-slate-800 text-center mb-6">{text?.title || "Book One-Time"}</h2>
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-6 text-sm">
        <div className="flex justify-between"><span>One-Time Yard Reset</span><span className="font-medium text-slate-900">$99.99</span></div>
        <div className="border-t border-slate-300 pt-2 mt-2 flex justify-between text-xl"><span className="font-bold text-slate-900">Total Deposit:</span><span className="font-extrabold text-slate-900">${depositAmount.toFixed(2)}</span></div>
      </div>
      <div className="bg-blue-50 p-4 rounded-lg mb-6 text-sm text-blue-800" dangerouslySetInnerHTML={{ __html: text?.whatHappensNextBody }} />
      <form onSubmit={handleSubmit} className="space-y-4">
        <input className="w-full p-3 border rounded" placeholder="Full Name" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
        <input className="w-full p-3 border rounded" type="email" placeholder="Email" required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
        <input 
          className="w-full p-3 border rounded" 
          type="tel" 
          placeholder="Phone" 
          required 
          value={formData.phone} 
          onChange={(e) => {
            const val = e.target.value.replace(/\D/g, '');
            if (val.length <= 10) setFormData({...formData, phone: val});
          }} 
        />
        <input className="w-full p-3 border rounded" placeholder="Service Address" required value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
        <div className="p-3 border rounded bg-white min-h-[50px]">
          {stripeInstance ? <div id="card-element" /> : <p className="text-gray-400 text-center">Loading Payment System...</p>}
        </div>
        <PaymentTrustBadge />
        <TermsCheckbox checked={formData.agreed} onChange={(val) => setFormData(prev => ({...prev, agreed: val}))} isSubscription={false} />
        {error && <p className="text-red-600 text-center text-sm">{error}</p>}
        <button disabled={isSubmitting} className="w-full bg-[var(--brand-blue)] text-white font-bold text-lg py-4 rounded-lg hover:bg-opacity-90">
          {isSubmitting ? 'Processing...' : `Pay $${depositAmount.toFixed(2)} Deposit`}
        </button>
      </form>
    </div>
  );
};

const ExitIntentModal = ({ currentPlan, zipCode, yardSize, dogCount, planDetails, text, onClose }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch('/.netlify/functions/create-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadType: 'exitIntent',
          leadData: { email, zip: zipCode, yard_size: yardSize, dog_count: dogCount, lead_status: 'Exit Intent' },
          emailParams: { email, zip: zipCode, yard_size: yardSize, dog_count: dogCount, plan: currentPlan?.name || 'Unknown' }
        })
      });
      setSent(true);
      setTimeout(onClose, 3000);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  return (
    <ModalOverlay onClose={onClose}>
      <div className="p-8 text-center">
        {sent ? (
          <div className="text-green-600 font-bold">
            <div className="text-4xl mb-2">✓</div>
            <p>Quote sent! Check your inbox.</p>
          </div>
        ) : (
          <>
            <h3 className="text-2xl font-bold text-slate-800 mb-3">{text?.title || "Wait!"}</h3>
            <div className="text-slate-600 mb-6 text-sm" dangerouslySetInnerHTML={{ __html: text?.body || "Let us email you a quote." }} />
            <form onSubmit={handleSubmit}>
              <input
                type="email"
                required
                placeholder="Enter your email"
                className="w-full p-3 border rounded mb-4"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
              <button disabled={loading} className="w-full bg-[var(--brand-green)] text-white font-bold py-3 rounded-lg hover:opacity-90">
                {loading ? 'Sending...' : 'Send My Quote'}
              </button>
            </form>
            <button onClick={onClose} className="mt-4 text-xs text-gray-400 underline">No thanks, I'll pay full price later</button>
          </>
        )}
      </div>
    </ModalOverlay>
  );
};

const Site = () => {
  const [config, setConfig] = useState(null);
  const [view, setView] = useState('zip'); 
  const [zipCode, setZipCode] = useState('');
  const [yardSize, setYardSize] = useState('standard');
  const [numDogs, setNumDogs] = useState(1); 
  const [dogCountLabel, setDogCountLabel] = useState('1'); 
  const [phone, setPhone] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [couponDetails, setCouponDetails] = useState(null); // New State for Coupon Object
  
  const [yardPlusSelections, setYardPlusSelections] = useState({});
  const [packageSelection, setPackageSelection] = useState(null); 
  const [initialPaymentSelection, setInitialPaymentSelection] = useState(null); 
  const [isExitModalOpen, setIsExitModalOpen] = useState(false);
  const [stripeInstance, setStripeInstance] = useState(null);
  const [cardElement, setCardElement] = useState(null);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showAlertsModal, setShowAlertsModal] = useState(false);
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [showSatisfactionModal, setShowSatisfactionModal] = useState(false);
  const [showRiskFreeModal, setShowRiskFreeModal] = useState(false);
  const [showYardHelperModal, setShowYardHelperModal] = useState(false); 
  const [showSavingsModal, setShowSavingsModal] = useState(false);
  const [showSpecialOfferModal, setShowSpecialOfferModal] = useState(false); 
  const [isFormSubmitted, setIsFormSubmitted] = useState(false);
  const [configError, setConfigError] = useState(null);
  const [configSource, setConfigSource] = useState('Checking...');

  useEffect(() => {
    if (config?.data?.APPROVED_ZIP_CODES) {
      const params = new URLSearchParams(window.location.search);
      const urlZip = params.get('zip');
      if (urlZip && /^\d{5}$/.test(urlZip) && config.data.APPROVED_ZIP_CODES.includes(urlZip)) {
        setZipCode(urlZip);
        setView('sorter');
      }
    }
  }, [config]);

  useEffect(() => { window.scrollTo(0, 0); }, [view]);

  useEffect(() => {
    const init = async () => {
      let loadedConfig; 
      try {
        await signInAnonymously(auth);
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

      if (loadedConfig.data?.FACEBOOK_PIXEL_ID) {
        initFacebookPixel(loadedConfig.data.FACEBOOK_PIXEL_ID);
      }
      
      let stripeKey = 'pk_test_51SOAayGelkvkkUqXzl9sYTm9SDaWBYSIhzlQMPPxFKvrEn01f3VLimIe59vsEgnJdatB9JTAvNt4GH0n8YTLMYzK00LZXRTnXZ';
      try {
        if (import.meta && import.meta.env) {
           if (loadedConfig.data.STRIPE_MODE === 'live') {
             stripeKey = import.meta.env.VITE_STRIPE_PK_LIVE || stripeKey;
           } else {
             stripeKey = import.meta.env.VITE_STRIPE_PK_TEST || stripeKey;
           }
        }
      } catch(e) { console.warn('Env var access failed', e); }
      
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
        try { cardElement.unmount(); } catch (e) { }
        setTimeout(() => { try { cardElement.mount('#card-element'); } catch (e) { if(!e.message.includes('already')) console.error(e); } }, 100);
      }
    }
  }, [view, cardElement]);

  const handleSorter = async (size, dogs, label, capturedPhone, consent, capturedCoupon, capturedDetails) => {
    setYardSize(size); 
    setNumDogs(dogs); 
    setDogCountLabel(label);
    setPhone(capturedPhone);
    setCouponCode(capturedCoupon);
    setCouponDetails(capturedDetails); // Store Validated Coupon

    // --- FIRE INCOMPLETE LEAD WEBHOOK ---
    const yardSizeLabels = {
      'standard': 'Standard (Up to 1/4 Acre)',
      'tier1': 'Medium (1/4 - 1/2 Acre)',
      'tier2': 'Large (1/2 - 1 Acre)',
      'estate': 'Estate (Over 1 Acre)'
    };
    
    try {
        await fetch('/.netlify/functions/create-lead', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                leadType: 'incomplete',
                leadData: { 
                    phone: capturedPhone,
                    zip: zipCode, 
                    dog_count: label, 
                    yard_size: yardSizeLabels[size] || size, 
                    coupon_code: capturedCoupon,
                    lead_status: 'Incomplete - Step 2' 
                },
                emailParams: {}
            })
        });
    } catch (e) {
        console.warn("Background lead capture failed", e);
    }

    if (size === 'estate') setView('lead_estate');
    else if (dogs >= 10) setView('lead_kennel');
    else setView('packages');
  };

  const handlePlanSelect = (planName, finalPrice, planKey) => {
    setPackageSelection({name: planName, finalMonthlyPrice: finalPrice, key: planKey});
    
    const isPromoActive = config?.data?.promotions?.isActive || false;
    const monthlyPrice = finalPrice;
    
    setInitialPaymentSelection({
        term: 'Monthly',
        total: isPromoActive ? monthlyPrice / 2 : monthlyPrice,
        savingsText: isPromoActive ? "50% OFF First Month!" : null,
        savingsValue: 0,
        isPromo: isPromoActive
    });

    setView('checkout');
  };

  if (!config) return <FullPageLoader error={configError} />;

  return (
    <>
      <div className={`fixed bottom-4 left-4 z-[9999] px-4 py-2 rounded-full text-xs font-bold text-white shadow-lg ${configSource.includes('Live') ? 'bg-green-600' : 'bg-red-600'}`}>
        Status: {configSource}
      </div>

      {view !== 'zip' && <Header onSatisfactionClick={() => setShowSatisfactionModal(true)} />}
      
      {view === 'zip' ? (
        <LandingPage 
          config={config} 
          onZipValidated={(z) => { setZipCode(z); setView('sorter'); }}
          onCustomQuoteClick={() => { setView('lead_estate'); setYardSize('estate'); }}
          onInfoClick={() => setShowInfoModal(true)}
          onAlertsInfoClick={() => setShowAlertsModal(true)}
        />
      ) : (
        <main className="container mx-auto px-4 max-w-xl pb-12">
          {view === 'sorter' && <Sorter onSortComplete={handleSorter} text={config.text.sorterView} specialOffer={config.text.globals} onBack={() => setView('zip')} lotFees={config.data.lotFees} onYardHelperClick={() => setShowYardHelperModal(true)} promotions={config.data.promotions} onLearnMoreClick={() => setShowSpecialOfferModal(true)} stripeMode={config.data.STRIPE_MODE} />}
          {view === 'lead_estate' && <LeadForm title={config.text.customQuoteView.title} description={config.text.customQuoteView.descEstate} zipCode={zipCode} dogCount={dogCountLabel} yardSize={yardSize} onBack={() => setView('sorter')} onSubmitSuccess={() => setView('success')} />}
          {view === 'lead_kennel' && <LeadForm title={config.text.customQuoteView.title} description={config.text.customQuoteView.descMultiDog} zipCode={zipCode} dogCount={dogCountLabel} yardSize={yardSize} onBack={() => setView('sorter')} onSubmitSuccess={() => setView('success')} />}
          
          {view === 'packages' && (
            <PackageSelector 
              basePrices={config.data.basePrices} 
              planDetails={config.data.planDetails} 
              yardSize={yardSize} 
              numDogs={numDogs} 
              lotFees={config.data.lotFees} 
              extraDogPrice={config.data.extraDogPrice} 
              yardPlusPrice={config.data.yardPlusPrice} 
              yardPlusSelections={yardPlusSelections} 
              setYardPlusSelections={setYardPlusSelections} 
              text={config.text.packagesView} 
              specialOffer={config.text.globals} 
              onBack={() => setView('sorter')} 
              onPlanSelect={handlePlanSelect} 
              onOneTimeClick={() => setView('onetime')} 
              onInfoClick={() => setShowInfoModal(true)} 
              onAlertsInfoClick={() => setShowAlertsModal(true)} 
              promotions={config.data.promotions} 
              onLearnMoreClick={() => setShowSpecialOfferModal(true)}
              couponDetails={couponDetails}
            />
          )}
          
          {view === 'checkout' && (
            <CheckoutForm 
              packageSelection={packageSelection} 
              initialPaymentSelection={initialPaymentSelection} 
              zipCode={zipCode} 
              dogCount={dogCountLabel} 
              yardSize={yardSize} 
              phoneFromSorter={phone}
              couponFromSorter={couponCode}
              couponDetails={couponDetails}
              yardPlusSelected={!!yardPlusSelections[packageSelection.key]} 
              stripeInstance={stripeInstance} 
              cardElement={cardElement} 
              text={config.text.checkoutView} 
              stripeMode={config.data.STRIPE_MODE} 
              onBack={() => setView('packages')} 
              onSubmitSuccess={() => { setIsFormSubmitted(true); setView('success'); }} 
              configData={config.data} 
              onSavingsInfoClick={() => setShowSavingsModal(true)} 
              promotions={config.data.promotions}
              quarterlyDiscount={config.data.quarterlyDiscount}
              onRiskFreeInfoClick={() => setShowRiskFreeModal(true)}
            />
          )}
          
          {view === 'onetime' && (
              <div className="bg-white p-6 md:p-8 rounded-xl shadow-lg fade-in">
                <button onClick={() => setView('packages')} className="text-sm text-gray-600 hover:text-blue-600 hover:underline mb-4">&larr; Back to Plans</button>
                <h2 className="text-2xl font-bold text-slate-800 text-center mb-4">{config.text.oneTimeView.title}</h2>
                <div className="text-center my-6 py-4 border-y border-gray-200"><span className="text-5xl font-extrabold text-slate-900">$99.99</span><p className="text-sm text-slate-500 mt-1">{config.text.oneTimeView.subTitle}</p></div>
                <p className="text-slate-600 text-center mb-4">{config.text.oneTimeView.description}</p>
                <p className="text-slate-600 text-center text-sm mb-6">{config.text.oneTimeView.estatePrompt} <button onClick={() => { setView('lead_estate'); setYardSize('estate'); }} className="font-bold underline text-blue-600 hover:text-blue-700">{config.text.oneTimeView.estateLinkText}</button>.</p>
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
      )}

      {view !== 'zip' && <Footer text={config.text.footer} />}

      {showInfoModal && <ServiceInfoModal onClose={() => setShowInfoModal(false)} text={config.text.modals.serviceInfo} />}
      {showAlertsModal && <AlertsInfoModal onClose={() => setShowAlertsModal(false)} text={config.text.modals.alertsInfo} />}
      {showPricingModal && <PricingInfoModal onClose={() => setShowPricingModal(false)} text={config.text.modals.pricingInfo} />}
      {showSatisfactionModal && <SatisfactionModal onClose={() => setShowSatisfactionModal(false)} text={config.text.modals.satisfactionInfo} />}
      {showRiskFreeModal && <ServiceInfoModal onClose={() => setShowRiskFreeModal(false)} text={config.text.modals.riskFreeInfo} />}
      {showYardHelperModal && <YardHelperModal onClose={() => setShowYardHelperModal(false)} />}
      {showSavingsModal && <SavingsInfoModal onClose={() => setShowSavingsModal(false)} />}
      {showSpecialOfferModal && <ServiceInfoModal onClose={() => setShowSpecialOfferModal(false)} text={config.text.modals.specialOfferInfo} />}
      
      {isExitModalOpen && !isFormSubmitted && <ExitIntentModal currentPlan={packageSelection || {}} zipCode={zipCode} yardSize={yardSize} dogCount={dogCountLabel} planDetails={config.data.planDetails} text={config.text.modals.exitIntent} onClose={() => setIsExitModalOpen(false)} />}
    </>
  );
};

const GlobalStyles = () => (
  <style dangerouslySetInnerHTML={{ __html: `
    body { font-family: 'Inter', sans-serif; background-color: #f8fafc; background-image: url('https://storage.googleapis.com/msgsndr/YzqccfNpAoMTt4EZO92d/media/68e43822ccdd18bea416654b.png'); background-repeat: repeat; }
    :root { --brand-blue: #00A9E0; --brand-green: #22c55e; }
    @keyframes fadeIn { 0% { opacity: 0; transform: translateY(20px); } 100% { opacity: 1; transform: translateY(0); } }
    .fade-in { animation: fadeIn 0.5s ease-out forwards; }
    @keyframes scaleIn { 0% { opacity: 0; transform: scale(0.95); } 100% { opacity: 1; transform: scale(1); } }
    .animate-scaleIn { animation: scaleIn 0.3s ease-out forwards; }
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