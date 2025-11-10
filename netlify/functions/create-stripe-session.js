/*
 * --- NETLIFY FUNCTION FOR STRIPE CHECKOUT ---
 *
 * This is your new backend. It will:
 * 1. Be triggered when your React app's checkout form is submitted.
 * 2. Securely create Stripe customers, subscriptions, and one-time charges.
 * 3. Trigger your GHL webhook *after* payment success.
 * 4. Send your EmailJS confirmation *after* payment success.
 *
 * --- HOW TO DEPLOY ---
 * 1. Create this file in your project: `netlify/functions/create-stripe-session.js`
 * 2. Run: `npm install stripe emailjs-com node-fetch@2`
 * 3. Go to your Netlify site settings -> "Build & deploy" -> "Environment"
 * 4. Add your Environment Variables.
 *
 */

// We use `require` syntax in Netlify functions
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const emailjs = require('emailjs-com');
const fetch = require('node-fetch'); // Netlify functions don't have browser 'fetch'

// --- 1. THE PRICE MAP ---
// This maps your app's state directly to the Stripe Price IDs you provided.
// ========================================================================
// TODO: ACTION REQUIRED!
// Create a 37th product in Stripe for the "$99.99 One-Time Yard Reset"
// Get its Price ID (e.g., `price_...`) and paste it here.
const ONE_TIME_DEPOSIT_PRICE_ID = 'price_YOUR_ONETIME_DEPOSIT_ID_HERE';
// ========================================================================

const SUBSCRIPTION_PRICE_MAP = {
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
};

// --- 2. THE MAIN FUNCTION HANDLER ---
exports.handler = async (event) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { paymentMethodId, customer, quote, leadData, emailParams, emailTemplate } = JSON.parse(event.body);

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

    // --- Determine: Is this a Subscription or a One-Time Charge? ---
    if (quote.paymentTerm === 'One-Time Deposit') {
      // --- IT'S A ONE-TIME CHARGE ---
      isOneTime = true;
      if (ONE_TIME_DEPOSIT_PRICE_ID === 'price_YOUR_ONETIME_DEPOSIT_ID_HERE') {
         throw new Error('Server is not configured: One-Time Price ID is missing.');
      }
      
      // Create a PaymentIntent (a charge)
      stripeAction = await stripe.paymentIntents.create({
        amount: 9999, // $99.99 in cents
        currency: 'usd',
        customer: stripeCustomer.id,
        payment_method: paymentMethodId,
        off_session: true, // Charge immediately
        confirm: true, // Confirm the charge
        description: 'One-Time Yard Reset (Deposit)',
      });
      
    } else {
      // --- IT'S A SUBSCRIPTION ---
      
      // Find the Price ID from our map
      const priceId = SUBSCRIPTION_PRICE_MAP[quote.planName]?.[quote.dogCount]?.[quote.paymentTerm];
      
      if (!priceId) {
        throw new Error(`Could not find a valid Stripe Price ID for: ${quote.planName}, ${quote.dogCount}, ${quote.paymentTerm}`);
      }
      
      // Create the Subscription
      stripeAction = await stripe.subscriptions.create({
        customer: stripeCustomer.id,
        items: [{ price: priceId }],
        // Stripe automatically charges the default_payment_method
        // The "Free First Cleanup" is a manual business process,
        // so we don't need complex trial logic here. The sub just starts.
      });
    }

    // --- 3. POST-PAYMENT ACTIONS ---
    // If Stripe was successful, we now fire the webhooks.

    // A. Fire GHL Webhook
    // We send the `leadData` that the *frontend* prepared.
    try {
      await fetch(process.env.GOHIGHLEVEL_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(leadData),
      });
    } catch (e) {
      console.error('GHL Webhook failed:', e);
      // We don't stop the process, as payment was successful
    }
    
    // B. Send EmailJS Confirmation
    // We send the `emailParams` that the *frontend* prepared.
    try {
      const template = isOneTime
        ? process.env.EMAILJS_TEMPLATE_ID_ONETIME
        : process.env.EMAILJS_TEMPLATE_ID_SUBSCRIPTION;
        
      await emailjs.send(
        process.env.EMAILJS_SERVICE_ID,
        template,
        emailParams,
        process.env.EMAILJS_PUBLIC_KEY
      );
    } catch (e) {
      console.error('EmailJS send failed:', e);
      // We don't stop the process
    }

    // --- 4. SUCCESS RESPONSE ---
    // Send a 200 OK back to the React app
    return {
      statusCode: 200,
      body: JSON.stringify({ status: 'success', data: stripeAction }),
    };

  } catch (error) {
    // --- ERROR RESPONSE ---
    console.error('Stripe or Server Error:', error);
    // Send the error message back to the React app to display to the user
    return {
      statusCode: 500,
      body: JSON.stringify({ status: 'error', message: error.message }),
    };
  }
};