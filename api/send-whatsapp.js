import dotenv from 'dotenv';
dotenv.config();

/**
 * Converts any Indian or international phone number to strict E.164 format.
 * Example: '9677417185' -> '+919677417185'
 * Example: '09677417185' -> '+919677417185'
 * Example: '919677417185' -> '+919677417185'
 */
export const formatE164Phone = (phone) => {
  if (!phone) return '';
  let str = String(phone).trim();
  if (str.startsWith('+')) {
    return str;
  }
  const digits = str.replace(/\D/g, '');
  if (digits.length === 10) {
    return `+91${digits}`;
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+${digits}`;
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return `+91${digits.slice(1)}`;
  }
  return `+${digits}`;
};

/**
 * Sends a single WhatsApp Meta Cloud API message with 1 automatic retry
 */
async function sendMetaWhatsAppMessage({ toPhone, messageText, recipientType = 'customer' }) {
  const formattedPhone = formatE164Phone(toPhone);
  const phoneNumberId  = process.env.WHATSAPP_PHONE_NUMBER_ID || process.env.PHONE_NUMBER_ID || '';
  const accessToken    = process.env.WHATSAPP_ACCESS_TOKEN || process.env.WHATSAPP_API_TOKEN || '';

  const url = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;

  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: formattedPhone,
    type: "text",
    text: {
      preview_url: false,
      body: messageText
    }
  };

  console.log(`\n================== [WHATSAPP API AUDIT LOG] ==================`);
  console.log(`[WhatsApp API] Recipient Type : ${recipientType.toUpperCase()}`);
  console.log(`[WhatsApp API] Target Phone   : ${formattedPhone}`);
  console.log(`[WhatsApp API] Phone Number ID: ${phoneNumberId ? 'PRESENT (' + phoneNumberId + ')' : 'MISSING'}`);
  console.log(`[WhatsApp API] Access Token   : ${accessToken ? 'PRESENT (len: ' + accessToken.length + ')' : 'MISSING'}`);
  console.log(`[WhatsApp API] Payload        :`, JSON.stringify(payload, null, 2));

  if (!phoneNumberId || !accessToken) {
    const errorMsg = `[WhatsApp API] Missing Credentials: WHATSAPP_PHONE_NUMBER_ID (${phoneNumberId ? 'OK' : 'MISSING'}), WHATSAPP_ACCESS_TOKEN (${accessToken ? 'OK' : 'MISSING'})`;
    console.error(`[WhatsApp API ERROR] ${errorMsg}`);
    console.log(`===============================================================\n`);
    return {
      success: false,
      statusCode: 400,
      error: errorMsg,
      formattedPhone,
      payload
    };
  }

  let attempt = 1;
  const maxAttempts = 2; // Initial request + 1 Retry

  while (attempt <= maxAttempts) {
    try {
      console.log(`[WhatsApp API] Attempt ${attempt}/${maxAttempts} sending message to ${formattedPhone}...`);
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const statusCode = response.status;
      const responseText = await response.text();
      let responseData;
      try { responseData = JSON.parse(responseText); } catch (e) { responseData = responseText; }

      console.log(`[WhatsApp API] HTTP Status Code: ${statusCode}`);
      console.log(`[WhatsApp API] API Response   :`, JSON.stringify(responseData, null, 2));

      if (response.ok) {
        console.log(`WhatsApp notification sent successfully.`);
        console.log(`===============================================================\n`);
        return {
          success: true,
          statusCode,
          responseData,
          formattedPhone,
          payload
        };
      } else {
        const errorDetail = responseData?.error?.message || responseText || 'Meta Cloud API error';
        console.error(`[WhatsApp API ERROR] Attempt ${attempt} failed with HTTP ${statusCode}: ${errorDetail}`);

        if (attempt < maxAttempts) {
          console.log(`[WhatsApp API] Retrying failed request to ${formattedPhone} in 1000ms...`);
          await new Promise(r => setTimeout(r, 1000));
        } else {
          console.log(`===============================================================\n`);
          return {
            success: false,
            statusCode,
            error: errorDetail,
            responseData,
            formattedPhone,
            payload
          };
        }
      }
    } catch (err) {
      console.error(`[WhatsApp API ERROR] Attempt ${attempt} Network/Fetch Exception:`, err.message);
      if (attempt < maxAttempts) {
        console.log(`[WhatsApp API] Retrying failed request to ${formattedPhone} in 1000ms...`);
        await new Promise(r => setTimeout(r, 1000));
      } else {
        console.log(`===============================================================\n`);
        return {
          success: false,
          statusCode: 500,
          error: err.message,
          formattedPhone,
          payload
        };
      }
    }
    attempt++;
  }
}

/**
 * Express Request Handler for /api/send-whatsapp
 */
export default async function sendWhatsAppNotificationHandler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
  }

  try {
    const orderData = req.body || {};
    const {
      orderId = 'N/A',
      customerName = 'Valued Customer',
      phone = '',
      items = [],
      totalPrice = 0,
      address = '',
      city = '',
      pincode = '',
      paymentMethod = 'COD',
      paymentStatus = 'Pending'
    } = orderData;

    console.log(`\n------------------ [INCOMING ORDER WHATSAPP REQUEST] ------------------`);
    console.log(`Order ID     : #${orderId}`);
    console.log(`Customer Name: ${customerName}`);
    console.log(`Raw Phone    : ${phone}`);
    console.log(`Total Amount : ₹${totalPrice}`);
    console.log(`Payment Mode : ${paymentMethod} (${paymentStatus})`);

    // Environment Variables Audit
    const envAudit = {
      WHATSAPP_PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID || process.env.PHONE_NUMBER_ID || 'NOT SET',
      WHATSAPP_ACCESS_TOKEN: process.env.WHATSAPP_ACCESS_TOKEN ? 'SET (Hidden)' : (process.env.WHATSAPP_API_TOKEN ? 'SET via WHATSAPP_API_TOKEN (Hidden)' : 'NOT SET'),
      WHATSAPP_WEBHOOK_SECRET: process.env.WHATSAPP_WEBHOOK_SECRET || process.env.WEBHOOK_SECRET || 'NOT SET',
      WHATSAPP_ADMIN_NUMBER: process.env.WHATSAPP_ADMIN_NUMBER || '+919677417185'
    };

    console.log(`[Env Check] Credentials Audit:`, envAudit);

    const formattedCustomerPhone = formatE164Phone(phone);
    const formattedAdminPhone = formatE164Phone(envAudit.WHATSAPP_ADMIN_NUMBER);

    const formattedItems = (items || []).map((it, i) => `  ${i + 1}. *${it.name || it.productName || 'Item'}* (x${it.quantity || 1}) - ₹${(Number(it.effectivePrice || it.price || 0) * Number(it.quantity || 1)).toFixed(2)}`).join('\n');

    // 1. Customer WhatsApp Message
    const customerMsgText = 
`🛒 *ORDER CONFIRMATION - SMKP TRADERS*

Dear *${customerName}*,

Thank you for shopping with *SMKP TRADERS*! Your order has been placed successfully.

📋 *Order Details:*
• *Order ID:* #${String(orderId).toUpperCase()}
• *Date:* ${new Date().toLocaleDateString('en-IN')}
• *Payment Mode:* ${String(paymentMethod).toUpperCase()} (${String(paymentStatus).toUpperCase()})
• *Total Amount:* ₹${Number(totalPrice).toFixed(2)}

📦 *Items Ordered:*
${formattedItems || '  1. Product Items'}

📍 *Shipping Address:*
${address}, ${city} - ${pincode}

We are processing your order for dispatch. You will receive tracking updates shortly.

Thank you for choosing SMKP TRADERS!
https://smkptraders.in`;

    // 2. Admin WhatsApp Message
    const adminMsgText = 
`🚨 *NEW ORDER NOTIFICATION - SMKP TRADERS*

• *Order ID:* #${String(orderId).toUpperCase()}
• *Customer:* ${customerName}
• *Phone:* ${formattedCustomerPhone}
• *Payment:* ${String(paymentMethod).toUpperCase()} (${String(paymentStatus).toUpperCase()})
• *Total Amount:* ₹${Number(totalPrice).toFixed(2)}

📦 *Items:*
${formattedItems || '  1. Product Items'}

📍 *Delivery Address:*
${address}, ${city} - ${pincode}

Please process this order for dispatch.`;

    // Execute sending to Customer
    const customerResult = await sendMetaWhatsAppMessage({
      toPhone: formattedCustomerPhone,
      messageText: customerMsgText,
      recipientType: 'customer'
    });

    // Execute sending to Admin
    const adminResult = await sendMetaWhatsAppMessage({
      toPhone: formattedAdminPhone,
      messageText: adminMsgText,
      recipientType: 'admin'
    });

    const overallSuccess = customerResult.success || adminResult.success;

    return res.status(overallSuccess ? 200 : (customerResult.statusCode || 500)).json({
      success: overallSuccess,
      message: overallSuccess ? "WhatsApp notification sent successfully." : "Failed to send WhatsApp notifications.",
      audit: {
        orderId,
        customerName,
        rawPhone: phone,
        formattedCustomerPhone,
        formattedAdminPhone,
        customerNotification: customerResult,
        adminNotification: adminResult,
        envAudit
      }
    });

  } catch (err) {
    console.error("[WhatsApp API Handler Error]:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Internal server error during WhatsApp notification"
    });
  }
}
