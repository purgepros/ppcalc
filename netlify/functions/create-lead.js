/*
 * --- NETLIFY FUNCTION FOR NON-PAYMENT LEADS ---
 *
 * This backend function securely handles:
 * 1. "Custom Quote" / "Bailout" leads
 * 2. "Exit Intent" leads
 * 3. "Incomplete" leads (Step 1 -> Step 2 transition)
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
    
    // --- 2. Send EmailJS Confirmation (SKIP for 'incomplete' lead type) ---
    // We don't want to email YOU every time someone clicks "See Price", only GHL needs that.
    if (leadType !== 'incomplete') {
        try {
          let templateIdToSend;
          if (leadType === 'exitIntent') {
             templateIdToSend = process.env.EMAILJS_TEMPLATE_ID_EXIT_INTENT;
          } else {
             // Use the LEAD template for custom quotes
             templateIdToSend = process.env.EMAILJS_TEMPLATE_ID_LEAD;
          }
          
          if (!templateIdToSend) {
              console.error('EmailJS Error: Template ID is missing for leadType:', leadType);
              // Fallback or throw
          } else {
              // SANITIZATION: Strict check to prevent "corrupted variable" errors
              const safeParams = {
                ...emailParams,
                name: emailParams.name || 'Customer',
                email: emailParams.email || 'Not Provided',
                phone: emailParams.phone || 'Not Provided',
                address: emailParams.address || 'Not Provided',
                city: emailParams.city || '',
                state: emailParams.state || '',
                dog_name: emailParams.dog_name || '',
                source: emailParams.source || '',
                plan: emailParams.plan || 'Custom Quote',
                description: emailParams.description || 'Quote Request',
                zip: emailParams.zip && emailParams.zip !== '' ? emailParams.zip : 'Not Provided', 
                dog_count: emailParams.dog_count && emailParams.dog_count !== '' ? emailParams.dog_count : 'Not Provided',
                notes: emailParams.notes ? emailParams.notes : "None" 
              };

              await emailjs.send(
                process.env.EMAILJS_SERVICE_ID,
                templateIdToSend,
                safeParams,
                {
                  publicKey: process.env.EMAILJS_PUBLIC_KEY,
                  privateKey: process.env.EMAILJS_PRIVATE_KEY,
                }
              );
          }
        } catch (e) {
          console.error('EmailJS send failed:', e);
        }
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