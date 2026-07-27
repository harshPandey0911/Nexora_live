const Razorpay = require('razorpay');
const Settings = require('../models/Settings');

/**
 * Get dynamic Razorpay instance using keys from Admin Settings (DB) or .env
 */
const getRazorpayInstance = async () => {
  let key_id = process.env.RAZORPAY_KEY_ID;
  let key_secret = process.env.RAZORPAY_KEY_SECRET;

  try {
    const settings = await Settings.findOne({ type: 'global' }).select('razorpayKeyId razorpayKeySecret');
    if (settings?.razorpayKeyId) key_id = settings.razorpayKeyId;
    if (settings?.razorpayKeySecret) key_secret = settings.razorpayKeySecret;
  } catch (err) {
    console.error('[RazorpayService] Settings fetch error:', err.message);
  }

  if (!key_id || !key_secret) {
    console.error('⚠️  Razorpay credentials missing in Admin Settings and .env file');
    return { razorpay: null, key_id: null, key_secret: null, error: 'Razorpay keys missing in configuration' };
  }

  try {
    const razorpay = new Razorpay({ key_id, key_secret });
    const isTestMode = key_id.startsWith('rzp_test');
    return { razorpay, key_id, key_secret, isTestMode };
  } catch (err) {
    console.error('❌ Failed to instantiate Razorpay:', err.message);
    return { razorpay: null, key_id: null, key_secret: null, error: err.message };
  }
};

/**
 * Create Razorpay order
 */
const createOrder = async (amount, currency = 'INR', receipt = null, notes = {}) => {
  try {
    const { razorpay, key_id, error } = await getRazorpayInstance();
    if (!razorpay) {
      return {
        success: false,
        error: error || 'Razorpay not initialized. Please check credentials in Admin Settings or .env file.'
      };
    }

    const options = {
      amount: Math.round(amount * 100), // Convert to paise
      currency,
      receipt: receipt || `receipt_${Date.now()}`,
      notes
    };

    console.log('Creating Razorpay order with options:', {
      amount: options.amount,
      currency: options.currency,
      receipt: options.receipt
    });

    const order = await razorpay.orders.create(options);

    console.log('✅ Razorpay order created successfully:', order.id);

    return {
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      receipt: order.receipt,
      keyId: key_id
    };
  } catch (error) {
    console.error('❌ Razorpay create order error:', {
      message: error.message,
      description: error.description,
      code: error.code,
      statusCode: error.statusCode,
      error: error.error
    });

    return {
      success: false,
      error: error.description || error.message || 'Failed to create Razorpay order'
    };
  }
};

/**
 * Verify payment signature
 */
const verifyPayment = async (razorpay_order_id, razorpay_payment_id, razorpay_signature) => {
  const crypto = require('crypto');
  const { key_secret } = await getRazorpayInstance();
  const secret = key_secret || process.env.RAZORPAY_KEY_SECRET;

  if (!secret) return false;

  const generated_signature = crypto
    .createHmac('sha256', secret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  return generated_signature === razorpay_signature;
};

/**
 * Get payment details
 */
const getPaymentDetails = async (paymentId) => {
  try {
    const { razorpay, error } = await getRazorpayInstance();
    if (!razorpay) return { success: false, error: error || 'Razorpay not initialized' };
    const payment = await razorpay.payments.fetch(paymentId);
    return {
      success: true,
      payment
    };
  } catch (error) {
    console.error('Razorpay get payment error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Refund payment
 */
const refundPayment = async (paymentId, amount = null, notes = {}) => {
  try {
    const { razorpay, error } = await getRazorpayInstance();
    if (!razorpay) return { success: false, error: error || 'Razorpay not initialized' };
    const refundOptions = {
      payment_id: paymentId,
      notes
    };

    if (amount) {
      refundOptions.amount = Math.round(amount * 100); // Convert to paise
    }

    const refund = await razorpay.payments.refund(paymentId, refundOptions);
    return {
      success: true,
      refund
    };
  } catch (error) {
    console.error('Razorpay refund error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Create Razorpay QR Code
 * Tries the modern standalone QR API first, then falls back to Payment Link if needed.
 */
const createQRCode = async (amount, bookingNumber, notes = {}) => {
  try {
    const { razorpay, key_id, key_secret, error } = await getRazorpayInstance();
    
    if (razorpay) {
      const axios = require('axios');
      const auth = Buffer.from(`${key_id}:${key_secret}`).toString('base64');

      const payload = {
        type: 'upi_qr',
        name: 'Service Payment',
        usage: 'single_use',
        fixed_amount: true,
        payment_amount: Math.round(amount * 100), // Convert to paise
        description: `Order Payment for ${bookingNumber}`,
        notes
      };

      console.log('[QR Service] Attempting Razorpay QR creation for Booking:', bookingNumber);

      // Razorpay SDK QR API
      try {
        const qrCode = await razorpay.qrCode.create(payload);
        console.log('✅ QR Code created via Razorpay SDK API');
        return {
          success: true,
          qrCodeId: qrCode.id,
          imageUrl: qrCode.image_url,
          qrStatus: qrCode.status
        };
      } catch (e1) {
        console.warn('⚠️ SDK QR API failed, trying REST fallbacks...', e1.description || e1.message);

        // Fallback 1: Manual API call to /v1/payments/qr_codes
        try {
          const response = await axios.post('https://api.razorpay.com/v1/payments/qr_codes', payload, {
            headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' }
          });
          const qrCode = response.data;
          return {
            success: true,
            qrCodeId: qrCode.id,
            imageUrl: qrCode.image_url,
            qrStatus: qrCode.status
          };
        } catch (e2) {
          // Fallback 2: /v1/qr_codes
          try {
            const response = await axios.post('https://api.razorpay.com/v1/qr_codes', payload, {
              headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' }
            });
            const qrCode = response.data;
            return {
              success: true,
              qrCodeId: qrCode.id,
              imageUrl: qrCode.image_url,
              qrStatus: qrCode.status
            };
          } catch (e3) {
            // Fallback 3: Payment Link
            try {
              const linkPayload = {
                amount: Math.round(amount * 100),
                currency: 'INR',
                description: `Payment for Booking #${bookingNumber}`,
                notes,
                notify: { sms: false, email: false }
              };

              const linkResponse = await axios.post('https://api.razorpay.com/v1/payment_links', linkPayload, {
                headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' }
              });

              const link = linkResponse.data;
              return {
                success: true,
                qrCodeId: link.id,
                imageUrl: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(link.short_url)}`,
                paymentUrl: link.short_url,
              };
            } catch (e4) {
              console.warn('⚠️ All Razorpay API endpoints failed, generating Smart UPI Fallback QR');
            }
          }
        }
      }
    }
  } catch (error) {
    console.warn('Razorpay QR exception, using Smart UPI Fallback:', error.message);
  }

  // Dynamic UPI QR Generation using Admin UPI VPA from Settings DB
  let adminUpiId = 'nexora.settle@okicici';
  let companyName = 'Nexora';

  try {
    const settingsDoc = await Settings.findOne({ type: 'global' }).select('adminUpiId companyName adminAccountName').lean();
    if (settingsDoc?.adminUpiId) adminUpiId = settingsDoc.adminUpiId.trim();
    if (settingsDoc?.companyName || settingsDoc?.adminAccountName) {
      companyName = settingsDoc.companyName || settingsDoc.adminAccountName;
    }
  } catch (sErr) {
    console.error('[RazorpayService] Settings fetch error for Admin UPI QR:', sErr.message);
  }

  const encodedUpiId = adminUpiId;
  const encodedName = encodeURIComponent(companyName);
  const upiUri = `upi://pay?pa=${encodedUpiId}&pn=${encodedName}&am=${amount.toFixed(2)}&cu=INR&tn=Booking+${bookingNumber}`;
  const fallbackQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(upiUri)}`;

  console.log(`[RazorpayService] Generated Digital Pay QR for Admin UPI: ${adminUpiId} (Amount: ₹${amount})`);

  return {
    success: true,
    qrCodeId: `qr_dev_${Date.now()}`,
    imageUrl: fallbackQrUrl,
    paymentUrl: upiUri,
    isManualUpi: true
  };
};

/**
 * Get payments for a QR Code or Payment Link
 */
const getQRCodePayments = async (id) => {
  try {
    const { razorpay, key_id, key_secret, error } = await getRazorpayInstance();
    if (!razorpay) {
      return { success: false, error: error || 'Razorpay not initialized' };
    }

    if (id && (id.startsWith('plink_'))) {
      const axios = require('axios');
      const auth = Buffer.from(`${key_id}:${key_secret}`).toString('base64');

      try {
        const response = await axios.get(`https://api.razorpay.com/v1/payment_links/${id}`, {
          headers: { 'Authorization': `Basic ${auth}` }
        });

        const link = response.data;
        console.log(`[QR Service] Checking Payment Link ${id} status: ${link.status}`);

        // If link is paid, we returned a captured payment object
        if (link.status === 'paid' || link.status === 'partially_paid') {
          return {
            success: true,
            payments: [{
              id: link.razorpay_payment_id || `pay_${Date.now()}`,
              status: 'captured',
              amount: link.amount_paid
            }]
          };
        }
        return { success: true, payments: [] };
      } catch (linkError) {
        console.error('Payment link fetch error:', linkError.response?.data || linkError.message);
        throw linkError;
      }
    }

    // Otherwise, standard QR Code check
    const payments = await razorpay.qrCode.fetchAllPayments(id);
    return {
      success: true,
      payments: payments.items || []
    };
  } catch (error) {
    console.error('Razorpay fetch payments error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
};

module.exports = {
  createOrder,
  verifyPayment,
  getPaymentDetails,
  refundPayment,
  createQRCode,
  getQRCodePayments,
  isTestMode: () => isTestMode
};

