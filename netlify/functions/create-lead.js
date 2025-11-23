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
const emailjs = require('@emailjs/nodejs');
const fetch = require('node-fetch');

exports.handler = async (event) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { leadData, emailParams, leadType } = JSON.parse(event.body);

    // --- 1. Fire GHL Webhook ---
    try {
      if (process.env.GOHIGHLEVEL_WEBHOOK_URL) {
        await fetch(process.env.GOHIGHLEVEL_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(leadData),
        });
      }
    } catch (e) {
      console.error('GHL Webhook failed:', e);
      // Don't stop the process, just log the error
    }
    
    // --- 2. Send EmailJS Confirmation ---
    try {
      let templateIdToSend;
      if (leadType === 'exitIntent') {
         templateIdToSend = process.env.EMAILJS_TEMPLATE_ID_EXIT_INTENT;
      } else {
         // Use the LEAD template for custom quotes (Check your Env Vars!)
         templateIdToSend = process.env.EMAILJS_TEMPLATE_ID_LEAD;
      }
      
      if (!templateIdToSend) {
          console.error('EmailJS Error: Template ID is missing for leadType:', leadType);
          throw new Error('Email template configuration error: Missing Template ID.');
      }

      // SANITIZATION: Strict check to prevent "corrupted variable" errors
      // Ensure 'notes' is never undefined, even if empty
      const safeParams = {
        ...emailParams,
        name: emailParams.name || 'Customer',
        email: emailParams.email || '',
        phone: emailParams.phone || '',
        address: emailParams.address || '',
        plan: emailParams.plan || 'Custom Quote',
        description: emailParams.description || 'Quote Request',
        // CRITICAL FIX: Fallback for zip and dog_count if they come in empty
        zip: emailParams.zip && emailParams.zip !== '' ? emailParams.zip : 'Not Provided', 
        dog_count: emailParams.dog_count && emailParams.dog_count !== '' ? emailParams.dog_count : 'Not Provided',
        // If notes is missing/null, set to "None" so {{#if}} blocks or variables don't crash
        notes: emailParams.notes ? emailParams.notes : "None" 
      };

      await emailjs.send(
        process.env.EMAILJS_SERVICE_ID,
        templateIdToSend, // Use the specific template
        safeParams,
        {
          publicKey: process.env.EMAILJS_PUBLIC_KEY,
          privateKey: process.env.EMAILJS_PRIVATE_KEY,
        }
      );
    } catch (e) {
      console.error('EmailJS send failed:', e);
      // Don't stop the process
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