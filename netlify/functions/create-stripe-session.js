/*
 * --- NETLIFY FUNCTION FOR STRIPE CHECKOUT (UNIFIED SYSTEM) ---
 *
 * This backend handles the "Stripe Mode" toggle (Test vs Live).
 * It constructs the subscription by stacking products:
 * 1. Base Plan (Monthly/Quarterly/Annual)
 * 2. Lot Fee (If applicable)
 * 3. Extra Dog Fee (If applicable, via Quantity)
 * 4. Yard+ Add-on (If selected)
 *
 * NOTE: You must create "Annual" versions of your Add-ons in Stripe
 * (priced at 11x the monthly rate) to support the "1 Month Free" logic.
 */

const emailjs = require('@emailjs/nodejs');
const fetch = require('node-fetch');

// --- 1. THE PRICE MAPS (TEST VS LIVE) ---
// YOU MUST FILL IN THESE IDs FROM YOUR STRIPE DASHBOARD
const PRICE_MAP = {
  test: {
    oneTime: 'price_1SWViqGelkvkkUqXl8jzD7Za', // Your TEST One-Time ID
    
    // BASE PLANS (The core service)
    base: {
      'biWeekly': {
        'Monthly': 'price_1SWVVvGelkvkkUqXck6r6av3',
        'Quarterly': 'price_1SWVWbGelkvkkUqXl6w1RfSl',
        'Annual': 'price_1SWVWyGelkvkkUqX1KeQYW5h',
      },
      'weekly': {
        'Monthly': 'price_1SWVZKGelkvkkUqXYkPgNDSG',
        'Quarterly': 'price_1SWVZWGelkvkkUqX1Np1OeNm',
        'Annual': 'price_1SWVZKGelkvkkUqXYkPgNDSG',
      },
      'twiceWeekly': {
        'Monthly': 'price_1SWVb6GelkvkkUqX4foVUqXY',
        'Quarterly': 'price_1SWVbNGelkvkkUqX2lngbCgo',
        'Annual': 'price_1SWVbdGelkvkkUqXI3XYNfGI',
      }
    },

    // LOT SIZE FEES (The Land)
    lot: {
      'tier1': { // 1/4 to 1/2 Acre (+$30/mo)
        'Monthly': 'price_1SWVdQGelkvkkUqXSMk0z6CL',
        'Quarterly': 'price_1SWVdeGelkvkkUqXDpYTklRG',
        'Annual': 'price_1SWVdrGelkvkkUqXMcBwIOj7',
      },
      'tier2': { // 1/2 to 1 Acre (+$60/mo)
        'Monthly': 'price_1SWVeaGelkvkkUqXK9rgUEPP',
        'Quarterly': 'price_1SWVerGelkvkkUqX4HaPrZJw',
        'Annual': 'price_1SWVf5GelkvkkUqXPOZlsMn7',
      }
    },

    // EXTRA DOG FEE (The Volume)
    // This is a single price ID. We use "Quantity" to handle multiple dogs.
    extraDog: {
      'Monthly': 'price_1SWVfzGelkvkkUqXLwiDt8Vr',
      'Quarterly': 'price_1SWVgCGelkvkkUqXG1UkMUd8',
      'Annual': 'price_1SWVgTGelkvkkUqXDS818kCL',
    },

    // YARD+ ADD-ON
    yardPlus: {
      'Monthly': 'price_1SWVhtGelkvkkUqXF79CUu0x',
      'Quarterly': 'price_1SWVi5GelkvkkUqXH31oueSR',
      'Annual': 'price_1SWViLGelkvkkUqXHAvxbEbC'
    }
  },
  
  // --- LIVE MODE PRICES (Fill these in before launching!) ---
  live: {
    oneTime: 'price_1SWVoLGelkvkkUqXAJglWmsl', 
    base: {
      'biWeekly': { 'Monthly': 'price_1SWVnyGelkvkkUqX6tFDDXz7', 'Quarterly': 'price_1SWVnyGelkvkkUqXuGrXvcw3', 'Annual': 'price_1SWVnxGelkvkkUqXOlRaVL9S' },
      'weekly':   { 'Monthly': 'price_1SWVo3GelkvkkUqXCnSOQUlX',   'Quarterly': 'price_1SWVo3GelkvkkUqXWxOKACq0',   'Annual': 'price_1SWVo3GelkvkkUqXKRTnS2rh' },
      'twiceWeekly': { 'Monthly': 'price_1SWVo7GelkvkkUqXkKI4Av48', 'Quarterly': 'price_1SWVo7GelkvkkUqXpfp4U0gj', 'Annual': 'price_1SWVo7GelkvkkUqXl91VAnSf' }
    },
    lot: {
      'tier1': { 'Monthly': 'price_1SWVoBGelkvkkUqX2YUDGmam', 'Quarterly': 'price_1SWVoBGelkvkkUqXyd7tyZmh', 'Annual': 'price_1SWVoBGelkvkkUqXiNLcsNlT' },
      'tier2': { 'Monthly': 'price_1SWVoEGelkvkkUqXdLeWEQJ0', 'Quarterly': 'price_1SWVoDGelkvkkUqX5OSZArod', 'Annual': 'price_1SWVoDGelkvkkUqXNIVTjjJK' }
    },
    extraDog: { 'Monthly': 'price_1SWVoGGelkvkkUqX2DEbVnE5', 'Quarterly': 'price_1SWVoGGelkvkkUqXeiwTA6o4', 'Annual': 'price_1SWVoGGelkvkkUqXuwY6aYBF' },
    yardPlus: { 'Monthly': 'price_1SWVoJGelkvkkUqXsInb8jeO', 'Quarterly': 'price_1SWVoJGelkvkkUqXnbFozIGa', 'Annual': 'price_1SWVoJGelkvkkUqXyRAJJ7vV' }
  }
};

// --- 2. THE MAIN FUNCTION HANDLER ---
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { 
    stripeMode = 'test', 
    paymentMethodId, 
    customer, 
    quote, 
    leadData, 
    emailParams,
    promo // Extract the promo object
  } = JSON.parse(event.body);

  // --- SELECT STRIPE SECRET KEY ---
  let secretKey;
  if (stripeMode === 'live') {
    secretKey = process.env.STRIPE_SECRET_KEY_LIVE;
  } else {
    secretKey = process.env.STRIPE_SECRET_KEY_TEST || process.env.STRIPE_SECRET_KEY;
  }

  if (!secretKey) {
    return { 
      statusCode: 500, 
      body: JSON.stringify({ status: 'error', message: `Server Error: Missing Stripe Secret Key for ${stripeMode} mode.` }) 
    };
  }

  const stripe = require('stripe')(secretKey);
  const selectedPrices = PRICE_MAP[stripeMode === 'live' ? 'live' : 'test'];

  try {
    let stripeAction;
    let isOneTime = false;

    // --- Create Stripe Customer ---
    const stripeCustomer = await stripe.customers.create({
      payment_method: paymentMethodId,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      address: { line1: customer.address, postal_code: quote.zipCode },
      invoice_settings: { default_payment_method: paymentMethodId },
    });

    // --- Logic Split: One-Time vs Subscription ---
    if (quote.paymentTerm === 'One-Time Deposit') {
      // ... One Time Logic ...
      isOneTime = true;
      stripeAction = await stripe.paymentIntents.create({
        amount: 9999, 
        currency: 'usd',
        customer: stripeCustomer.id,
        payment_method: paymentMethodId,
        off_session: true,
        confirm: true,
        description: 'One-Time Yard Reset (Deposit)',
      });
      
    } else {
      // --- SUBSCRIPTION STACKING LOGIC ---
      
      const items = [];
      const term = quote.paymentTerm; // "Monthly", "Quarterly", or "Annual"
      const planKey = quote.planKey;  // "weekly", "biWeekly", etc.
      
      // 1. BASE PLAN
      const baseId = selectedPrices.base[planKey]?.[term];
      if (!baseId) throw new Error(`Base Price ID missing for ${planKey} / ${term}`);
      items.push({ price: baseId });

      // 2. LOT SIZE FEE
      if (quote.yardSize === 'tier1') {
        const tier1Id = selectedPrices.lot.tier1?.[term];
        if (tier1Id) items.push({ price: tier1Id });
      } else if (quote.yardSize === 'tier2') {
        const tier2Id = selectedPrices.lot.tier2?.[term];
        if (tier2Id) items.push({ price: tier2Id });
      }

      // 3. EXTRA DOG FEE
      // We parse the dog count string "1-2", "3", "4" to a number
      let numDogs = 1;
      if (quote.dogCount === '1-2') numDogs = 1; // Base covers this
      else numDogs = parseInt(quote.dogCount, 10);

      if (numDogs > 2) {
        const extraDogs = numDogs - 2;
        const dogPriceId = selectedPrices.extraDog?.[term];
        if (dogPriceId) {
          items.push({ price: dogPriceId, quantity: extraDogs });
        }
      }

      // 4. YARD+ ADD-ON
      // Only add if selected AND not already included (Twice Weekly includes it)
      if (quote.yardPlusSelected && planKey !== 'twiceWeekly') {
        const yardPlusId = selectedPrices.yardPlus?.[term];
        if (yardPlusId) items.push({ price: yardPlusId });
      }

      // --- FIX 2: Prepare Subscription Options ---
      const subOptions = {
        customer: stripeCustomer.id,
        items: items,
      };

      // --- FIX 3: Apply Coupon using 'discounts' parameter ---
      // Stripe API v19+ requires 'discounts' array instead of 'coupon' string
      if (promo && promo.applied && promo.couponId) {
        subOptions.discounts = [{ coupon: promo.couponId }];
      }

      // Create the Subscription with the "Stack" (and optional discount)
      stripeAction = await stripe.subscriptions.create(subOptions);
    }

    // --- 3. Webhooks (GHL & EmailJS) ---
    try {
      if (process.env.GOHIGHLEVEL_WEBHOOK_URL) {
        await fetch(process.env.GOHIGHLEVEL_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(leadData),
        });
      }
    } catch (e) { console.error('GHL Webhook failed:', e); }
    
    try {
      const template = isOneTime
        ? process.env.EMAILJS_TEMPLATE_ID_ONETIME
        : process.env.EMAILJS_TEMPLATE_ID_SUBSCRIPTION;
      
      const safeParams = {
        ...emailParams,
        zip: emailParams.zip || 'N/A',
        dog_count: emailParams.dog_count || 'N/A'
      };

      await emailjs.send(
        process.env.EMAILJS_SERVICE_ID,
        template,
        safeParams,
        { publicKey: process.env.EMAILJS_PUBLIC_KEY, privateKey: process.env.EMAILJS_PRIVATE_KEY }
      );
    } catch (e) { console.error('EmailJS send failed:', e); }

    return {
      statusCode: 200,
      body: JSON.stringify({ status: 'success', data: stripeAction }),
    };

  } catch (error) {
    console.error('Stripe/Server Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ status: 'error', message: error.message }),
    };
  }
};