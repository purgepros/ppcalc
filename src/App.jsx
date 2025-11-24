import React, { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth'; 
import { db, auth } from './firebase.js'; 

import AdminPanel from './AdminPanel.jsx';

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

// --- Modal Components ---

const ModalOverlay = ({ children, onClose }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm fade-in" onClick={onClose}>
    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden relative animate-scaleIn" onClick={e => e.stopPropagation()}>
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
      
      {/* Content - Updated to use clean cards instead of list lines */}
      <div className="space-y-3 text-sm text-slate-600 max-h-[60vh] overflow-y-auto pr-1">
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
      <div className="space-y-3 text-slate-600 text-sm leading-relaxed max-h-[60vh] overflow-y-auto pr-2">
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

const ExitIntentModal = ({ onClose, currentPlan, zipCode, dogCount, text }) => {
  const [email, setEmail] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleEmailQuote = async () => {
    if (!email || !email.includes('@')) return;
    setIsSending(true);
    
    // Generate Link
    const baseUrl = window.location.origin + window.location.pathname;
    const params = new URLSearchParams();
    if (zipCode) params.set('zip', zipCode);
    if (dogCount) params.set('dogCount', dogCount);
    const quoteLink = `${baseUrl}?${params.toString()}`;

    // Calculate approx values
    const monthly = currentPlan?.finalMonthlyPrice || 0;
    let perVisit = 0;
    if (currentPlan?.key === 'weekly') perVisit = monthly / 4.33;
    else if (currentPlan?.key === 'biWeekly') perVisit = monthly / 2.17;
    else if (currentPlan?.key === 'twiceWeekly') perVisit = monthly / 8.66;

    try {
      await fetch('/.netlify/functions/create-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadType: 'exitIntent',
          leadData: { email, zip: zipCode, dog_count: dogCount, lead_status: 'Exit Intent - Saved Quote' },
          emailParams: {
            email,
            plan: currentPlan?.name || 'Custom Quote',
            dog_count: dogCount,
            total_monthly: `$${monthly.toFixed(2)}`,
            per_visit: `$${perVisit.toFixed(2)}`,
            quote_link: quoteLink,
            zip: zipCode // Ensure zip is sent for exit intent too
          }
        })
      });
      setSent(true);
      setTimeout(onClose, 2000);
    } catch (e) {
      console.error(e);
      setIsSending(false);
    }
  };

  return (
    <ModalOverlay onClose={onClose}>
      <div className="p-8 text-center">
        <h3 className="text-2xl font-bold text-slate-800 mb-2">{text?.title || "Wait!"}</h3>
        <p className="text-slate-600 mb-6" dangerouslySetInnerHTML={{__html: text?.body}} />
        
        {!sent ? (
          <div className="space-y-3">
             <input 
               type="email" 
               placeholder="Enter your email address" 
               className="w-full p-3 border rounded-lg"
               value={email}
               onChange={e => setEmail(e.target.value)}
             />
             <div className="flex space-x-3">
               <button onClick={onClose} className="flex-1 bg-gray-200 text-gray-700 font-bold py-3 rounded-lg hover:bg-gray-300">No thanks</button>
               <button 
                 onClick={handleEmailQuote} 
                 disabled={isSending || !email}
                 className="flex-1 bg-[var(--brand-green)] text-white font-bold py-3 rounded-lg hover:opacity-90 disabled:opacity-50"
               >
                 {isSending ? 'Sending...' : 'Email Me Quote'}
               </button>
             </div>
          </div>
        ) : (
          <div className="text-green-600 font-bold p-4 bg-green-50 rounded-lg">
            Quote Sent! Check your inbox.
          </div>
        )}
      </div>
    </ModalOverlay>
  );
};

// --- UPDATED: Single Checkbox Logic ---
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
      {isSubscription ? ', and I authorize Purge Pros to charge my payment method for future scheduled visits.' : '.'}
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

// --- NEW: REUSABLE SPECIAL OFFER COMPONENT ---
const SpecialOfferBox = ({ offer }) => {
  if (!offer) return null;
  return (
    <div className="bg-white border-2 border-dashed border-[var(--brand-green)] p-5 rounded-xl mb-6 shadow-sm relative overflow-hidden group">
      <div className="absolute top-0 right-0 bg-[var(--brand-green)] text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg uppercase tracking-wider">
        Limited Time
      </div>
      <div className="flex items-start space-x-4">
        <div className="flex-shrink-0 bg-green-100 p-3 rounded-full text-[var(--brand-green)]">
           <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
           </svg>
        </div>
        <div>
          <h3 className="text-lg font-extrabold text-slate-800 uppercase tracking-tight mb-1">
            {offer.specialOfferTitle}
          </h3>
          <div className="text-slate-600 text-sm leading-relaxed space-y-1" dangerouslySetInnerHTML={{ __html: offer.specialOfferBody }} />
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
      
      {/* UPDATED: REDESIGNED BADGE */}
      <button 
        onClick={onSatisfactionClick}
        className="group relative flex items-center bg-white rounded-full shadow-md border border-slate-200 px-5 py-2 transition-transform hover:scale-105 hover:shadow-lg active:scale-95 cursor-pointer"
      >
        <div className="absolute inset-0 border-2 border-transparent group-hover:border-[var(--brand-green)]/30 rounded-full transition-all"></div>
        <div className="flex-shrink-0 mr-3 text-[var(--brand-green)]">
           {/* Shield Check Icon */}
           <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
             <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
           </svg>
        </div>
        <div className="text-left flex flex-col">
          <span className="text-[10px] uppercase tracking-widest font-bold text-slate-400 leading-none mb-0.5">Purge Pros Promise</span>
          <span className="text-sm font-bold text-slate-800 group-hover:text-[var(--brand-blue)] transition-colors">100% Satisfaction Guaranteed</span>
        </div>
        <div className="ml-3 text-slate-300 group-hover:text-slate-400">
           <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
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
      <h2 className="text-2xl font-bold text-slate-800 text-center mb-6">{text?.title || "Enter Zip Code"}</h2>
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
  const [showYardHelp, setShowYardHelp] = useState(false); // New state for help modal

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
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
            <h2 className="text-xl font-bold text-slate-800">{text?.yardTitle || "1. Property Size?"}</h2>
            <button onClick={() => setShowYardHelp(true)} className="text-xs text-blue-600 underline hover:text-blue-800 flex items-center">
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

      {/* Use the new polished component */}
      <SpecialOfferBox offer={specialOffer} />

      <button onClick={handleSubmit} className="w-full bg-[var(--brand-green)] text-white font-bold text-lg py-4 rounded-lg hover:bg-opacity-90 shadow-lg transition-transform hover:-translate-y-0.5">
        See My Price
      </button>
      
      <button onClick={onBack} className="w-full text-center text-sm text-gray-600 hover:text-blue-600 hover:underline mt-4">
        &larr; Change Zip Code
      </button>

      {showYardHelp && <YardHelperModal onClose={() => setShowYardHelp(false)} />}
    </div>
  );
};

const PackageSelector = ({ 
  basePrices, planDetails, 
  yardSize, numDogs, 
  lotFees, extraDogPrice, yardPlusPrice,
  onPlanSelect, onBack, onOneTimeClick, 
  onInfoClick, onAlertsInfoClick, 
  text, specialOffer, 
  yardPlusSelections, setYardPlusSelections 
}) => {

  // --- REPAIRED LOGIC: Use fallbacks instead of crashing/infinite loading ---
  const fees = lotFees || { tier1: 30, tier2: 60 };
  const prices = basePrices || { weekly: 109, biWeekly: 89, twiceWeekly: 169 };
  // Defaults for plan details to prevent crashes if one is missing
  const detailsMap = planDetails || {
    biWeekly: { name: "Bi-Weekly Reset", priceKey: "biWeekly", frequency: "Every 2 Weeks", features: ["Backyard Coverage", "Waste Hauled Away"] },
    weekly: { name: "Pristine-Clean", priceKey: "weekly", frequency: "Every Week", features: ["Backyard Coverage", "Waste Hauled Away"] },
    twiceWeekly: { name: "Pristine-Plus", priceKey: "twiceWeekly", frequency: "2x Per Week", features: ["Yard+ Coverage", "Waste Hauled Away"] }
  };
  const eDogPrice = extraDogPrice || 15;
  const yPlusPrice = yardPlusPrice || 20;

  let lotFee = 0;
  if (yardSize === 'tier1') lotFee = fees.tier1 || 0;
  if (yardSize === 'tier2') lotFee = fees.tier2 || 0;

  let dogFee = 0;
  if (numDogs > 2) {
    dogFee = (numDogs - 2) * eDogPrice;
  }

  const showAllPlans = numDogs < 6;

  const handleToggle = (planKey) => {
    setYardPlusSelections(prev => ({ ...prev, [planKey]: !prev[planKey] }));
  };

  const plans = [];
  const buildPlan = (key, isPopular) => {
    const details = detailsMap[key];
    if (!details) return null; // Safety skip

    const base = prices[details.priceKey] || 99;
    const isIncluded = key === 'twiceWeekly';
    const isSelected = !!yardPlusSelections[key];
    const addonCost = (isSelected && !isIncluded) ? yPlusPrice : 0;

    const featuredFreeFeatures = [];
    const standardFeatures = [];
    
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
    const p1 = buildPlan('biWeekly', false);
    if (p1) plans.push(p1);
    const p2 = buildPlan('weekly', true);
    if (p2) plans.push(p2);
  }
  const p3 = buildPlan('twiceWeekly', !showAllPlans);
  if (p3) plans.push(p3);

  return (
    <div className="bg-white p-6 md:p-8 rounded-xl shadow-lg fade-in">
      <button onClick={onBack} className="text-sm text-gray-600 hover:text-blue-600 hover:underline mb-4">&larr; Back</button>
      <h2 className="text-2xl font-bold text-slate-800 text-center mb-6">{text?.title || "Choose Your Plan"}</h2>

      {/* Use the new polished component */}
      <SpecialOfferBox offer={specialOffer} />

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
                Includes Yard+ Coverage (+${yPlusPrice})
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
                <span className="text-sm font-semibold text-slate-700">Add Yard+ Coverage (Front & Side Yards) (+${yPlusPrice})</span>
                <input 
                  type="checkbox" 
                  className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                  checked={!!yardPlusSelections[plan.key]} 
                  onChange={() => handleToggle(plan.key)} 
                />
              </label>
            )}

            <button onClick={() => onPlanSelect(plan.name, plan.finalPrice, plan.key)} className="w-full bg-[var(--brand-green)] text-white font-bold py-3 rounded-lg hover:bg-opacity-90 shadow transition-transform hover:-translate-y-0.5">
              Select Plan
            </button>
          </div>
        ))}
      </div>

      <button type="button" onClick={onOneTimeClick} className="block w-full text-center text-sm text-gray-500 hover:text-blue-600 hover:underline mt-8 cursor-pointer">
        {text?.oneTimeLink || "One Time Cleanup?"}
      </button>
    </div>
  );
};

const PaymentPlanSelector = ({ packageSelection, onPaymentSelect, onBack, quarterlyDiscount, text }) => {
  // FIX: Changed to finalMonthlyPrice to match what was set in onPlanSelect
  const monthly = packageSelection.finalMonthlyPrice;
  const qDisc = quarterlyDiscount || 30;
  const plans = [
    { term: 'Monthly', label: 'Pay Monthly', totalDue: monthly, savingsText: null, savingsValue: 0 },
    { term: 'Quarterly', label: 'Pay Quarterly', totalDue: (monthly * 3) - qDisc, savingsText: `Save $${qDisc} per Quarter!`, savingsValue: qDisc, isPopular: false },
    { term: 'Annual', label: 'Pay Yearly', totalDue: monthly * 11, savingsText: `Get 1 Month FREE (Save $${monthly})!`, savingsValue: monthly, isPopular: true }
  ];

  return (
    <div className="bg-white p-6 md:p-8 rounded-xl shadow-lg fade-in">
      <button onClick={onBack} className="text-sm text-gray-600 hover:text-blue-600 hover:underline mb-4">&larr; Back to Plans</button>
      <h2 className="text-2xl font-bold text-slate-800 text-center mb-2">{text?.title || "Choose Payment Plan"}</h2>
      <p className="text-center text-slate-600 mb-6">for <strong>{packageSelection.name}</strong> plan</p>
      <div className="space-y-4">
        {plans.map((p) => (
          <button key={p.term} onClick={() => onPaymentSelect(p.term, p.totalDue, p.savingsText, p.savingsValue)} className={`relative w-full text-left p-5 border-2 rounded-xl transition-all hover:-translate-y-1 ${p.isPopular ? 'border-[var(--brand-green)] bg-green-50 shadow-md' : 'border-gray-200 bg-white hover:border-blue-300'}`}>
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

const CheckoutForm = ({ packageSelection, paymentSelection, zipCode, dogCount, yardSize, onBack, onSubmitSuccess, stripeInstance, cardElement, text, stripeMode, yardPlusSelected, configData }) => {
  // Updated state to just track one boolean for the checkbox
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', address: '', agreed: false });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const totalDue = paymentSelection.total;
  const totalSavings = 99.99 + paymentSelection.savingsValue;

  // --- Calculation Helpers for Display ---
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

    const numDogs = dogCount === '1-2' ? 2 : (dogCount === '10+' ? 10 : parseInt(dogCount));
    let dogFee = 0;
    if (numDogs > 2) {
        dogFee = (numDogs - 2) * eDogPrice;
    }

    const yardPlusCost = (yardPlusSelected && packageSelection.key !== 'twiceWeekly') ? yPlusPrice : 0;
    const yardPlusStatus = (packageSelection.key === 'twiceWeekly') ? 'Included' : (yardPlusSelected ? `$${yPlusPrice}` : 'Not Selected');

    return { baseRate, lotFee, dogFee, yardPlusCost, yardPlusStatus, numDogs, details };
  };

  const bd = getBreakdown();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.agreed) { setError('Please agree to the terms and authorization.'); return; }
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

      // --- Build Complete Email Params for Templates ---
      const monthly = packageSelection.finalMonthlyPrice;
      let perVisit = 0;
      if (packageSelection.key === 'weekly') perVisit = monthly / 4.33;
      else if (packageSelection.key === 'biWeekly') perVisit = monthly / 2.17;
      else if (packageSelection.key === 'twiceWeekly') perVisit = monthly / 8.66;

      let termDiscountRow = '';
      let termNoun = 'Month'; 

      if (paymentSelection.term === 'Quarterly') {
        termDiscountRow = `<div style="display: flex; justify-content: space-between; margin-bottom: 8px;"><span style="color: #166534;">Quarterly Discount</span><span style="font-weight: bold; color: #166534;">-$30.00</span></div>`;
        termNoun = 'Quarter';
      } else if (paymentSelection.term === 'Annual') {
        termDiscountRow = `<div style="display: flex; justify-content: space-between; margin-bottom: 8px;"><span style="color: #166534;">Annual Discount (1 Month Free)</span><span style="font-weight: bold; color: #166534;">-$${monthly.toFixed(2)}</span></div>`;
        termNoun = 'Year';
      }

      const payload = {
        stripeMode,
        paymentMethodId: paymentMethod.id,
        customer: { ...formData, terms: true, auth: true }, // Explicitly sending terms/auth based on single checkbox
        quote: { zipCode, dogCount, planName: packageSelection.name, planKey: packageSelection.key, paymentTerm: paymentSelection.term, totalDueToday: totalDue, yardSize, yardPlusSelected },
        leadData: { ...formData, zip: zipCode, dog_count: dogCount, plan: packageSelection.name, total: totalDue, term: paymentSelection.term },
        // SANITIZED EMAIL PARAMS - Fixing "Dynamic Variables Corrupted"
        emailParams: { 
          name: formData.name || 'Valued Customer',
          email: formData.email || '',
          phone: formData.phone || '',
          address: formData.address || '',
          plan: packageSelection.name || 'Standard Plan', 
          payment_term: paymentSelection.term || 'Monthly',
          term_noun: termNoun,
          total_monthly: `$${monthly.toFixed(2)}/mo`, 
          per_visit: `$${perVisit.toFixed(2)}`,
          final_charge: `$${totalDue.toFixed(2)}`,
          initial_savings: "99.99",
          total_savings: totalSavings.toFixed(2),
          term_discount_row: termDiscountRow || '',
          term_savings_row: '',
          yard_plus_status: yardPlusSelected ? "Included" : "Not Selected",
          zip: zipCode || '', // Added Missing Field
          dog_count: dogCount || '' // Added Missing Field
        }
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

  let termNounDisplay = 'month';
  if (paymentSelection.term === 'Quarterly') termNounDisplay = 'quarter';
  if (paymentSelection.term === 'Annual') termNounDisplay = 'year';

  return (
    <div className="bg-white p-6 md:p-8 rounded-xl shadow-lg fade-in">
      <button onClick={onBack} className="text-sm text-gray-600 hover:underline mb-4">&larr; Back</button>
      <h2 className="text-2xl font-bold text-center mb-6">{text?.title || "Checkout"}</h2>
      
      {/* Detailed Order Summary */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-6 text-sm">
        <h4 className="font-bold text-slate-700 border-b border-slate-200 pb-2 mb-2">Plan Breakdown</h4>
        
        <div className="flex justify-between mb-1">
           <span className="text-slate-600">Frequency</span>
           <span className="font-medium">{bd.details?.frequency || packageSelection.name}</span>
        </div>
        
         <div className="flex justify-between mb-1">
           <span className="text-slate-600">Dogs Included</span>
           <span className="font-medium">{bd.numDogs}</span>
        </div>
        
        <div className="flex justify-between mb-1">
          <span className="text-slate-600">Base Plan Rate</span>
          <span className="font-medium">${bd.baseRate}</span>
        </div>
        
        {bd.lotFee > 0 && (
          <div className="flex justify-between mb-1">
            <span className="text-slate-600">Lot Size Fee</span>
            <span className="font-medium">+${bd.lotFee}</span>
          </div>
        )}
        
        {bd.dogFee > 0 && (
          <div className="flex justify-between mb-1">
            <span className="text-slate-600">Extra Dog Fee</span>
            <span className="font-medium">+${bd.dogFee}</span>
          </div>
        )}

        {/* UPDATED: Always show Yard+ Coverage Status */}
        <div className="flex justify-between mb-1">
            <span className="text-slate-600">Yard+ Coverage (Front/Sides)</span>
            <span className={`font-medium ${bd.yardPlusStatus === 'Included' ? 'text-green-600 font-bold' : (bd.yardPlusCost > 0 ? '' : 'text-slate-400')}`}>
            {bd.yardPlusStatus === 'Included' ? 'Included' : (bd.yardPlusCost > 0 ? `+$${bd.yardPlusCost}` : 'Not Selected')}
            </span>
        </div>

        <div className="border-t border-slate-200 my-2 pt-2">
           <div className="flex justify-between font-bold text-slate-800 mb-2">
             <span>Total Monthly Rate:</span>
             <span>${packageSelection.finalMonthlyPrice}</span>
           </div>
           
           {paymentSelection.term !== 'Monthly' && (
             <div className="flex justify-between text-slate-600 italic">
                <span>x {paymentSelection.term === 'Quarterly' ? '3 Months' : '12 Months'}</span>
             </div>
           )}
           
           {paymentSelection.savingsValue > 0 && (
             <div className="flex justify-between text-green-600 font-bold mt-1">
                <span>{paymentSelection.term} Discount:</span>
                <span>-${paymentSelection.savingsValue.toFixed(2)}</span>
             </div>
           )}
        </div>

        <div className="border-t border-slate-300 pt-2 mt-2 flex justify-between text-xl text-slate-900 font-extrabold">
          <span>Due Today:</span>
          <span>${totalDue.toFixed(2)}</span>
        </div>
        
        <div className="flex justify-between text-green-600 font-semibold mt-2 text-xs bg-green-50 p-2 rounded border border-green-100">
          <span>Total Savings Today (Setup + Discount):</span>
          <span>${totalSavings.toFixed(2)} (Already Deducted)</span>
        </div>
      </div>

      <div className="bg-blue-50 p-4 rounded-lg mb-6 text-sm text-blue-800">
        <h4 className="font-bold mb-2">{text?.whatHappensNextTitle || "Here's What Happens Next:"}</h4>
        <p className="mb-2">
            Your payment today covers your first <strong>{termNounDisplay}</strong> of service. Your subscription will <strong>not</strong> begin until your <strong>first scheduled visit</strong>.
        </p>
        <p className="mb-2">After checkout, a team member will call you within 24 hours to schedule <strong>two</strong> separate appointments:</p>
        <ol className="list-decimal pl-5 space-y-1">
            <li>Your 100% FREE 1st Scoop / Initial Yard Reset ($99.99+ Value).</li>
            <li>Your First <em>Paid</em> Visit (which starts your subscription).</li>
        </ol>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <input className="w-full p-3 border rounded" placeholder="Full Name" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
        <input className="w-full p-3 border rounded" type="email" placeholder="Email" required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
        <input className="w-full p-3 border rounded" type="tel" placeholder="Phone" required value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
        <input className="w-full p-3 border rounded" placeholder="Address" required value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
        
        <div className="p-3 border rounded bg-white min-h-[50px]">
          {stripeInstance ? <div id="card-element" /> : <p className="text-gray-400 text-center">Loading Payment System...</p>}
        </div>

        <TermsCheckbox 
          checked={formData.agreed} 
          onChange={(val) => setFormData(prev => ({...prev, agreed: val}))}
          isSubscription={true} 
        />
        
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
           // Add dog_count explicitly for GHL
           leadData: { ...formData, zip: zipCode, dog_count: dogCount, lead_status: 'Custom Quote Req' },
           // SANITIZED EMAIL PARAMS - Fixing "Dynamic Variables Corrupted"
           emailParams: { 
             name: formData.name || 'Valued Customer',
             email: formData.email || '',
             phone: formData.phone || '',
             address: formData.address || '',
             description: title || 'Custom Quote Request',
             plan: 'Custom Quote',
             zip: zipCode || 'N/A',
             dog_count: dogCount || 'N/A',
             notes: formData.notes || 'No additional notes.'
           }
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
          customer: { ...formData, terms: true }, // Explicitly passed
          quote: { zipCode, dogCount, planName: 'One-Time Yard Reset', planKey: 'oneTime', paymentTerm: 'One-Time Deposit', totalDueToday: depositAmount },
          // Ensure dog_count and zip are in leadData
          leadData: { ...formData, zip: zipCode, dog_count: dogCount, lead_status: 'Complete - PAID (One-Time)', quote_type: 'One-Time Yard Reset' },
          // SANITIZED EMAIL PARAMS
          emailParams: { 
            name: formData.name || 'Valued Customer',
            email: formData.email || '',
            phone: formData.phone || '',
            address: formData.address || '',
            description: 'One-Time Yard Reset', 
            final_charge: `$${depositAmount.toFixed(2)}`,
            zip: zipCode || 'N/A',
            dog_count: dogCount || 'N/A'
          }
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
      <h2 className="text-2xl font-bold text-slate-800 text-center mb-6">{text?.title || "Book One-Time"}</h2>
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-6 text-sm">
        <div className="flex justify-between"><span>One-Time Yard Reset</span><span className="font-medium text-slate-900">$99.99</span></div>
        <div className="border-t border-slate-300 pt-2 mt-2 flex justify-between text-xl"><span className="font-bold text-slate-900">Total Deposit:</span><span className="font-extrabold text-slate-900">${depositAmount.toFixed(2)}</span></div>
      </div>
      <div className="bg-blue-50 p-4 rounded-lg mb-6 text-sm text-blue-800" dangerouslySetInnerHTML={{ __html: text?.whatHappensNextBody }} />
      <form onSubmit={handleSubmit} className="space-y-4">
        <input className="w-full p-3 border rounded" placeholder="Full Name" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
        <input className="w-full p-3 border rounded" type="email" placeholder="Email" required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
        <input className="w-full p-3 border rounded" type="tel" placeholder="Phone" required value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
        <input className="w-full p-3 border rounded" placeholder="Service Address" required value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
        <div className="p-3 border rounded bg-white min-h-[50px]">
          {stripeInstance ? <div id="card-element" /> : <p className="text-gray-400 text-center">Loading Payment System...</p>}
        </div>
        
        <TermsCheckbox 
          checked={formData.agreed} 
          onChange={(val) => setFormData(prev => ({...prev, agreed: val}))}
          isSubscription={false} 
        />

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

  // --- NEW: URL Zip Checker ---
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

  // --- NEW: SCROLL RESET EFFECT ---
  // Whenever the 'view' changes, scroll the window to the top
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view]);

  useEffect(() => {
    const init = async () => {
      let loadedConfig; 
      try {
        // Use pre-initialized auth and db from ./firebase to avoid double-init issues
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

      let stripeKey = 'pk_test_51SOAayGelkvkkUqXzl9sYTm9SDaWBYSIhzlQMPPxFKvrEn01f3VLimIe59vsEgnJdatB9JTAvNt4GH0n8YTLMYzK00LZXRTnXZ';
      
      // Safe environment variable access
      try {
        // Check if import.meta.env exists before accessing properties
        if (import.meta && import.meta.env) {
           if (loadedConfig.data.STRIPE_MODE === 'live') {
             stripeKey = import.meta.env.VITE_STRIPE_PK_LIVE || stripeKey;
           } else {
             stripeKey = import.meta.env.VITE_STRIPE_PK_TEST || stripeKey;
           }
        }
      } catch(e) {
        console.warn('Environment variables access failed, using default test key', e);
      }
      
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

  // Updated Stripe mounting logic to prevent collisions
  useEffect(() => {
    if ((view === 'checkout' || view === 'onetime_checkout') && cardElement) {
      const mountPoint = document.getElementById('card-element');
      if (mountPoint) {
        // Try unmounting first to be safe
        try { cardElement.unmount(); } catch (e) { /* ignore if not mounted */ }
        // Then mount
        setTimeout(() => { 
          try { 
            cardElement.mount('#card-element'); 
          } catch (e) { 
            if(!e.message.includes('already')) console.error(e); 
          } 
        }, 100);
      }
    }
  }, [view, cardElement]);

  const handleSorter = (size, dogs, label) => {
    setYardSize(size); setNumDogs(dogs); setDogCountLabel(label);
    if (size === 'estate') setView('lead_estate');
    else if (dogs >= 10) setView('lead_kennel');
    else setView('packages');
  };

  const handlePaymentPlanSelect = (term, total, savings, savingsValue) => {
    setPaymentSelection({ term, total, savings, savingsValue });
    setView('checkout');
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
        {view === 'packages' && <PackageSelector basePrices={config.data.basePrices} planDetails={config.data.planDetails} yardSize={yardSize} numDogs={numDogs} lotFees={config.data.lotFees} extraDogPrice={config.data.extraDogPrice} yardPlusPrice={config.data.yardPlusPrice} yardPlusSelections={yardPlusSelections} setYardPlusSelections={setYardPlusSelections} text={config.text.packagesView} specialOffer={config.text.globals} onBack={() => setView('sorter')} onPlanSelect={(planName, finalPrice, planKey) => { setPackageSelection({name: planName, finalMonthlyPrice: finalPrice, key: planKey}); setView('payment'); }} onOneTimeClick={() => setView('onetime')} onInfoClick={() => setShowInfoModal(true)} onAlertsInfoClick={() => setShowAlertsModal(true)} />}
        {view === 'payment' && <PaymentPlanSelector packageSelection={packageSelection} quarterlyDiscount={config.data.quarterlyDiscount} text={config.text.paymentPlanView} onPaymentSelect={handlePaymentPlanSelect} onBack={() => setView('packages')} />}
        {view === 'checkout' && <CheckoutForm packageSelection={packageSelection} paymentSelection={paymentSelection} zipCode={zipCode} dogCount={dogCountLabel} yardSize={yardSize} yardPlusSelected={!!yardPlusSelections[packageSelection.key]} stripeInstance={stripeInstance} cardElement={cardElement} text={config.text.checkoutView} stripeMode={config.data.STRIPE_MODE} onBack={() => setView('payment')} onSubmitSuccess={() => { setIsFormSubmitted(true); setView('success'); }} configData={config.data} />}
        {view === 'onetime' && (
            <div className="bg-white p-6 md:p-8 rounded-xl shadow-lg fade-in">
              <button onClick={() => setView('packages')} className="text-sm text-gray-600 hover:text-blue-600 hover:underline mb-4">&larr; Back to Plans</button>
              <h2 className="text-2xl font-bold text-slate-800 text-center mb-4">{config.text.oneTimeView.title}</h2>
              <div className="text-center my-6 py-4 border-y border-gray-200"><span className="text-5xl font-extrabold text-slate-900">$99.99</span><p className="text-sm text-slate-500 mt-1">{config.text.oneTimeView.subTitle}</p></div>
              <p className="text-slate-600 text-center mb-4">{config.text.oneTimeView.description}</p>
              {/* FIX: Updated setView to use 'lead_estate' instead of invalid 'custom_quote' */}
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