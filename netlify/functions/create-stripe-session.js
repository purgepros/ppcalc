/*
 * --- NETLIFY FUNCTION FOR STRIPE CHECKOUT ---
 *
 * This backend handles the "Stripe Mode" toggle (Test vs Live).
 * It selects the correct Secret Key and Price IDs based on the 'stripeMode' param.
 */

const emailjs = require('@emailjs/nodejs');
const fetch = require('node-fetch');

// --- 1. THE PRICE MAPS (TEST VS LIVE) ---
// Stripe Price IDs are different in Test Mode vs Live Mode.
// You must map them separately here.

const PRICE_MAP = {
  test: {
    oneTime: 'price_1SS2h6GelkvkkUqXn5QoA37X', // Your TEST One-Time ID
    subs: {
      'Bi-Weekly Reset': {
        '1-2': {
          'Monthly': 'price_1SRnhvGelkvkkUqXoy7Qefhk',
          'Quarterly': 'price_1SRnjCGelkvkkUqXxvkqUY5Y',
          'Annual': 'price_1SRnjQGelkvkkUqXD3WLIFQK',
        },
        '3': {
          'Monthly': 'price_1SRnjbGelkvkkUqXWMUbTJcj',
          'Quarterly': 'price_1SRnjnGelkvkkUqXqYGY72C4',
          'Annual': 'price_1SRnk0GelkvkkUqXWiTqnfJz',
        },
        '4': {
          'Monthly': 'price_1SRnkAGelkvkkUqXMej9i20q',
          'Quarterly': 'price_1SRnkNGelkvkkUqXD1xuiKmV',
          'Annual': 'price_1SRnkdGelkvkkUqX3bER93Od',
        },
        '5': {
          'Monthly': 'price_1SRnktGelkvkkUqX2yQ6hdj5',
          'Quarterly': 'price_1SRnl4GelkvkkUqXbzvhlUbH',
          'Annual': 'price_1SRnlVGelkvkkUqXaHXns6PX',
        },
      },
      'Pristine-Clean': {
        '1-2': {
          'Monthly': 'price_1SRnljGelkvkkUqXrWJbNsc0',
          'Quarterly': 'price_1SRnm1GelkvkkUqX2yuUtOpV',
          'Annual': 'price_1SRnmIGelkvkkUqXQZ1l5tXa',
        },
        '3': {
          'Monthly': 'price_1SRnmSGelkvkkUqXd6WFSU18',
          'Quarterly': 'price_1SRnmdGelkvkkUqXeJEkMZ9E',
          'Annual': 'price_1SRnmoGelkvkkUqXgRpwSIPE',
        },
        '4': {
          'Monthly': 'price_1SRnmyGelkvkkUqXfn9hznqW',
          'Quarterly': 'price_1SRnnHGelkvkkUqXMA6ENLgm',
          'Annual': 'price_1SRnnWGelkvkkUqXUNDAuOdI',
        },
        '5': {
          'Monthly': 'price_1SRnnnGelkvkkUqXFObuN8k5',
          'Quarterly': 'price_1SRno1GelkvkkUqX27eThN0U',
          'Annual': 'price_1SRnoGGelkvkkUqX4sERizjc',
        },
      },
      'Pristine-Plus': {
        '1-2': {
          'Monthly': 'price_1SRnoTGelkvkkUqXe3ifwiKk',
          'Quarterly': 'price_1SRnohGelkvkkUqXguRBbFcN',
          'Annual': 'price_1SRnouGelkvkkUqXlZnphHIM',
        },
        '3': {
          'Monthly': 'price_1SRnp6GelkvkkUqXd7xGDfqu',
          'Quarterly': 'price_1SRnpFGelkvkkUqX6YRg75c9',
          'Annual': 'price_1SRnpRGelkvkkUqXF5ym2ULq',
        },
        '4': {
          'Monthly': 'price_1SRnpeGelkvkkUqXdK8vbl04',
          'Quarterly': 'price_1SRnq5GelkvkkUqXHdhVJSn9',
          'Annual': 'price_1SRnqHGelkvkkUqXGS3icKUs',
        },
        '5': {
          'Monthly': 'price_1SRnqWGelkvkkUqXIruZuO2c',
          'Quarterly': 'price_1SRnqlGelkvkkUqX86DHtYxF',
          'Annual': 'price_1SRnr1GelkvkkUqXxKnK3zVT',
        },
      },
    }
  },
  
  // --- LIVE MODE PRICES (YOU MUST FILL THESE IN) ---
  live: {
    oneTime: 'price_1SUuFIGelkvkkUqXtekC4fp6', 
    subs: {
      'Bi-Weekly Reset': {
        '1-2': { 'Monthly': 'price_1SUuGmGelkvkkUqXV63LDMdB', 'Quarterly': 'price_1SUuGlGelkvkkUqXOIRfhnns', 'Annual': 'price_1SUuGjGelkvkkUqXruQo42U8' },
        '3':   { 'Monthly': 'price_1SUuGiGelkvkkUqXKMmid6hb', 'Quarterly': 'price_1SUuGgGelkvkkUqXJrHm0NSV', 'Annual': 'price_1SUuGfGelkvkkUqX6F3XHlCT' },
        '4':   { 'Monthly': 'price_1SUuGdGelkvkkUqXber95dcN', 'Quarterly': 'price_1SUuGcGelkvkkUqXSwNpQEP7', 'Annual': 'price_1SUuGaGelkvkkUqX5KA7wZBm' },
        '5':   { 'Monthly': 'price_1SUuGZGelkvkkUqXuQ3zaVxl', 'Quarterly': 'price_1SUuGXGelkvkkUqXXJpzfSf1', 'Annual': 'price_1SUuGTGelkvkkUqXCOlIN5G3' },
      },
      'Pristine-Clean': {
        '1-2': { 'Monthly': 'price_1SUuGQGelkvkkUqXNboXafRk', 'Quarterly': 'price_1SUuGPGelkvkkUqX7CrCZmjT', 'Annual': 'price_1SUuGNGelkvkkUqXyTyjqC69' },
        '3':   { 'Monthly': 'price_1SUuGMGelkvkkUqXihGtpf7t', 'Quarterly': 'price_1SUuGKGelkvkkUqXypTiNu2l', 'Annual': 'price_1SUuGJGelkvkkUqXtZsAgbX8' },
        '4':   { 'Monthly': 'price_1SUuGFGelkvkkUqXgnFoG3mW', 'Quarterly': 'price_1SUuGCGelkvkkUqXFitnH1qb', 'Annual': 'price_1SUuGAGelkvkkUqX1z2GA5uV' },
        '5':   { 'Monthly': 'price_1SUuG7GelkvkkUqX9MXsAK1b', 'Quarterly': 'price_1SUuG6GelkvkkUqXnN3S0tU2', 'Annual': 'price_1SUuG4GelkvkkUqX53xaJjl8' },
      },
      'Pristine-Plus': {
        '1-2': { 'Monthly': 'price_1SUuFyGelkvkkUqXq4zFDwhR', 'Quarterly': 'price_1SUuFwGelkvkkUqXO0vaWDNa', 'Annual': 'price_1SUuFuGelkvkkUqXZhpV8QP5' },
        '3':   { 'Monthly': 'price_1SUuFsGelkvkkUqXFnzDqS6G', 'Quarterly': 'price_1SUuFrGelkvkkUqXwRti5w9E', 'Annual': 'price_1SUuFpGelkvkkUqXEmgff84A' },
        '4':   { 'Monthly': 'price_1SUuFhGelkvkkUqXTZsaKgTd', 'Quarterly': 'price_1SUuFfGelkvkkUqXETCkc7oE', 'Annual': 'price_1SUuFdGelkvkkUqX9kZwzWcu' },
        '5':   { 'Monthly': 'price_1SUuFcGelkvkkUqXKHvM5OIB', 'Quarterly': 'price_1SUuFXGelkvkkUqXj7jz6ptA', 'Annual': 'price_1SUuFUGelkvkkUqXokRICdsS' },
      },
    }
  }
};

// --- 2. THE MAIN FUNCTION HANDLER ---
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { 
    stripeMode = 'test', // Default to test if not provided
    paymentMethodId, 
    customer, 
    quote, 
    leadData, 
    emailParams 
  } = JSON.parse(event.body);

  // --- SELECT STRIPE SECRET KEY ---
  let secretKey;
  if (stripeMode === 'live') {
    secretKey = process.env.STRIPE_SECRET_KEY_LIVE;
  } else {
    // Fallback to the generic key if specific TEST key isn't set
    secretKey = process.env.STRIPE_SECRET_KEY_TEST || process.env.STRIPE_SECRET_KEY;
  }

  if (!secretKey) {
    return { 
      statusCode: 500, 
      body: JSON.stringify({ status: 'error', message: `Server Error: Missing Stripe Secret Key for ${stripeMode} mode.` }) 
    };
  }

  // Initialize Stripe with the selected key
  const stripe = require('stripe')(secretKey);
  
  // Select the correct Price Map
  const selectedPrices = PRICE_MAP[stripeMode === 'live' ? 'live' : 'test'];

  try {
    let stripeAction;
    let isOneTime = false;

    // --- Create the Stripe Customer ---
    const stripeCustomer = await stripe.customers.create({
      payment_method: paymentMethodId,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      address: {
        line1: customer.address,
        postal_code: quote.zipCode,
      },
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    // --- Determine: Subscription or One-Time? ---
    if (quote.paymentTerm === 'One-Time Deposit') {
      // --- IT'S A ONE-TIME CHARGE ---
      isOneTime = true;
      
      // Validate Price ID
      if (!selectedPrices.oneTime || selectedPrices.oneTime.includes('REPLACE')) {
         throw new Error(`One-Time Price ID is not configured for ${stripeMode} mode.`);
      }
      
      // Create PaymentIntent
      stripeAction = await stripe.paymentIntents.create({
        amount: 9999, // $99.99 in cents
        currency: 'usd',
        customer: stripeCustomer.id,
        payment_method: paymentMethodId,
        off_session: true,
        confirm: true,
        description: 'One-Time Yard Reset (Deposit)',
      });
      
    } else {
      // --- IT'S A SUBSCRIPTION ---
      
      // Find Price ID
      const priceId = selectedPrices.subs[quote.planName]?.[quote.dogCount]?.[quote.paymentTerm];
      
      if (!priceId || priceId.includes('REPLACE')) {
        throw new Error(`Price ID not found or not configured for: ${quote.planName}, ${quote.dogCount}, ${quote.paymentTerm} in ${stripeMode} mode.`);
      }
      
      // Create Subscription
      stripeAction = await stripe.subscriptions.create({
        customer: stripeCustomer.id,
        items: [{ price: priceId }],
      });
    }

    // --- 3. POST-PAYMENT ACTIONS (Webhooks) ---

    // A. Fire GHL Webhook
    try {
      await fetch(process.env.GOHIGHLEVEL_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(leadData),
      });
    } catch (e) {
      console.error('GHL Webhook failed:', e);
    }
    
    // B. Send EmailJS Confirmation
    try {
      const template = isOneTime
        ? process.env.EMAILJS_TEMPLATE_ID_ONETIME
        : process.env.EMAILJS_TEMPLATE_ID_SUBSCRIPTION;
        
      await emailjs.send(
        process.env.EMAILJS_SERVICE_ID,
        template,
        emailParams,
        {
          publicKey: process.env.EMAILJS_PUBLIC_KEY,
          privateKey: process.env.EMAILJS_PRIVATE_KEY,
        }
      );
    } catch (e) {
      console.error('EmailJS send failed:', e);
    }

    // --- 4. SUCCESS RESPONSE ---
    return {
      statusCode: 200,
      body: JSON.stringify({ status: 'success', data: stripeAction }),
    };

  } catch (error) {
    console.error('Stripe or Server Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ status: 'error', message: error.message }),
    };
  }
};