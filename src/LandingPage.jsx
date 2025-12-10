import React, { useState } from 'react';

const LandingPage = ({ config, onZipValidated, onCustomQuoteClick, onInfoClick }) => {
  const [zip, setZip] = useState('');
  const [error, setError] = useState('');

  // --- Dynamic Prices from Config ---
  // Default to 0 if loading, to prevent crash, though parent handles loading state
  const prices = config?.data?.basePrices || { biWeekly: 0, weekly: 0, twiceWeekly: 0 };

  // --- Handlers ---
  const handleZipSubmit = (e) => {
    e.preventDefault();
    const approvedZips = config?.data?.APPROVED_ZIP_CODES || [];
    
    // Basic format validation
    if (!/^\d{5}$/.test(zip)) {
      setError('Please enter a valid 5-digit ZIP code.');
      return;
    }
    // Database validation
    if (!approvedZips.includes(zip)) {
      setError("We're sorry, but we do not service this area at this time.");
      return;
    }
    
    setError('');
    onZipValidated(zip);
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    // Small timeout to allow scroll to start before focusing input
    setTimeout(() => {
        document.getElementById('zip-input')?.focus();
    }, 300);
  };

  return (
    <div className="font-sans text-slate-900 leading-relaxed bg-white w-full">
      
      {/* --- HERO SECTION --- */}
      <section className="relative bg-[#1a1a1a] text-white py-24 px-4 overflow-hidden">
        {/* Background Image Overlay */}
        <div className="absolute inset-0 z-0 opacity-70 bg-[url('https://storage.googleapis.com/msgsndr/YzqccfNpAoMTt4EZO92d/media/69280cb88f8797014a8c54dd.jpg')] bg-cover bg-center"></div>
        <div className="absolute inset-0 z-0 bg-gradient-to-b from-black/60 to-black/40"></div>

        <div className="container mx-auto max-w-6xl relative z-10 text-center">
          <div className="inline-block bg-[#38b6ff] text-white font-bold px-5 py-2 rounded-md uppercase tracking-wider text-sm mb-6 shadow-lg animate-pulse">
            Limited Offer: Free Initial Yard Reset ($99+ Value)
          </div>
          
          <h1 className="text-4xl md:text-6xl font-extrabold mb-6 leading-tight">
            Stop Living in a Toilet.<br />
            <span className="text-[#38b6ff]">Get a Pristine, Sanitized Yard 24/7.</span>
          </h1>
          
          <p className="text-gray-300 text-lg md:text-xl max-w-3xl mx-auto mb-10">
            The only pet waste service in Indy that <strong>Sanitizes, Deodorizes, and Hauls Away</strong>. No contracts. 100% Satisfaction Guarantee.
          </p>

          {/* --- ZIP CODE GATE --- */}
          <div className="bg-white text-gray-900 p-6 md:p-8 rounded-xl max-w-lg mx-auto shadow-2xl transform transition-transform hover:scale-[1.01]">
            <h3 className="text-xl font-bold mb-4">Check Availability & Get Your Price</h3>
            <form onSubmit={handleZipSubmit} className="flex flex-col md:flex-row gap-3">
              <input 
                id="zip-input"
                type="tel" 
                pattern="[0-9]*" 
                maxLength="5"
                className="flex-1 p-4 border-2 border-gray-300 rounded-lg text-lg focus:border-[#38b6ff] focus:outline-none transition-colors"
                placeholder="Enter Zip Code" 
                value={zip}
                onChange={(e) => setZip(e.target.value)}
                required
              />
              <button type="submit" className="bg-black text-[#38b6ff] font-bold uppercase py-4 px-8 rounded-lg hover:bg-gray-800 transition-colors shadow-md whitespace-nowrap">
                Get Started
              </button>
            </form>
            {error && <p className="text-red-600 font-bold mt-3 text-sm">{error}</p>}
            <p className="text-gray-500 text-xs mt-3">Instant online quote. No phone call required.</p>
          </div>
        </div>
      </section>

      {/* --- PROBLEM SECTION --- */}
      <section className="py-20 bg-white">
        <div className="container mx-auto max-w-6xl px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-extrabold mb-6">
                Cheap Scoopers Leave <span className="text-[#38b6ff]">The Danger Behind</span>
              </h2>
              <p className="text-gray-600 text-lg mb-8">
                Most "poop scoopers" charge $20 to move waste from your grass to your trash bin. That's not cleaning. That's just moving the problem.
              </p>
              
              <div className="space-y-6">
                <div className="flex items-start">
                  <span className="text-red-500 text-2xl mr-4 font-bold">✖</span>
                  <div>
                    <strong className="block text-gray-900 text-lg">The Bacteria Stays</strong>
                    <p className="text-gray-600">Parvo, Giardia, and E. Coli live in your soil long after the waste is gone.</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <span className="text-red-500 text-2xl mr-4 font-bold">✖</span>
                  <div>
                    <strong className="block text-gray-900 text-lg">The Smell Lingers</strong>
                    <p className="text-gray-600">Without professional deodorizer, your patio remains a "no-go zone."</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <span className="text-red-500 text-2xl mr-4 font-bold">✖</span>
                  <div>
                    <strong className="block text-gray-900 text-lg">The Bin Stinks</strong>
                    <p className="text-gray-600">They leave bags in <em>your</em> trash can to bake in the sun all week.</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="relative">
              <img 
                src="https://storage.googleapis.com/msgsndr/YzqccfNpAoMTt4EZO92d/media/693293301d466e353dc4236c.jpg" 
                alt="Dirty Yard" 
                className="rounded-2xl shadow-xl w-full object-cover h-[400px] opacity-90"
              />
              <div className="absolute -bottom-6 -left-6 bg-white p-4 rounded-lg shadow-lg hidden md:block">
                <div className="text-sm font-bold text-gray-500 uppercase tracking-wide">The Purge Pros Difference</div>
                <div className="text-2xl font-extrabold text-[#38b6ff]">100% Sanitized</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --- PRICING SECTION --- */}
      <section className="py-20 bg-black text-white">
        <div className="container mx-auto max-w-6xl px-4 text-center">
          <h2 className="text-3xl md:text-5xl font-extrabold mb-4">Choose Your Battle Plan</h2>
          <p className="text-gray-400 text-lg mb-12">From basic maintenance to total sanitization.</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            
            {/* PLAN 1: BI-WEEKLY */}
            <div className="bg-[#1a1a1a] border border-gray-800 rounded-2xl p-8 flex flex-col relative group hover:border-gray-600 transition-colors">
              <div className="text-2xl font-bold mb-2">Bi-Weekly Reset</div>
              <div className="text-4xl font-extrabold text-[#38b6ff] mb-2">
                ${prices.biWeekly}<span className="text-lg text-white font-medium">/mo</span>
              </div>
              <div className="text-gray-500 text-sm border-b border-gray-800 pb-6 mb-6">2 Visits / Month</div>
              
              <ul className="space-y-4 text-left flex-grow mb-8">
                <li className="flex items-start"><span className="text-[#38b6ff] mr-2">✔</span> Happy Dog Treato Drop!</li>
                <li className="flex items-start"><span className="text-[#38b6ff] mr-2">✔</span> Backyard Only Coverage</li>
                <li className="flex items-start"><span className="text-[#38b6ff] mr-2">✔</span> Pics of Locked Gates</li>
                
                <li className="flex items-start text-gray-600 line-through"><span className="text-red-500 mr-2">✖</span> NO Waste Hauled Away</li>
                <li className="flex items-start text-gray-600 line-through"><span className="text-red-500 mr-2">✖</span> NO Seasonal Sanitization</li>
                <li className="flex items-start text-gray-600 line-through"><span className="text-red-500 mr-2">✖</span> NO Yard+ Coverage Included</li>

                {/* ADDED BONUS */}
                <li className="flex items-start text-[#38b6ff] mt-4 pt-4 border-t border-gray-800">
                  <span className="mr-2">★</span> <strong>BONUS: FREE Initial Reset (Over $99)</strong>
                </li>
              </ul>
              <button onClick={scrollToTop} className="w-full bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 rounded-full transition-all cursor-pointer">
                Select Bi-Weekly
              </button>
              {/* ADDED YARD+ INFO */}
              <p className="text-xs text-gray-500 mt-3">Yard+ Available as $20/mo Add-on</p>
            </div>

            {/* PLAN 2: WEEKLY (POPULAR) */}
            <div className="bg-[#222] border-2 border-[#38b6ff] rounded-2xl p-8 flex flex-col relative transform md:scale-105 shadow-[0_0_30px_rgba(56,182,255,0.15)] z-10">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-[#38b6ff] text-white text-xs font-bold px-4 py-1 rounded-full uppercase tracking-wider">
                Most Popular
              </div>
              <div className="text-2xl font-bold mb-2">Pristine-Clean</div>
              <div className="text-4xl font-extrabold text-[#38b6ff] mb-2">
                ${prices.weekly}<span className="text-lg text-white font-medium">/mo</span>
              </div>
              <div className="text-gray-500 text-sm border-b border-gray-800 pb-6 mb-6">4-5 Visits / Month (Weekly)</div>
              
              <ul className="space-y-4 text-left flex-grow mb-8">
                <li className="flex items-start font-bold"><span className="text-[#38b6ff] mr-2">✔</span> Happy Dog Treato Drop!</li>
                <li className="flex items-start"><span className="text-[#38b6ff] mr-2">✔</span> <strong>Waste Hauled Away</strong></li>
                <li className="flex items-start">
                  <span className="text-[#38b6ff] mr-2">✔</span> 
                  <div>
                    <strong>Seasonal Sanitization</strong>
                    <button onClick={onInfoClick} className="ml-1 text-gray-500 hover:text-white cursor-pointer"><svg className="w-4 h-4 inline" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"/></svg></button>
                    <p className="text-xs text-gray-400 font-normal">($500/yr Value)</p>
                  </div>
                </li>
                <li className="flex items-start"><span className="text-[#38b6ff] mr-2">✔</span> Backyard Only Coverage</li>
                
                {/* ADDED EXCLUDED YARD+ */}
                <li className="flex items-start text-gray-600 line-through"><span className="text-red-500 mr-2">✖</span> NO Yard+ Coverage Included</li>
                
                <li className="flex items-start text-[#38b6ff] mt-4 pt-4 border-t border-gray-800">
                  <span className="mr-2">★</span> <strong>BONUS: FREE Initial Reset (Over $99)</strong>
                </li>
              </ul>
              <button onClick={scrollToTop} className="w-full bg-[#38b6ff] hover:bg-[#2ea0e6] text-white font-bold py-3 rounded-full transition-all shadow-lg hover:-translate-y-1 cursor-pointer">
                Select Weekly
              </button>
              <p className="text-xs text-gray-500 mt-3">Yard+ Available as $20/mo Add-on</p>
            </div>

            {/* PLAN 3: TWICE WEEKLY */}
            <div className="bg-[#1a1a1a] border border-gray-800 rounded-2xl p-8 flex flex-col relative group hover:border-gray-600 transition-colors">
              <div className="text-2xl font-bold mb-2">Pristine-Plus</div>
              <div className="text-4xl font-extrabold text-[#38b6ff] mb-2">
                ${prices.twiceWeekly}<span className="text-lg text-white font-medium">/mo</span>
              </div>
              <div className="text-gray-500 text-sm border-b border-gray-800 pb-6 mb-6">8-9 Visits / Month (Twice-Weekly)</div>
              
              <ul className="space-y-4 text-left flex-grow mb-8">
                <li className="flex items-start">
                  <span className="text-[#38b6ff] mr-2">✔</span> 
                  <div>
                    <strong>Yard+ Coverage Included</strong>
                    <p className="text-xs text-gray-400 font-normal">Front, Sides & Back Yard</p>
                  </div>
                </li>
                <li className="flex items-start"><span className="text-[#38b6ff] mr-2">✔</span> <strong>Twice-Weekly Visits</strong></li>
                <li className="flex items-start"><span className="text-[#38b6ff] mr-2">✔</span> Happy Dog Treato Drop!</li>
                <li className="flex items-start"><span className="text-[#38b6ff] mr-2">✔</span> Waste Hauled Away</li>
                
                <li className="flex items-start">
                  <span className="text-[#38b6ff] mr-2">✔</span> 
                  <div>
                    <strong>Seasonal Sanitization</strong>
                    {/* ADDED INFO ICON */}
                    <button onClick={onInfoClick} className="ml-1 text-gray-500 hover:text-white cursor-pointer"><svg className="w-4 h-4 inline" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"/></svg></button>
                  </div>
                </li>

                <li className="flex items-start text-[#38b6ff] mt-4 pt-4 border-t border-gray-800">
                  <span className="mr-2">★</span> <strong>BONUS: FREE Initial Reset (Over $99)</strong>
                </li>
              </ul>
              <button onClick={scrollToTop} className="w-full bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 rounded-full transition-all cursor-pointer">
                Select Pristine-Plus
              </button>
            </div>

          </div>
          {/* ADDED GLOBAL DISCLAIMER */}
          <p className="text-center text-gray-500 text-sm mt-8">Base pricing for up to 2 dogs and standard lot size.</p>
        </div>
      </section>

      {/* --- HOW IT WORKS --- */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto max-w-6xl px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-extrabold mb-12 text-gray-900">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-xl shadow-sm">
              <div className="w-12 h-12 bg-[#38b6ff] text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-6">1</div>
              <h3 className="text-xl font-bold mb-3 text-gray-900">Get Your Price</h3>
              <p className="text-gray-600">Enter your zip code and answer 2 quick questions to see your instant flat-rate price.</p>
            </div>
            <div className="bg-white p-8 rounded-xl shadow-sm">
              <div className="w-12 h-12 bg-[#38b6ff] text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-6">2</div>
              <h3 className="text-xl font-bold mb-3 text-gray-900">Secure Your Spot</h3>
              <p className="text-gray-600">Select your plan and book online. No phone tag. No cash under the mat.</p>
            </div>
            <div className="bg-white p-8 rounded-xl shadow-sm">
              <div className="w-12 h-12 bg-[#38b6ff] text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-6">3</div>
              <h3 className="text-xl font-bold mb-3 text-gray-900">We Reset & Maintain</h3>
              <p className="text-gray-600">We perform your FREE Initial Reset, then show up every week to keep it perfect.</p>
            </div>
          </div>
        </div>
      </section>

      {/* --- MANUAL RAMP --- */}
      <section className="py-12 bg-white border-t border-gray-100 text-center">
        <div className="container mx-auto px-4">
          <p className="text-gray-700">
            Have a complex property or estate (Over 1/2 Acre)? <button onClick={scrollToTop} className="text-[#38b6ff] font-bold underline hover:text-[#2ea0e6] cursor-pointer">Click here for a Custom Proposal.</button>
          </p>
        </div>
      </section>

    </div>
  );
};

export default LandingPage;