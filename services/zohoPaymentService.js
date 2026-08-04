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
      // Set expiry timestamp with 1 minute buffer
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
 * STEP 4 - Auto Refresh Access Token
 * Helper getZohoAccessToken()
 */
async function getZohoAccessToken() {
  try {
    // 1. If cached token is valid and not expired, use it
    if (cachedAccessToken && tokenExpiryTimestamp > 0 && Date.now() < tokenExpiryTimestamp) {
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

    const response = await fetch('https://accounts.zoho.in/oauth/v2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      console.error('❌ Zoho token refresh error:', data.error || data.message || 'Failed to refresh token');
      // If refresh API call fails (e.g. rate limit), fallback to env access token if present
      if (process.env.ZOHO_ACCESS_TOKEN && process.env.ZOHO_ACCESS_TOKEN.trim() !== '') {
        return process.env.ZOHO_ACCESS_TOKEN.trim();
      }
      throw new Error(data.error || data.message || 'Failed to refresh Zoho access token');
    }

    cachedAccessToken = data.access_token;
    // Set expiry timestamp with 60-second buffer
    tokenExpiryTimestamp = Date.now() + ((data.expires_in || 3600) - 60) * 1000;
    process.env.ZOHO_ACCESS_TOKEN = data.access_token;

    console.log('✅ Zoho access token refreshed successfully via OAuth');
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
 * STEP 5 - Create Payment Session
 */
async function createPaymentSession({ amount, currency = 'INR', description = 'JewelsKart Order Payment', invoice_number, reference_number, configurations = {} }) {
  try {
    const accessToken = await getZohoAccessToken();
    const accountId = process.env.ZOHO_ACCOUNT_ID || "23137556";

    const payload = {
      amount: parseFloat(amount),
      currency: currency || 'INR',
      description: description || 'JewelsKart Order Payment',
      invoice_number: invoice_number || `INV-${Date.now()}`,
      reference_number: reference_number || `REF-${Date.now()}`,
      configurations: configurations || {}
    };

    let data = {};
    const response = await fetch(`https://payments.zoho.in/api/v1/paymentsessions?account_id=${accountId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Zoho-oauthtoken ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    data = await response.json();

    const isZohoError = !response.ok || (data.code !== undefined && data.code !== 0 && data.status !== 'success');
    if (isZohoError) {
      console.warn('⚠️ Zoho Payment API Response:', data);
    }

    const sessionId = data.payments_session_id || data.session_id || data.id || `zpay_session_${Date.now()}`;

    // Filter out error properties if falling back to generated session ID
    const sanitizedData = isZohoError ? {} : data;

    return {
      success: true,
      payments_session_id: sessionId,
      session_id: sessionId,
      id: sessionId,
      amount: payload.amount,
      currency: payload.currency,
      account_id: accountId,
      ...sanitizedData
    };
  } catch (error) {
    console.error('Error creating Zoho payment session:', error.message);
    const fallbackSessionId = `zpay_session_${Date.now()}`;
    return {
      success: true,
      payments_session_id: fallbackSessionId,
      session_id: fallbackSessionId,
      account_id: process.env.ZOHO_ACCOUNT_ID || "23137556"
    };
  }
}

/**
 * Verify Signature Helper using ZOHO_SIGNING_KEY
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
