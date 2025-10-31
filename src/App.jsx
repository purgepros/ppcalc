import React, { useState, useEffect, useMemo } from 'react';
import './index.css'; // This liks to your css file

// --- Configuration ---
const GOHIGHLEVEL_WEBHOOK_URL = 'https://services.leadconnectorhq.com/hooks/YzqccfNpAoMTt4EZO92d/webhook-trigger/7447af3a-4358-4c9f-aa25-3c221e72ada4';
const emailJsConfig = {
  serviceID: 'service_b0us6cq',
  templateID: 'template_uwysfzx', // Customer-facing template
  publicKey: 'WV8jyfhbDQ7kuvIrx'
};
const FACEBOOK_PIXEL_ID = '770811879146972';

// --- Base Prices ---
const basePrices = {
  biWeekly: 89,
  weekly: 109,
  twiceWeekly: 169,
};

// --- Dog Fee Map ---
const dogFeeMap = {
  '1-2': 0,
  '3': 15,
  '4': 30,
  '5': 45,
};

// --- Plan Details ---
const planDetails = {
  biWeekly: {
    name: 'Bi-Weekly Reset',
    price: basePrices.biWeekly,
    visitsPerMonth: 26 / 12, // 2.167
    features: [
      'Service Every 2 Weeks',
      'Full Property Coverage (Front & Sides)',
      'Waste Hauled Away',
      'Seasonal Deodorizer',
      'Seasonal WYSI Wash Sanitizer',
    ],
  },
  weekly: {
    name: 'Pristine-Clean',
    price: basePrices.weekly,
    visitsPerMonth: 52 / 12, // 4.333
    features: [
      'Service Every Week',
      'Full Property Coverage (Front & Sides)',
      'Waste Hauled Away',
      'Seasonal Deodorizer',
      'Seasonal WYSI Wash Sanitizer',
    ],
  },
  twiceWeekly: {
    name: 'Pristine-Plus',
    price: basePrices.twiceWeekly,
    visitsPerMonth: 104 / 12, // 8.667
    features: [
      'Service 2x Per Week',
      'Full Property Coverage (Front & Sides)',
      'Waste Hauled Away',
      'Seasonal Deodorizer',
      'Seasonal WYSI Wash Sanitizer',
    ],
  },
};

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
 */
const initFacebookPixel = () => {
  if (window.fbq) return; // Already initialized
  !function(f,b,e,v,n,t,s)
  {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
  n.callMethod.apply(n,arguments):n.queue.push(arguments)};
  if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
  n.queue=[];t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];
  s.parentNode.insertBefore(t,s)}(window, document,'script',
  'https://connect.facebook.net/en_US/fbevents.js');
  fbq('init', FACEBOOK_PIXEL_ID);
  fbq('track', 'PageView');
};

/**
 * Sends lead data to the GHL webhook.
 * @param {object} data - The lead data to send.
 */
const sendToWebhook = async (data) => {
  try {
    await fetch(GOHIGHLEVEL_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  } catch (error) {
    console.error('Webhook Fetch Error:', error);
  }
};

/**
 * Sends an email using EmailJS.
 * @param {object} templateParams - The parameters for the email template.
 */
const sendEmail = async (templateParams) => {
  if (!window.emailjs) {
    console.error('EmailJS is not loaded.');
    return;
  }
  try {
    await window.emailjs.send(
      emailJsConfig.serviceID,
      emailJsConfig.templateID,
      templateParams,
      emailJsConfig.publicKey
    );
  } catch (error) {
    console.error('EmailJS Send Error:', error);
  }
};

// --- Child Components ---

const YardButton = ({ title, description, icon, onClick, isSelected }) => (
  <button
    onClick={onClick}
    className={`w-full text-left p-6 border-2 rounded-xl transition-all ${
      isSelected
        ? 'border-blue-500 bg-blue-50 shadow-lg'
        : 'border-gray-300 bg-white hover:border-gray-400'
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

const LeadForm = ({ title, description, onSubmit, onBack }) => {
  const [formData, setFormData] = useState({ name: '', email: '', phone: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    const leadData = {
      ...formData,
      lead_status: 'Custom Quote Request',
      quote_type: title,
    };

    // Fire FB event
    fbq('track', 'Lead');
    
    // Send to Webhook
    await sendToWebhook(leadData);
    
    // Send Email
    await sendEmail({
      ...leadData,
      plan: title,
      notes: description,
    });

    setIsSubmitting(false);
    setIsSubmitted(true);
  };

  if (isSubmitted) {
    return (
      <div className="bg-white p-8 rounded-xl shadow-lg text-center fade-in">
        <div className="w-16 h-16 bg-green-100 text-green-600 flex items-center justify-center rounded-full mx-auto mb-4">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
        </div>
        <h2 className="text-2xl font-bold text-slate-800">Thank You!</h2>
        <p className="text-slate-600 mt-2">We've received your request and will contact you shortly to provide your free custom quote.</p>
        <button
          onClick={onBack}
          className="w-full text-center text-sm text-gray-600 hover:text-blue-600 transition-colors mt-6"
        >
          &larr; Go Back
        </button>
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
          placeholder="Full Name"
          required
          className="w-full p-3 border-2 border-gray-300 rounded-lg"
          onChange={handleChange}
        />
        <input
          type="email"
          name="email"
          placeholder="Email Address"
          required
          className="w-full p-3 border-2 border-gray-300 rounded-lg"
          onChange={handleChange}
        />
        <input
          type="tel"
          name="phone"
          placeholder="Phone Number"
          required
          className="w-full p-3 border-2 border-gray-300 rounded-lg"
          onChange={handleChange}
        />
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-[var(--brand-green)] text-white font-bold text-lg py-4 rounded-lg hover:bg-opacity-90 transition shadow-lg flex items-center justify-center h-14"
        >
          {isSubmitting ? <span className="loader"></span> : 'Request Free Quote'}
        </button>
      </form>
      <button
        onClick={onBack}
        className="w-full text-center text-sm text-gray-600 hover:text-blue-600 transition-colors mt-6"
      >
        &larr; Go Back
      </button>
    </div>
  );
};

const ServiceInfoModal = ({ onClose }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50" onClick={onClose}>
    <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
      <h3 className="text-lg font-bold text-gray-900">About Seasonal Services</h3>
      <p className="text-sm text-gray-600 mt-4">
        Our Seasonal Deodorizer and WYSI Wash Sanitizer are complimentary add-ons included in your plan to keep your yard fresh during warmer months.
      </p>
      <p className="text-sm text-gray-600 mt-2">
        To be effective, these treatments must be applied to a non-frozen ground. Service is typically paused during Indiana's frost months (roughly October - April).
      </p>
      <p className="text-sm text-gray-500 mt-4">
        Because these are free, value-added services, their seasonal availability does not affect your flat-rate monthly price.
      </p>
      <button
        onClick={onClose}
        className="w-full mt-6 bg-gray-200 text-gray-800 font-semibold py-2 px-4 rounded-lg hover:bg-gray-300"
      >
        Got it!
      </button>
    </div>
  </div>
);

const PricingInfoModal = ({ onClose }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50" onClick={onClose}>
    <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
      <h3 className="text-lg font-bold text-gray-900">How Billing is Calculated</h3>
      <p className="text-sm text-gray-600 mt-4">
        To give you a simple and predictable bill, our monthly plans are based on the total number of visits you'll receive over a full year, averaged into equal payments.
      </p>
      <ul className="text-sm text-gray-600 mt-2 list-disc list-inside space-y-1">
        <li><b>Weekly Plan:</b> 52 visits/year &divide; 12 months = 4.33 visits/mo</li>
        <li><b>Bi-Weekly Plan:</b> 26 visits/year &divide; 12 months = 2.17 visits/mo</li>
      </ul>
      <p className="text-sm text-gray-600 mt-2">
        This is why some months you'll see us 4 times and others 5 (for a weekly plan), but your bill remains the same flat rate.
      </p>
      <button
        onClick={onClose}
        className="w-full mt-6 bg-gray-200 text-gray-800 font-semibold py-2 px-4 rounded-lg hover:bg-gray-300"
      >
        Got it!
      </button>
    </div>
  </div>
);


const Header = () => (
  <header className="py-6">
    <div className="container mx-auto px-4 flex justify-center">
      <a href="https://itspurgepros.com/">
        <img src="https://storage.googleapis.com/msgsndr/YzqccfNpAoMTt4EZO92d/media/68140f6288b94e80fb043618.png" alt="Purge Pros Logo" className="h-32 md:h-40" />
      </a>
    </div>
  </header>
);

const Footer = () => {
  useEffect(() => {
    document.getElementById('copyright-year').textContent = new Date().getFullYear();
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
              <li><a href="https://itspurgepros.com/" className="hover:text-white">Home</a></li>
              <li><a href="https://itspurgepros.com/about" className="hover:text-white">About Us</a></li>
              <li><a href="https://itspurgepros.com/services" className="hover:text-white">Services</a></li>
            </ul>
          </div>
          <div>
            <h3 className="text-lg font-bold mb-4 invisible">.</h3>
            <ul className="space-y-2 text-gray-400">
              <li><a href="https://share.google/uRiDZSanR8YaFknWM" className="hover:text-white">Testimonials</a></li>
              <li><a href="https://itspurgepros.com/terms-conditions" className="hover:text-white">Terms & Conditions</a></li>
              <li><a href="https://itspurgepros.com/privacy-policy" className="hover:text-white">Privacy Policy</a></li>
            </ul>
          </div>
          <div>
            <h3 className="text-lg font-bold mb-4">Locations</h3>
            <ul className="space-y-2 text-gray-400">
              <li>5625 N GERMAN CHURCH RD. UNIT 2036, INDIANAPOLIS INDIANA 46235</li>
              <li><a href="tel:3176997667" className="hover:text-white">(317) 699-7667</a></li>
              <li><a href="tel:3179615865" className="hover:text-white">(317) 961-5865</a></li>
              <li><a href="mailto:matt@itspurgepros.com" className="hover:text-white">matt@itspurgepros.com</a></li>
            </ul>
          </div>
        </div>
        <div className="mt-8 border-t border-gray-700 pt-6 text-center text-gray-500 text-sm">
          &copy; <span id="copyright-year"></span> Purge Pros. All Rights Reserved.
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
      width: 24px; height: 24px; border: 3px solid rgba(255,255,255,0.5);
      border-top-color: #FFF; border-radius: 50%;
      animation: rotation 0.8s linear infinite;
    }
    @keyframes rotation { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
  `}} />
);

// --- Main App Component ---

const App = () => {
  // State
  const [view, setView] = useState('yard'); // 'yard', 'dogs', 'packages', 'estate', 'multipet', 'onetime', 'onetime_form'
  const [yardSize, setYardSize] = useState('standard');
  const [dogCount, setDogCount] = useState('1-2');
  const [multiDogFee, setMultiDogFee] = useState(0);
  const [selectedPlanTab, setSelectedPlanTab] = useState('weekly');
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showPricingModal, setShowPricingModal] = useState(false);

  // Load external scripts and init pixel on mount
  useEffect(() => {
    initFacebookPixel();
    loadScript('https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js', 'emailjs-sdk')
      .catch(error => console.error(error));
  }, []);
  
  // Handlers
  const handleYardSelect = (size) => {
    setYardSize(size);
    if (size === 'estate') {
      setView('estate');
    } else {
      setView('dogs');
    }
  };

  const confirmDogCount = () => {
    if (dogCount === '6+') {
      setView('multipet');
    } else {
      setMultiDogFee(dogFeeMap[dogCount]);
      setView('packages');
    }
  };
  
  const handlePlanSelect = (planName, basePrice, fee) => {
    const signupData = {
      selectedPlan: planName,
      basePrice: basePrice,
      dogFee: fee,
      totalMonthly: basePrice + fee,
      dogCount: dogCount,
      lead_status: 'Complete - Plan Selected'
    };

    // 1. Fire FB Event
    fbq('track', 'CompleteRegistration');

    // 2. Send to Webhook
    sendToWebhook(signupData);

    // 3. Show confirmation
    alert(`Success! You've selected the ${planName}.\nTotal: $${signupData.totalMonthly}/mo`);
    
    // In a real app, you'd redirect to a signup/payment page here
    // window.location.href = `https://your-signup-flow.com?plan=${planName}&price=${signupData.totalMonthly}`;
  };
  
  // --- NEW: Add plan navigation ---
  const plansOrder = ['biWeekly', 'weekly', 'twiceWeekly'];

  const handleNextPlan = () => {
    const currentIndex = plansOrder.indexOf(selectedPlanTab);
    const nextIndex = (currentIndex + 1) % plansOrder.length;
    setSelectedPlanTab(plansOrder[nextIndex]);
  };

  const handlePrevPlan = () => {
    const currentIndex = plansOrder.indexOf(selectedPlanTab);
    const prevIndex = (currentIndex - 1 + plansOrder.length) % plansOrder.length;
    setSelectedPlanTab(plansOrder[prevIndex]);
  };

  // Derived state for the currently viewed plan
  const CurrentPlan = useMemo(() => {
    const plan = planDetails[selectedPlanTab];
    const totalMonthlyPrice = plan.price + multiDogFee;
    const perVisitPrice = totalMonthlyPrice / plan.visitsPerMonth;
    
    const dogText = dogCount === '1-2' ? '1-2 Dogs' : `${dogCount} Dogs`;
    const featuresWithDogCount = [
      `Service for ${dogText}`,
      ...plan.features
    ];
    
    return { 
      ...plan, 
      price: totalMonthlyPrice,
      perVisitPrice: perVisitPrice.toFixed(2),
      features: featuresWithDogCount
    };
  }, [selectedPlanTab, multiDogFee, dogCount]);

  return (
    <>
      <GlobalStyles />
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-xl mx-auto">
          
          {/* Step 1: Yard Size */}
          {view === 'yard' && (
            <div className="space-y-6 fade-in">
              <div className="bg-white/80 backdrop-blur-sm rounded-lg py-3 px-4 shadow">
                <h2 className="text-2xl font-bold text-slate-800 text-center">1. What is your property size?</h2>
              </div>
              <YardButton
                title="Standard Residential Lot"
                description="Up to 1/2 Acre"
                icon={<svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6-4a1 1 0 001-1v-1a1 1 0 10-2 0v1a1 1 0 001 1z" /></svg>}
                onClick={() => handleYardSelect('standard')}
                isSelected={yardSize === 'standard'}
              />
              <YardButton
                title="Large Lot / Estate"
                description="Over 1/2 Acre"
                icon={<svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
                onClick={() => handleYardSelect('estate')}
                isSelected={yardSize === 'estate'}
              />
            </div>
          )}

          {/* Step 2: Dog Count */}
          {view === 'dogs' && (
            <div className="bg-white p-8 rounded-xl shadow-lg fade-in">
              <button onClick={() => setView('yard')} className="text-sm text-gray-600 hover:text-blue-600 mb-4">&larr; Back to Yard Size</button>
              <h2 className="text-2xl font-bold text-slate-800 text-center mb-6">2. How many dogs do you have?</h2>
              
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
              
              <button
                onClick={confirmDogCount}
                className="w-full bg-[var(--brand-green)] text-white font-bold text-lg py-4 rounded-lg hover:bg-opacity-90 transition shadow-lg flex items-center justify-center mt-6"
              >
                Confirm Dog Count
              </button>
            </div>
          )}
          
          {/* Step 3: Packages */}
          {view === 'packages' && (
            <div className="bg-white p-6 md:p-8 rounded-xl shadow-lg fade-in">
              <button onClick={() => setView('dogs')} className="text-sm text-gray-600 hover:text-blue-600 mb-4">&larr; Back to Dog Count</button>
              <h2 className="text-2xl font-bold text-slate-800 text-center mb-6">3. Choose Your 'Pristine Yard' Plan</h2>
              
              {/* Tab Navigation */}
              <div className="flex w-full rounded-lg bg-gray-200 p-1 mb-6">
                <button
                  onClick={() => setSelectedPlanTab('biWeekly')}
                  className={`w-1/3 py-4 px-2 text-sm md:text-base font-bold rounded-md transition-all ${selectedPlanTab === 'biWeekly' ? 'bg-white text-blue-600 shadow' : 'text-gray-600 hover:bg-gray-300'}`}
                >
                  Bi-Weekly
                </button>
                <button
                  onClick={() => setSelectedPlanTab('weekly')}
                  className={`w-1/3 px-2 py-2 text-sm md:text-base font-bold rounded-md transition-all ${selectedPlanTab === 'weekly' ? 'bg-white text-green-600 shadow' : 'text-gray-600 hover:bg-gray-300'}`}
                >
                  <span className="flex flex-col items-center">
                    <span className="text-[10px] font-bold text-white bg-[var(--brand-green)] px-2 py-0.5 rounded-full mb-1">
                      Most Popular
                    </span>
                    Weekly
                  </span>
                </button>
                <button
                  onClick={() => setSelectedPlanTab('twiceWeekly')}
                  className={`w-1/3 py-4 px-2 text-sm md:text-base font-bold rounded-md transition-all ${selectedPlanTab === 'twiceWeekly' ? 'bg-white text-blue-600 shadow' : 'text-gray-600 hover:bg-gray-300'}`}
                >
                  Twice-Weekly
                </button>
              </div>
              
              {/* Plan Details Card */}
              <div className="text-center">
                <div className="flex items-center justify-center space-x-2">
                  <button onClick={handlePrevPlan} className="p-2 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                  </button>
                  <h3 className="text-2xl font-bold text-slate-800 text-center w-56">
                    {CurrentPlan.name}
                  </h3>
                  <button onClick={handleNextPlan} className="p-2 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </button>
                </div>

                <div className="text-center my-6 py-4 border-y border-gray-200">
                  <span className="text-5xl font-extrabold text-slate-900">${CurrentPlan.price}</span>
                  <span className="text-xl font-medium text-slate-600">/mo</span>
                  <div className="flex items-center justify-center text-sm text-slate-500 mt-1">
                    <span>Approx. ${CurrentPlan.perVisitPrice}/visit</span>
                    <button onClick={() => setShowPricingModal(true)} className="ml-2 text-gray-400 hover:text-gray-600">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
                    </button>
                  </div>
                </div>

                <ul className="space-y-3 mb-8 text-left max-w-xs mx-auto">
                  {CurrentPlan.features.map((feature, index) => (
                    <li key={index} className="flex items-center text-slate-600">
                      <svg className="w-5 h-5 text-green-500 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      <span>{feature}</span>
                      {(feature.includes('Seasonal')) && (
                        <button onClick={() => setShowInfoModal(true)} className="ml-2 text-gray-400 hover:text-gray-600">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
                
                <button
                  onClick={() => handlePlanSelect(CurrentPlan.name, CurrentPlan.price - multiDogFee, multiDogFee)}
                  className="w-full bg-[var(--brand-green)] text-white font-bold text-lg py-4 rounded-lg hover:bg-opacity-90 transition shadow-lg"
                >
                  Select {planDetails[selectedPlanTab].name}
                </button>
                
                <button
                  onClick={() => setView('onetime')}
                  className="w-full text-center text-sm text-gray-600 hover:text-blue-600 transition-colors mt-8"
                >
                  Looking for a One-Time Cleanup?
                </button>
              </div>
            </div>
          )}
          
          {/* Estate View */}
          {view === 'estate' && (
            <LeadForm
              title="You Qualify for our 'Estate Plan'"
              description="Our standard plans are for lots up to 1/2 acre. Because your property is larger, it requires a custom-quoted flat monthly rate. This ensures we can dedicate the appropriate time to keep your entire property perfect."
              onSubmit={() => {}} // Submission is handled inside LeadForm
              onBack={() => setView('yard')}
            />
          )}

          {/* Multi-Pet View */}
          {view === 'multipet' && (
            <LeadForm
              title="You Qualify for our 'Custom Multi-Pet' Plan"
              description="We love dogs! Properties with 6 or more dogs require a custom service plan to ensure we can keep up with the 'demand.' This allows us to dedicate the appropriate time for a full, comprehensive cleanup at every visit."
              onSubmit={() => {}} // Submission is handled inside LeadForm
              onBack={() => setView('dogs')}
            />
          )}
          
          {/* One-Time Cleanup View */}
          {view === 'onetime' && (
            <div className="bg-white p-6 md:p-8 rounded-xl shadow-lg fade-in">
              <button onClick={() => setView('packages')} className="text-sm text-gray-600 hover:text-blue-600 mb-4">&larr; Back to Plans</button>
              <h2 className="text-2xl font-bold text-slate-800 text-center mb-4">The "One-Time Yard Reset"</h2>
              
              <div className="text-center my-6 py-4 border-y border-gray-200">
                <span className="text-5xl font-extrabold text-slate-900">$99.99</span>
                <p className="text-sm text-slate-500 mt-1">For the first 30 minutes</p>
              </div>

              <p className="text-slate-600 text-center mb-4">
                Perfect for first-time cleanups or special events. This price includes 30 minutes of service. Additional time is billed at $1/minute.
              </p>
              <p className="text-slate-600 text-center text-sm mb-6">
                This service is for properties up to 1/2 acre. For larger properties, please <button onClick={() => setView('estate')} className="font-bold underline text-blue-600 hover:text-blue-700">request an 'Estate Quote'</button>.
              </p>

              {/* The Upsell */}
              <div className="bg-green-50 border-l-4 border-green-500 text-green-800 p-4 rounded-r-lg mb-6">
                <p className="font-bold">P.S. Why pay $100 for one day?</p>
                <p className="text-sm">
                  Our <strong>'Pristine-Clean' Weekly Plan</strong> is only ${basePrices.weekly + multiDogFee}/month. 
                  <button onClick={() => setView('packages')} className="font-bold underline ml-1 hover:text-green-600">
                    Click here to see our plans!
                  </button>
                </p>
              </div>

              <button
                onClick={() => setView('onetime_form')}
                className="w-full bg-[var(--brand-blue)] text-white font-bold text-lg py-4 rounded-lg hover:bg-opacity-90 transition shadow-lg"
              >
                Book One-Time Cleanup
              </button>
            </div>
          )}
          
          {/* One-Time Cleanup Form */}
          {view === 'onetime_form' && (
            <LeadForm
              title="Book Your 'One-Time Yard Reset'"
              description={`Your quote is $99.99 for the first 30 minutes (plus $1/min after). We'll confirm your details and schedule your cleanup.`}
              onSubmit={() => {}} // Submission is handled inside LeadForm
              onBack={() => setView('onetime')}
            />
          )}

        </div>
      </main>
      
      {showInfoModal && <ServiceInfoModal onClose={() => setShowInfoModal(false)} />}
      {showPricingModal && <PricingInfoModal onClose={() => setShowPricingModal(false)} />}
      <Footer />
    </>
  );
};

export default App;





