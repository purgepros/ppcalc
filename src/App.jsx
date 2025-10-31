import React, { useState, useEffect, useMemo } from 'react';

// --- Configuration ---
const GOHIGHLEVEL_WEBHOOK_URL = 'https://services.leadconnectorhq.com/hooks/YzqccfNpAoMTt4EZO92d/webhook-trigger/7447af3a-4358-4c9f-aa25-3c221e72ada4';
const emailJsConfig = {
  serviceID: 'service_b0us6cq',
  templateID: 'template_uwysfzx', // Customer-facing template
  publicKey: 'WV8jyfhbDQ7kuvIrx'
};
const FACEBOOK_PIXEL_ID = '770811879146972';
const APPROVED_ZIP_CODES = ['46011', '46012', '46013', '46014', '46015', '46016', '46032', '46033', '46034', '46035', '46036', '46037', '46038', '46039', '46040', '46041', '46048', '46049', '46055', '46056', '46060', '46061', '46062', '46063', '46064', '46065', '46068', '46069', '46071', '46072', '46074', '46075', '46076', '46077', '46082', '46085', '46163', '46201', '46202', '46203', '46204', '46205', '46206', '46207', '46208', '46209', '46211', '46214', '46216', '46217', '46218', '46219', '46220', '46221', '46222', '46223', '46224', '46225', '46226', '46227', '46228', '46229', '46230', '46231', '46234', '46235', '46236', '46237', '46239', '46240', '46241', '46242', '46244', '46247', '46249', '46250', '46251', '46253', '46254', '46255', '46256', '46259', '46260', '46266', '46268', '46278', '46280', '46282', '46283', '46285', '46290', '46291', '46295', '46296', '46298'];

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
    features: [
      'Service Every Week',
      'Full Property Coverage (Front &Sides)',
      'Waste Hauled Away',
      'Seasonal Deodorizer',
      'Seasonal WYSI Wash Sanitizer',
    ],
  },
  twiceWeekly: {
    name: 'Pristine-Plus',
    price: basePrices.twiceWeekly,
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
 * VIEW 1: The Gate (Zip Code Validator)
 */
const ZipCodeValidator = ({ onZipValidated }) => {
  const [zip, setZip] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!/^\d{5}$/.test(zip)) {
      setError('Please enter a valid 5-digit ZIP code.');
      return;
    }
    if (!APPROVED_ZIP_CODES.includes(zip)) {
      setError("We're sorry, but we do not service this area at this time.");
      return;
    }
    // Valid zip
    setError('');
    onZipValidated(zip);
  };

  return (
    <div className="bg-white p-8 rounded-xl shadow-lg fade-in">
      <h2 className="text-2xl font-bold text-slate-800 text-center mb-6">Enter your zip code to see our plans.</h2>
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
const Sorter = ({ onSortComplete, onBack, initialYardSize, initialDogCount }) => {
  const [yardSize, setYardSize] = useState(initialYardSize);
  const [dogCount, setDogCount] = useState(initialDogCount);

  const handleSubmit = () => {
    const fee = dogFeeMap[dogCount] ?? 0; // Default to 0 if 6+
    onSortComplete(yardSize, dogCount, fee);
  };

  return (
    <div className="bg-white p-8 rounded-xl shadow-lg fade-in">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-800 text-center mb-2">1. What is your property size?</h2>
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
        <h2 className="text-2xl font-bold text-slate-800 text-center mb-4">2. How many dogs do you have?</h2>
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
      
      <div className="bg-green-100 border-l-4 border-green-500 text-green-900 p-4 rounded-r-lg mb-6 shadow-md flex items-center space-x-3">
        <svg className="w-8 h-8 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
        <div>
          <p className="font-bold text-lg">Special Offer:</p>
          <p className="text-sm font-semibold">All new weekly service plans include a <strong>Free First Cleanup!</strong></p>
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
 * VIEW 3B: The "Package Selection" (The Grand Slam)
 */
const PackageSelector = ({ dogFee, dogCount, onPlanSelect, onBack, onOneTimeClick, onInfoClick }) => {
  const plans = [
    { key: 'biWeekly', ...planDetails.biWeekly, finalPrice: planDetails.biWeekly.price + dogFee },
    { key: 'weekly', ...planDetails.weekly, finalPrice: planDetails.weekly.price + dogFee, popular: true },
    { key: 'twiceWeekly', ...planDetails.twiceWeekly, finalPrice: planDetails.twiceWeekly.price + dogFee },
  ];
  
  const dogText = dogCount === '1-2' ? '1-2 Dogs' : `${dogCount} Dogs`;

  return (
    <div className="bg-white p-6 md:p-8 rounded-xl shadow-lg fade-in">
      <button onClick={onBack} className="text-sm text-gray-600 hover:text-blue-600 hover:underline mb-4">&larr; Back to Selections</button>
      <h2 className="text-2xl font-bold text-slate-800 text-center mb-6">3. Choose Your 'Pristine Yard' Plan</h2>
      
      <div className="bg-green-100 border-l-4 border-green-500 text-green-900 p-4 rounded-r-lg mb-6 shadow-md flex items-center space-x-3">
        <svg className="w-8 h-8 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
        <div>
          <p className="font-bold text-lg">Special Offer:</p>
          <p className="text-sm font-semibold">All new weekly service plans include a <strong>Free First Cleanup!</strong></p>
        </div>
      </div>

      <div className="space-y-4">
        {plans.map((plan) => (
          <div key={plan.key} className={`relative p-6 border-2 rounded-xl transition-all ${plan.popular ? 'border-[var(--brand-green)] shadow-lg' : 'border-gray-300'}`}>
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
            
            <ul className="space-y-3 mb-8 text-left max-w-xs mx-auto">
              <li className="flex items-center text-slate-600">
                <svg className="w-5 h-5 text-green-500 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <span>Service for {dogText}</span>
              </li>
              {plan.features.map((feature, index) => (
                <li key={index} className="flex items-center text-slate-600">
                  <svg className="w-5 h-5 text-green-500 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <span>{feature}</span>
                  {(feature.includes('Seasonal')) && (
                    <button onClick={onInfoClick} className="ml-2 text-gray-400 hover:text-gray-600 transition-transform hover:scale-125">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
                    </button>
                  )}
                </li>
              ))}
            </ul>
            
            <button
              onClick={() => onPlanSelect(plan.name, plan.finalPrice)}
              className="w-full bg-[var(--brand-green)] text-white font-bold text-lg py-4 rounded-lg hover:bg-opacity-90 transition-all duration-200 transform hover:-translate-y-0.5 shadow-lg hover:shadow-xl"
            >
              Select {plan.name}
            </button>
          </div>
        ))}
      </div>
      
      <button
        onClick={onOneTimeClick}
        className="w-full text-center text-sm text-gray-600 hover:text-blue-600 hover:underline transition-colors mt-8"
      >
        Looking for a One-Time Cleanup?
      </button>
    </div>
  );
};

/**
 * VIEW 4: The "Payment Plan" (The Cash Multiplier)
 */
const PaymentPlanSelector = ({ finalMonthlyPrice, onPaymentSelect, onBack, initialPaymentTerm }) => {
  const plans = [
    {
      term: 'Monthly',
      price: finalMonthlyPrice,
      total: finalMonthlyPrice,
      description: `Billed every month`,
      savings: null,
      chargeAmount: finalMonthlyPrice,
    },
    {
      term: 'Quarterly',
      price: (finalMonthlyPrice * 3) - 30,
      total: (finalMonthlyPrice * 3) - 30,
      description: `Billed every 3 months`,
      savings: "Save $30!",
      chargeAmount: (finalMonthlyPrice * 3) - 30,
    },
    {
      term: 'Annual',
      price: finalMonthlyPrice * 11,
      total: finalMonthlyPrice * 11,
      description: `Billed once a year`,
      savings: `Save $${finalMonthlyPrice} - 1 Month FREE!`,
      chargeAmount: finalMonthlyPrice * 11,
    }
  ];

  return (
    <div className="bg-white p-6 md:p-8 rounded-xl shadow-lg fade-in">
      <button onClick={onBack} className="text-sm text-gray-600 hover:text-blue-600 hover:underline mb-4">&larr; Back to Plans</button>
      <h2 className="text-2xl font-bold text-slate-800 text-center mb-6">4. Choose Your Payment Plan & Lock In Savings</h2>
      
      <div className="space-y-4">
        {plans.map((plan) => (
          <button
            key={plan.term}
            onClick={() => onPaymentSelect(plan.term, plan.chargeAmount, plan.savings)}
            className={`w-full text-left p-6 border-2 rounded-xl transition-all hover:-translate-y-1 hover:border-blue-400 hover:shadow-lg ${
              initialPaymentTerm === plan.term
                ? 'border-blue-500 bg-blue-50 shadow-lg'
                : 'border-gray-300 bg-white'
            }`}
          >
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-2xl font-bold text-slate-800">{plan.term} Plan</h3>
              {plan.savings && (
                <span className="text-sm font-bold text-white bg-[var(--brand-green)] px-3 py-1 rounded-full">
                  {plan.savings}
                </span>
              )}
            </div>
            <p className="text-3xl font-extrabold text-slate-900">${plan.total}</p>
            <p className="text-sm text-slate-600">{plan.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
};


/**
 * VIEW 3A / VIEW 5: The Lead Form (Custom Quote & Final Checkout)
 */
const LeadForm = ({ title, description, onBack, onSubmitSuccess, zipCode, dogCount, quoteData = null }) => {
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

    let leadData, emailParams, quoteLinkState, fbTrackEvent;
    
    // Calculate per_visit price just for the email, IF it's a standard plan
    let perVisitPrice = 'N/A';
    if (quoteData) {
      const planKey = Object.keys(planDetails).find(key => planDetails[key].name === quoteData.planName);
      if (planKey) {
        // Find visitsPerMonth - this logic is no longer in the main app, so we recreate it here
        const visitsPerMonth = { biWeekly: 26/12, weekly: 52/12, twiceWeekly: 104/12 };
        perVisitPrice = (quoteData.finalMonthlyPrice / visitsPerMonth[planKey]).toFixed(2);
      }
    }


    if (quoteData) {
      // VIEW 5: Final Checkout Logic
      fbTrackEvent = 'CompleteRegistration';
      quoteLinkState = {
        zip: zipCode,
        dogCount: dogCount,
        plan: quoteData.planName,
        paymentTerm: quoteData.paymentTerm,
      };
      
      leadData = {
        ...formData,
        zip: zipCode,
        lead_status: 'Complete - Plan Selected',
        quote_type: quoteData.planName,
        plan: quoteData.planName,
        dog_count: dogCount,
        total_monthly_rate: quoteData.finalMonthlyPrice,
        payment_term: quoteData.paymentTerm,
        final_charge_amount: quoteData.finalChargeAmount,
        savings: quoteData.savings || 'N/A',
        quote_link: generateQuoteLink(quoteLinkState),
      };

      emailParams = {
        ...formData,
        ...leadData, // Send everything
        description: `Plan: ${quoteData.planName} (${quoteData.paymentTerm})`,
        total_monthly: `$${quoteData.finalMonthlyPrice}/mo`, // For consistency, though new fields are better
        per_visit: `$${perVisitPrice}`,
        final_charge: `$${quoteData.finalChargeAmount} (Billed ${quoteData.paymentTerm})`,
      };

    } else {
      // VIEW 3A: Custom Quote Logic OR One-Time Form
      fbTrackEvent = 'Lead';
      
      const isOneTime = title.includes("One-Time");
      
      quoteLinkState = {
        zip: zipCode,
        dogCount: dogCount,
      };
      
      let leadStatus, quoteType, planName;
      if (isOneTime) {
        leadStatus = 'One-Time Cleanup Request';
        quoteType = 'One-Time Cleanup';
        planName = 'One-Time Cleanup';
      } else {
        leadStatus = dogCount === '6+' ? 'Custom - Multi-Pet' : 'Custom - Estate';
        quoteType = 'Custom Quote Request';
        planName = 'Custom Quote';
      }

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
        total_monthly: isOneTime ? '$99.99 (first 30 min)' : 'Custom Quote',
        per_visit: 'N/A',
        final_charge: 'N/A',
        savings: 'N/A',
      };
    }
    
    // 1. Fire FB event
    fbq('track', fbTrackEvent);
    
    // 2. Send to Webhook
    await sendToWebhook(leadData);
    
    // 3. Send Email
    await sendEmail(emailParams);

    setIsSubmitting(false);
    setIsSubmitted(true);
    if (onSubmitSuccess) {
      onSubmitSuccess();
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
          {quoteData
            ? "We've received your request! We will contact you shortly to confirm your service start date and finalize payment."
            : (title.includes("One-Time")
              ? "We've received your cleanup request! We'll contact you shortly to get you on the schedule."
              : "We've received your request and will contact you shortly to provide your free custom quote."
            )
          }
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
          {isSubmitting ? <span className="loader"></span> : (quoteData ? 'Complete My Quote!' : 'Request My Quote')}
        </button>
      </form>
      <button
        onClick={onBack}
        className="w-full text-center text-sm text-gray-600 hover:text-blue-600 hover:underline transition-colors mt-6"
      >
        &larr; Go Back
      </button>
    </div>
  );
};

const ServiceInfoModal = ({ onClose }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
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
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
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

const ExitIntentModal = ({ onClose, currentPlan, zipCode, yardSize }) => {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  
  // Calculate per_visit for the exit modal email
  let perVisitPrice = 'N/A';
  if (currentPlan && currentPlan.name) {
      const planKey = Object.keys(planDetails).find(key => planDetails[key].name === currentPlan.name);
      if (planKey) {
        // Find visitsPerMonth - this logic is no longer in the main app, so we recreate it here
        const visitsPerMonth = { biWeekly: 26/12, weekly: 52/12, twiceWeekly: 104/12 };
        perVisitPrice = (currentPlan.price / visitsPerMonth[planKey]).toFixed(2);
      }
  }


  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) return;
    setIsSubmitting(true);

    // --- NEW: Generate quote link for exit intent ---
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

    // 1. Fire FB Event
    fbq('track', 'Lead');

    // 2. Send to Webhook
    await sendToWebhook(leadData);

    // 3. Send Email
    await sendEmail({
      email: email,
      name: 'Valued Customer',
      plan: currentPlan.name,
      total_monthly: `$${currentPlan.price}/mo`,
      dog_count: currentPlan.dogCount,
      description: 'Here is the custom quote you built on our site. We hope to see you soon!',
      notes: 'User captured on exit intent.',
      quote_link: quote_link,
      per_visit: `$${perVisitPrice}`, // Add per_visit price
      final_charge: 'N/A',
      savings: 'N/A',
    });

    setIsSubmitting(false);
    setIsSubmitted(true);
    setTimeout(onClose, 2500);
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
            <h3 className="text-2xl font-bold text-gray-900 text-center">Leaving So Soon?</h3>
            <p className="text-sm text-gray-600 mt-4 text-center">
              Before you go, let us email you this quote! We'll also include our <strong>Free 5-Point Pet Safety Checklist for Yards</strong>.
            </p>
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


const Header = () => (
  <header className="py-6">
    <div className="container mx-auto px-4 flex justify-center">
      <a href="https://itspurgepros.com/" className="transition-all hover:opacity-80 hover:scale-105">
        <img src="https://storage.googleapis.com/msgsndr/YzqccfNpAoMTt4EZO92d/media/68140f6288b94e80fb043618.png" alt="Purge Pros Logo" className="h-32 md:h-40" />
      </a>
    </div>
  </header>
);

const Footer = () => {
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
              <li>5625 N GERMAN CHURCH RD. UNIT 2036, INDIANAPOLIS INDIANA 46235</li>
              <li><a href="tel:3176997667" className="hover:text-white hover:underline">(317) 699-7667</a></li>
              <li><a href="tel:3179615865" className="hover:text-white hover:underline">(317) 961-5865</a></li>
              <li><a href="mailto:matt@itspurgepros.com" className="hover:text-white hover:underline">matt@itspurgepros.com</a></li>
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
  const [view, setView] = useState('zip'); // 'zip' -> 'sorter' -> 'custom_quote' OR 'packages' -> 'payment_plan' -> 'checkout'
  const [zipCode, setZipCode] = useState('');
  const [yardSize, setYardSize] = useState('standard');
  const [dogCount, setDogCount] = useState('1-2');
  const [multiDogFee, setMultiDogFee] = useState(0);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [isFormSubmitted, setIsFormSubmitted] = useState(false);
  
  // New state for the full funnel
  const [packageSelection, setPackageSelection] = useState({ name: null, finalMonthlyPrice: 0 });
  const [paymentSelection, setPaymentSelection] = useState({ term: 'Monthly', chargeAmount: 0, savings: null });
  
  const [isExitModalOpen, setIsExitModalOpen] = useState(false);

  // Load external scripts and init pixel on mount
  useEffect(() => {
    initFacebookPixel();
    loadScript('https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js', 'emailjs-sdk')
      .catch(error => console.error(error));

    // --- NEW: URL Parameter "Transposer" Logic ---
    const params = new URLSearchParams(window.location.search);
    const urlZip = params.get('zip');
    const urlYardSize = params.get('yardSize');
    const urlDogCount = params.get('dogCount');
    const urlPlan = params.get('plan');
    const urlPaymentTerm = params.get('paymentTerm');

    if (urlZip && APPROVED_ZIP_CODES.includes(urlZip)) {
      setZipCode(urlZip);
      
      // If zip is valid, check for other params
      if (urlYardSize === 'estate') {
        setYardSize('estate');
        setDogCount(urlDogCount || '1-2'); // Set dog count if present
        setView('custom_quote'); // Go straight to estate form
        return;
      }

      // Pre-fill sorter
      if (urlYardSize) setYardSize(urlYardSize);
      
      if (urlDogCount) {
        if (dogFeeMap[urlDogCount] !== undefined) {
          setDogCount(urlDogCount);
          setMultiDogFee(dogFeeMap[urlDogCount]);
        } else if (urlDogCount === '6+') {
          setDogCount('6+');
          setView('custom_quote'); // Go to multi-pet form
          return;
        }
      }
      
      // Pre-fill plan
      if (urlPlan) {
        const planKey = Object.keys(planDetails).find(key => planDetails[key].name === urlPlan);
        if (planKey) {
          const finalPrice = planDetails[planKey].price + (dogFeeMap[urlDogCount] || 0);
          setPackageSelection({ name: urlPlan, finalMonthlyPrice: finalPrice });

          // If plan is set, pre-fill payment term
          if (urlPaymentTerm) {
            setPaymentSelection(prev => ({ ...prev, term: urlPaymentTerm }));
            // We have everything, go to payment plan
            setView('payment_plan'); // Go to payment plan to calculate final charge, then user clicks to checkout
            return;
          }
          
          // We have a plan, go to package selection
          setView('packages'); // Go to packages, let user click through
          return;
        }
      }

      // If we got this far with a valid zip, skip zip and go to sorter
      setView('sorter');

    } else {
      // No valid zip in URL, show zip validator
      setView('zip');
    }
  }, []);

  // --- Exit Intent Hook ---
  const handleExitIntent = () => {
    // Only show exit modal if they are on a step *after* the zip code
    if (view !== 'zip' && view !== 'checkout' && !isFormSubmitted) {
      setIsExitModalOpen(true);
    }
  };
  useExitIntent(isFormSubmitted, handleExitIntent); // New hook usage
  
  const handleFormSubmissionSuccess = () => {
    setIsFormSubmitted(true);
    setIsExitModalOpen(false); 
  };

  // --- NEW: Handler for Zip Validator ---
  const handleZipValidation = (validZip) => {
    setZipCode(validZip);
    setView('sorter'); // Move to Sorter (VIEW 2)
  };

  /**
   * VIEW 2: Sorter Completion Handler
   */
  const handleSorterComplete = (size, dogs, fee) => {
    setYardSize(size);
    setDogCount(dogs);
    setMultiDogFee(fee);

    if (size === 'estate') {
      setView('custom_quote'); // GOTO View 3A
    } else if (dogs === '6+') {
      setView('custom_quote'); // GOTO View 3A
    } else {
      setView('packages'); // GOTO View 3B
    }
  };
  
  /**
   * VIEW 3B: Package Selection Handler
   */
  const handlePlanSelect = (planName, finalMonthlyPrice) => {
    setPackageSelection({ name: planName, finalMonthlyPrice: finalMonthlyPrice });
    setView('payment_plan'); // GOTO View 4
  };

  /**
   * VIEW 4: Payment Plan Selection Handler
   */
  const handlePaymentPlanSelect = (term, chargeAmount, savings) => {
    setPaymentSelection({ term: term, chargeAmount: chargeAmount, savings: savings });
    setView('checkout'); // GOTO View 5
  };
  
  // This is still needed for the Exit Intent Modal
  const CurrentPlanForExitModal = useMemo(() => {
    // Find the plan they're looking at, or default to weekly
    const planName = packageSelection.name || 'Pristine-Clean';
    const planKey = Object.keys(planDetails).find(key => planDetails[key].name === planName) || 'weekly';
    const plan = planDetails[planKey];
    
    const totalMonthlyPrice = plan.price + multiDogFee;
    
    return { 
      ...plan, 
      price: totalMonthlyPrice,
      dogCount: dogCount,
    };
  }, [packageSelection, multiDogFee, dogCount]);

  return (
    <>
      <GlobalStyles />
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-xl mx-auto">
          
          {/* --- NEW: Step 0 - Zip Code --- */}
          {view === 'zip' && (
            <ZipCodeValidator onZipValidated={handleZipValidation} />
          )}

          {/* --- Step 1 & 2: Sorter (VIEW 2) --- */}
          {view === 'sorter' && (
            <Sorter
              onSortComplete={handleSorterComplete}
              onBack={() => setView('zip')}
              initialYardSize={yardSize}
              initialDogCount={dogCount}
            />
          )}
          
          {/* --- Step 3: Packages (VIEW 3B) --- */}
          {view === 'packages' && (
            <PackageSelector
              dogFee={multiDogFee}
              dogCount={dogCount}
              onPlanSelect={handlePlanSelect}
              onBack={() => setView('sorter')}
              onOneTimeClick={() => setView('onetime')}
              onInfoClick={() => setShowInfoModal(true)}
            />
          )}

          {/* --- Step 4: Payment Plan (VIEW 4) --- */}
          {view === 'payment_plan' && (
            <PaymentPlanSelector
              finalMonthlyPrice={packageSelection.finalMonthlyPrice}
              onPaymentSelect={handlePaymentPlanSelect}
              onBack={() => setView('packages')}
              initialPaymentTerm={paymentSelection.term}
            />
          )}

          {/* --- Step 5: Checkout (VIEW 5) --- */}
          {view === 'checkout' && (
            <LeadForm
              title="Great Choice! Let's Get You Set Up."
              description={`You're selecting the ${packageSelection.name} with ${paymentSelection.term} billing. We'll contact you to confirm your start date and set up payment.`}
              quoteData={{
                planName: packageSelection.name,
                finalMonthlyPrice: packageSelection.finalMonthlyPrice,
                paymentTerm: paymentSelection.term,
                finalChargeAmount: paymentSelection.chargeAmount,
                savings: paymentSelection.savings,
              }}
              zipCode={zipCode}
              dogCount={dogCount}
              onSubmitSuccess={handleFormSubmissionSuccess}
              onBack={() => setView('payment_plan')}
            />
          )}
          
          {/* --- Custom Quote (VIEW 3A) --- */}
          {view === 'custom_quote' && (
            <LeadForm
              title="You Qualify for a Custom 'Estate' Quote!"
              description={dogCount === '6+'
                ? "We love dogs! Properties with 6 or more dogs require a custom service plan. Please provide your info, and we will contact you for a free consultation."
                : "Your property qualifies for our 'Estate Plan.' This requires a custom flat-rate quote. Please provide your info, and we will contact you for a free consultation."
              }
              zipCode={zipCode}
              dogCount={dogCount}
              onSubmitSuccess={handleFormSubmissionSuccess}
              onBack={() => setView('sorter')}
            />
          )}
          
          {/* --- One-Time Cleanup View (KEPT) --- */}
          {view === 'onetime' && (
            <div className="bg-white p-6 md:p-8 rounded-xl shadow-lg fade-in">
              <button onClick={() => setView('packages')} className="text-sm text-gray-600 hover:text-blue-600 hover:underline mb-4">&larr; Back to Plans</button>
              <h2 className="text-2xl font-bold text-slate-800 text-center mb-4">The "One-Time Yard Reset"</h2>
              
              <div className="text-center my-6 py-4 border-y border-gray-200">
                <span className="text-5xl font-extrabold text-slate-900">$99.99</span>
                <p className="text-sm text-slate-500 mt-1">For the first 30 minutes</p>

              </div>

              <p className="text-slate-600 text-center mb-4">
                Perfect for first-time cleanups or special events. This price includes 30 minutes of service. Additional time is billed at $1/minute.
              </p>
              <p className="text-slate-600 text-center text-sm mb-6">
                This service is for properties up to 1/2 acre. For larger properties, please <button onClick={() => { setView('custom_quote'); setYardSize('estate'); }} className="font-bold underline text-blue-600 hover:text-blue-700">request an 'Estate Quote'</button>.
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
                className="w-full bg-[var(--brand-blue)] text-white font-bold text-lg py-4 rounded-lg hover:bg-opacity-90 transition-all duration-200 transform hover:-translate-y-0.5 shadow-lg hover:shadow-xl"
              >
                Book One-Time Cleanup
              </button>
            </div>
          )}
          
          {/* --- One-Time Cleanup Form (KEPT) --- */}
          {view === 'onetime_form' && (
            <LeadForm
              title="Book Your 'One-Time Yard Reset'"
              description={`Your quote is $99.99 for the first 30 minutes (plus $1/min after). We'll confirm your details and schedule your cleanup.`}
              zipCode={zipCode}
              dogCount={dogCount}
              onSubmitSuccess={handleFormSubmissionSuccess}
              onBack={() => setView('onetime')}
            />
          )}

        </div>
      </main>
      
      {/* --- Modals (KEPT) --- */}
      {showInfoModal && <ServiceInfoModal onClose={() => setShowInfoModal(false)} />}
      {showPricingModal && <PricingInfoModal onClose={() => setShowPricingModal(false)} />}
      
      {isExitModalOpen && (
        <ExitIntentModal
          currentPlan={CurrentPlanForExitModal}
          zipCode={zipCode}
          yardSize={yardSize}
          onClose={() => setIsExitModalOpen(false)}
        />
      )}
      <Footer />
    </>
  );
};

export default App;

