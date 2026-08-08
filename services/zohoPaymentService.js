const crypto = require('crypto');

// In-memory token cache
let cachedAccessToken = process.env.ZOHO_ACCESS_TOKEN || '';
let tokenExpiryTimestamp = 0;

/**
 * Exchange Authorization Code for Access & Refresh Tokens
 * GET /auth/zoho/callback handler helper
 */
async function exchangeAuthCode(code) {
  try {
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: process.env.ZOHO_CLIENT_ID,
      client_secret: process.env.ZOHO_CLIENT_SECRET,
      redirect_uri: process.env.ZOHO_REDIRECT_URI || 'https://jewelskart-backend-gt7z.onrender.com/auth/zoho/callback',
      code: code
    });

    const response = await fetch('https://accounts.zoho.in/oauth/v2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    const data = await response.json();

    if (data.access_token) {
      cachedAccessToken = data.access_token;
      tokenExpiryTimestamp = Date.now() + ((data.expires_in || 3600) - 60) * 1000;
      process.env.ZOHO_ACCESS_TOKEN = data.access_token;
      if (data.refresh_token) {
        process.env.ZOHO_REFRESH_TOKEN = data.refresh_token;
      }
    }

    return data;
  } catch (error) {
    console.error('Error exchanging Zoho authorization code:', error);
    throw error;
  }
}

/**
 * STEP 4 - Auto Refresh Access Token (UPDATED)
 */
async function getZohoAccessToken() {
  try {
    // 1. If cached token is valid and not expired, use it
    if (cachedAccessToken && tokenExpiryTimestamp > 0 && Date.now() < tokenExpiryTimestamp) {
      console.log('✅ Using cached Zoho access token');
      return cachedAccessToken;
    }

    // 2. Read refresh token from env
    const refreshToken = (process.env.ZOHO_REFRESH_TOKEN || '').trim();
    const clientId = (process.env.ZOHO_CLIENT_ID || '').trim();
    const clientSecret = (process.env.ZOHO_CLIENT_SECRET || '').trim();

    if (!refreshToken) {
      // If access token exists in env and we haven't tried refreshing yet, use env token
      if (process.env.ZOHO_ACCESS_TOKEN && process.env.ZOHO_ACCESS_TOKEN.trim() !== '') {
        cachedAccessToken = process.env.ZOHO_ACCESS_TOKEN.trim();
        return cachedAccessToken;
      }
      throw new Error('ZOHO_REFRESH_TOKEN is missing in environment variables');
    }

    // 3. Request fresh access token from Zoho OAuth server using Refresh Token
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret
    });

    // ✅ Using correct domain
    const tokenUrl = 'https://accounts.zoho.in/oauth/v2/token';
    console.log('🔄 Refreshing Zoho access token...');

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      console.error('❌ Zoho token refresh error:', data.error || data.message);
      // If refresh API call fails, fallback to env access token if present
      if (process.env.ZOHO_ACCESS_TOKEN && process.env.ZOHO_ACCESS_TOKEN.trim() !== '') {
        console.warn('⚠️ Using fallback ZOHO_ACCESS_TOKEN from env');
        return process.env.ZOHO_ACCESS_TOKEN.trim();
      }
      throw new Error(data.error || data.message || 'Failed to refresh Zoho access token');
    }

    cachedAccessToken = data.access_token;
    tokenExpiryTimestamp = Date.now() + ((data.expires_in || 3600) - 60) * 1000;
    process.env.ZOHO_ACCESS_TOKEN = data.access_token;

    console.log('✅ Zoho access token refreshed successfully');
    return cachedAccessToken;
  } catch (error) {
    console.error('Error in getZohoAccessToken:', error.message);
    if (process.env.ZOHO_ACCESS_TOKEN && process.env.ZOHO_ACCESS_TOKEN.trim() !== '') {
      return process.env.ZOHO_ACCESS_TOKEN.trim();
    }
    throw error;
  }
}

/**
 * STEP 5 - Create Payment Session (COMPLETELY UPDATED)
 */
async function createPaymentSession({
  amount,
  currency = 'INR',
  description = 'JewelsKart Order Payment',
  invoice_number,
  reference_number
}) {
  console.log('\n' + '='.repeat(60));
  console.log('💳 [createPaymentSession] START');
  console.log('='.repeat(60));

  // 1. Get access token
  const accessToken = await getZohoAccessToken();
  console.log('✅ Access token obtained');

  // 2. Get organization ID (CRITICAL - this was missing!)
  const organizationId = (process.env.ZOHO_ORGANIZATION_ID || '').trim();
  const accountId = (process.env.ZOHO_ACCOUNT_ID || '').trim();

  if (!organizationId) {
    console.error('❌ ZOHO_ORGANIZATION_ID is missing!');
    throw new Error('ZOHO_ORGANIZATION_ID is not set in environment variables');
  }

  console.log(`📌 Organization ID: ${organizationId}`);
  console.log(`📌 Account ID: ${accountId}`);

  // 3. ✅ CORRECT API ENDPOINT — Zoho Payments India
  // NOTE: zohoapis.in is for Zoho Books/CRM. Zoho Payments uses payments.zoho.in
  const apiDomain = 'https://payments.zoho.in';
  const requestUrl = `${apiDomain}/api/v1/paymentsessions`;
  console.log(`🌐 API URL: ${requestUrl}`);

  // 4. Payload as per Zoho Payments API spec
  const payload = {
    account_id: accountId,                                    // ✅ REQUIRED by Zoho Payments
    amount: Number(amount).toFixed(2),
    currency_code: 'INR',
    description: description || 'JewelsKart Order Payment',
    invoice_number: invoice_number || `INV-${Date.now()}`,
    reference_number: reference_number || `REF-${Date.now()}`
  };

  const requestBody = JSON.stringify(payload);

  console.log('📤 Request Details:');
  console.log(`  URL: ${requestUrl}`);
  console.log(`  Body: ${requestBody}`);
  console.log(`  Account ID: ${accountId}`);
  console.log(`  Token (first 20): ${accessToken.substring(0, 20)}...`);

  // 5. ✅ CORRECT HEADERS for Zoho Payments API
  // - Authorization must use 'Zoho-oauthtoken' (NOT 'Bearer') for Zoho Payments
  // - Header is X-com-zoho-payments-accountid (NOT organizationid)
  const response = await fetch(requestUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Zoho-oauthtoken ${accessToken}`,     // ✅ Zoho Payments auth format
      'Content-Type': 'application/json',
      'X-com-zoho-payments-accountid': accountId             // ✅ Use accountId, not organizationId
    },
    body: requestBody
  });

  // 6. Log raw response
  const rawResponseText = await response.text();
  console.log('📥 Response Details:');
  console.log(`  HTTP Status: ${response.status}`);
  console.log(`  Raw Body: ${rawResponseText}`);
  console.log('='.repeat(60) + '\n');

  let data;
  try {
    data = JSON.parse(rawResponseText);
  } catch {
    throw new Error(`Zoho returned non-JSON response (HTTP ${response.status}): ${rawResponseText}`);
  }

  // 7. Check for errors
  if (!response.ok || data.error || data.code === 'ERROR') {
    const errMsg = data.message || data.error || `Zoho API returned HTTP ${response.status}`;
    console.error(`❌ Zoho API error: ${errMsg}`);
    throw new Error(`Zoho payment session creation failed: ${errMsg}`);
  }

  // 8. Extract payment session
  const paymentSession = data.payments_session || data.data;

  if (!paymentSession) {
    throw new Error(`Zoho response is missing payments_session. Full response: ${rawResponseText}`);
  }

  const sessionId = paymentSession.payments_session_id || paymentSession.id;

  if (!sessionId) {
    throw new Error(`Zoho response is missing payments_session_id. Full response: ${rawResponseText}`);
  }

  console.log('✅ Payment session created successfully!');
  console.log(`📌 Session ID: ${sessionId}`);

  return {
    payments_session_id: sessionId,
    amount: paymentSession.amount || amount,
    currency: paymentSession.currency_code || paymentSession.currency || 'INR',
    account_id: accountId,
    invoice_number: paymentSession.invoice_number,
    reference_number: paymentSession.reference_number
  };
}

/**
 * Verify Signature Helper
 */
function verifyZohoSignature(payloadData, signature) {
  try {
    const signingKey = process.env.ZOHO_SIGNING_KEY;
    if (!signingKey) {
      console.warn('⚠️ ZOHO_SIGNING_KEY is missing in environment variables');
      return false;
    }

    const payloadString = typeof payloadData === 'string' ? payloadData : JSON.stringify(payloadData);
    const expectedSignature = crypto
      .createHmac('sha256', signingKey)
      .update(payloadString)
      .digest('hex');

    return crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(signature));
  } catch (error) {
    console.error('Error verifying Zoho signature:', error.message);
    return false;
  }
}

module.exports = {
  exchangeAuthCode,
  getZohoAccessToken,
  createPaymentSession,
  verifyZohoSignature
};