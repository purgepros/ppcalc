/*
 * --- NETLIFY FUNCTION FOR NON-PAYMENT LEADS ---
 *
 * This backend function securely handles:
 * 1. "Custom Quote" / "Bailout" leads
 * 2. "Exit Intent" leads
 *
 * It uses the Environment Variables you've already set in Netlify.
 */

// We use `require` syntax in Netlify functions
const emailjs = require('emailjs-com');
const fetch = require('node-fetch');

exports.handler = async (event) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { leadData, emailParams, leadType } = JSON.parse(event.body);

    // --- 1. Fire GHL Webhook ---
    // We use the *main* GHL webhook for all leads.
    try {
      await fetch(process.env.GOHIGHLEVEL_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(leadData),
      });
    } catch (e) {
      console.error('GHL Webhook failed:', e.g);
      // We don't stop the process
    }

    // --- 2. Send EmailJS Confirmation ---
    try {
      // Determine which email template to use based on the 'leadType'
      // sent from the frontend.
      const templateIdToSend = leadType === 'exitIntent'
        ? process.env.EMAILJS_TEMPLATE_ID_EXIT_INTENT // 'template_ie5fsgp'
        : process.env.EMAILJS_TEMPLATE_ID_LEAD;      // 'template_wc2n8oc'
        
      if (!templateIdToSend) {
          console.error('EmailJS template ID not found for leadType:', leadType);
          throw new Error('Email template configuration error.');
      }

      await emailjs.send(
        process.env.EMAILJS_SERVICE_ID,
        templateIdToSend, // Use the specific template
        emailParams,
        process.env.EMAILJS_PUBLIC_KEY
      );
    } catch (e) {
      console.error('EmailJS send failed:', e);
      // We don't stop the process
    }

    // --- 3. SUCCESS RESPONSE ---
    return {
      statusCode: 200,
      body: JSON.stringify({ status: 'success' }),
    };

  } catch (error) {
    console.error('Server Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ status: 'error', message: error.message }),
    };
  }
};