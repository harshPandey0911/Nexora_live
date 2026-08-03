const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');

const COLORS = {
  primary: '#00246b',       // Deep Nexora Royal Blue
  secondary: '#0055ff',     // Vivid Accent Blue
  yellow: '#D68F35',        // Golden Accent
  orange: '#BB5F36',        // Warm Orange Accent
  accent: '#D68F35',
  success: '#10b981',
  bg: '#f8fafc',
  white: '#ffffff',
  text: '#0f172a',
  lightText: '#64748b',
  border: '#e2e8f0'
};

const LOGO_PATH = path.resolve(__dirname, '../../Frontend/public/nexora-go-logo.png');

const getLogoAttachment = (existingAttachments = []) => {
  const logoAtt = fs.existsSync(LOGO_PATH) ? [
    {
      filename: 'nexora-go-logo.png',
      path: LOGO_PATH,
      cid: 'nexoragologo',
      contentType: 'image/png',
      contentDisposition: 'inline',
      headers: {
        'X-Attachment-Id': 'nexoragologo'
      }
    }
  ] : [];
  return [...logoAtt, ...existingAttachments];
};

const getPrimaryFrontendUrl = () => {
  const rawUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  return rawUrl.split(',')[0].trim();
};

const emailWrapper = (content, title, preheader = '', customOrigin = '') => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td, a { font-family: Arial, Helvetica, sans-serif !important; }
  </style>
  <![endif]-->
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap');
    
    body { font-family: 'Plus Jakarta Sans', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: ${COLORS.bg}; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
    .preheader { display: none; max-width: 0; max-height: 0; overflow: hidden; font-size: 1px; line-height: 1px; color: #fff; opacity: 0; }
    .wrapper { width: 100%; table-layout: fixed; background-color: ${COLORS.bg}; padding-bottom: 60px; }
    .main { max-width: 600px; margin: 0 auto; background-color: ${COLORS.white}; border-radius: 24px; overflow: hidden; margin-top: 40px; box-shadow: 0 20px 30px -5px rgba(0, 36, 107, 0.12), 0 10px 10px -5px rgba(0, 0, 0, 0.04); }
    
    .header { background: linear-gradient(135deg, #00246b 0%, #004499 50%, #0066cc 100%); padding: 44px 30px; text-align: center; position: relative; border-bottom: 4px solid #D68F35; }
    .header h1 { margin: 0; font-size: 24px; color: ${COLORS.white}; font-weight: 800; letter-spacing: -0.5px; }
    
    .content { padding: 48px 40px; color: ${COLORS.text}; }
    .badge { display: inline-block; padding: 8px 16px; border-radius: 12px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 24px; }
    .badge-primary { background-color: rgba(0, 36, 107, 0.1); color: ${COLORS.primary}; }
    .badge-success { background-color: ${COLORS.success}15; color: ${COLORS.success}; }
    
    h2 { font-size: 28px; font-weight: 800; line-height: 1.2; margin: 0 0 16px 0; color: ${COLORS.text}; letter-spacing: -0.5px; }
    p { font-size: 16px; line-height: 1.6; color: ${COLORS.lightText}; margin: 0 0 24px 0; }
    
    .card { background-color: #f8fafc; border: 1px solid ${COLORS.border}; border-radius: 20px; padding: 32px; margin: 32px 0; }
    .card-title { font-size: 14px; font-weight: 700; text-transform: uppercase; color: ${COLORS.lightText}; letter-spacing: 1px; margin-bottom: 20px; border-bottom: 1px solid ${COLORS.border}; padding-bottom: 12px; }
    
    .data-row { display: flex; justify-content: space-between; padding: 12px 0; }
    .data-label { font-size: 14px; font-weight: 600; color: ${COLORS.lightText}; }
    .data-value { font-size: 14px; font-weight: 700; color: ${COLORS.text}; text-align: right; }
    
    .total-row { display: flex; justify-content: space-between; margin-top: 20px; padding-top: 20px; border-top: 2px dashed ${COLORS.border}; }
    .total-label { font-size: 18px; font-weight: 800; color: ${COLORS.text}; }
    .total-value { font-size: 22px; font-weight: 900; color: ${COLORS.primary}; }
    
    .btn-container { text-align: center; margin-top: 40px; }
    .btn { display: inline-block; background: linear-gradient(135deg, #00246b 0%, #0055ff 100%); color: ${COLORS.white} !important; padding: 16px 36px; border-radius: 14px; font-weight: 700; font-size: 16px; text-decoration: none; box-shadow: 0 10px 20px -3px rgba(0, 36, 107, 0.35); transition: all 0.2s; }
    
    .footer { text-align: center; padding: 40px; }
    .footer p { font-size: 13px; color: ${COLORS.lightText}; margin-bottom: 8px; }
    .social-links { margin-top: 20px; }
    .social-links a { color: ${COLORS.primary}; text-decoration: none; font-weight: 600; font-size: 13px; margin: 0 10px; }
    
    @media only screen and (max-width: 600px) {
      .main { margin-top: 0; border-radius: 0; }
      .content { padding: 32px 24px; }
      .card { padding: 20px; }
    }
  </style>
</head>
<body>
  <div class="preheader">${preheader}</div>
  <!-- Nexora-Unique-Ref: ${Date.now()} -->
  <div class="wrapper">
    <div class="main">
      <div class="header">
        <table align="center" border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto 14px auto;">
          <tr>
            <td align="center" valign="middle" style="width: 58px; height: 58px; background-color: #ffffff; border-radius: 18px; text-align: center; box-shadow: 0 10px 20px rgba(0,0,0,0.2); padding: 5px;">
              <img src="cid:nexoragologo" alt="Nexora Go Logo" style="width: 48px; height: 48px; object-fit: contain; display: block; border: 0;" />
            </td>
          </tr>
        </table>
        <h1>Nexora Go</h1>
      </div>
      <div class="content">
        ${content}
      </div>
      <div class="footer">
        <p>On-Demand Services • Delivered with Care</p>
        <p>&copy; ${new Date().getFullYear()} Nexora Go. All rights reserved.</p>
        <div class="social-links">
          <a href="${customOrigin || getPrimaryFrontendUrl()}/user" target="_blank" style="color: #00246b; font-weight: 600; text-decoration: underline;">Help Center</a>
          <a href="${customOrigin || getPrimaryFrontendUrl()}/user/privacy" target="_blank" style="color: #00246b; font-weight: 600; text-decoration: underline;">Privacy Policy</a>
          <a href="${customOrigin || getPrimaryFrontendUrl()}/user/terms" target="_blank" style="color: #00246b; font-weight: 600; text-decoration: underline;">Terms of Service</a>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
`;
};

const createTransporter = () => {
  const isSecure = parseInt(process.env.EMAIL_PORT) === 465;
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: isSecure,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
};

/**
 * Send OTP Email - Professional Style
 */
const sendOTPEmail = async (email, otp, purpose = 'verification') => {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.log(`[EMAIL SERVICE] OTP for ${email}: ${otp}`);
      return { success: true };
    }

    const transporter = createTransporter();
    const subjectPrefix = purpose === 'password_reset' ? 'Reset Password' : 'Verify Email';

    const content = `
      <div style="text-align: center;">
        <div class="badge badge-primary">Security</div>
        <h2>Verify your identity</h2>
        <p>Your one-time password (OTP) for Nexora Go is ready. Use this code to complete your ${purpose.replace('_', ' ')}.</p>
        
        <div style="background: ${COLORS.bg}; border-radius: 20px; padding: 40px; margin: 40px 0; border: 2px dashed ${COLORS.primary};">
          <div style="font-size: 48px; font-weight: 900; letter-spacing: 12px; color: ${COLORS.primary}; margin-bottom: 8px;">${otp}</div>
          <div style="font-size: 13px; color: ${COLORS.lightText}; font-weight: 600; text-transform: uppercase;">Valid for 10 minutes only</div>
        </div>
        
        <p style="font-size: 14px;">If you didn't request this code, you can safely ignore this email. Someone else might have typed your email address by mistake.</p>
      </div>
    `;

    await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'Nexora Go <noreply@nexorago.com>',
      to: email,
      subject: `${subjectPrefix} - Nexora Go`,
      html: emailWrapper(content, subjectPrefix, `Your verification code is ${otp}`),
      attachments: getLogoAttachment()
    });
    return { success: true };
  } catch (error) {
    console.error('OTP email error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send Welcome Email - Professional App Style
 */
const sendWelcomeEmail = async (email, name) => {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) return { success: true };
    const transporter = createTransporter();

    const content = `
      <div style="text-align: center;">
        <div class="badge badge-success">Welcome</div>
        <h2>Hello ${name}! 👋</h2>
        <p>Welcome to the Homster family. We're excited to help you take care of your home with our premium services.</p>
        
        <div style="display: flex; justify-content: space-around; margin: 40px 0; flex-wrap: wrap;">
          <div style="width: 140px; margin: 10px;">
             <div style="font-size: 32px; margin-bottom: 10px;">🛡️</div>
             <div style="font-size: 14px; font-weight: 700;">Verified Pros</div>
          </div>
          <div style="width: 140px; margin: 10px;">
             <div style="font-size: 32px; margin-bottom: 10px;">⚡</div>
             <div style="font-size: 14px; font-weight: 700;">Fast Booking</div>
          </div>
          <div style="width: 140px; margin: 10px;">
             <div style="font-size: 32px; margin-bottom: 10px;">💎</div>
             <div style="font-size: 14px; font-weight: 700;">Secure Pay</div>
          </div>
        </div>

        <div class="btn-container">
          <a href="#" class="btn">Book Your First Service</a>
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'Homster <noreply@homster.com>',
      to: email,
      subject: 'Welcome to Homster!',
      html: emailWrapper(content, 'Welcome', 'Welcome to the future of home services')
    });
    return { success: true };
  } catch (error) {
    console.error('Welcome email error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send Booking Email - Detailed App Style
 */
const sendBookingEmails = async (booking, user, vendor, service) => {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) return;
    const transporter = createTransporter();
    const bookingId = booking.bookingNumber || booking._id;

    if (user && user.email) {
      const content = `
        <div class="badge badge-success">Confirmed</div>
        <h2>Booking Scheduled</h2>
        <p>Great news! Your booking for <strong>${service.title || service.name}</strong> has been confirmed. A professional will be at your door as per the schedule below.</p>
        
        <div class="card" style="background-color: #ffffff; border: 1px solid ${COLORS.border}; border-radius: 20px; padding: 24px; margin: 24px 0;">
          <div class="card-title" style="margin-bottom: 16px; border-bottom: 1px solid ${COLORS.border}; padding-bottom: 8px;">Order Summary</div>
          
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 6px 0; font-size: 13px; font-weight: 600; color: ${COLORS.lightText}; text-align: left;">Booking ID</td>
              <td style="padding: 6px 0; font-size: 13px; font-weight: 700; color: ${COLORS.text}; text-align: right;">#${bookingId}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-size: 13px; font-weight: 600; color: ${COLORS.lightText}; text-align: left;">Date</td>
              <td style="padding: 6px 0; font-size: 13px; font-weight: 700; color: ${COLORS.text}; text-align: right;">${new Date(booking.scheduledDate).toLocaleDateString('en-IN', { dateStyle: 'full' })}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-size: 13px; font-weight: 600; color: ${COLORS.lightText}; text-align: left;">Time Slot</td>
              <td style="padding: 6px 0; font-size: 13px; font-weight: 700; color: ${COLORS.text}; text-align: right;">${booking.scheduledTime}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-size: 13px; font-weight: 600; color: ${COLORS.lightText}; text-align: left;">Address</td>
              <td style="padding: 6px 0; font-size: 13px; font-weight: 700; color: ${COLORS.text}; text-align: right;">${booking.address?.city || ''}, ${booking.address?.pincode || ''}</td>
            </tr>
            <tr>
              <td colspan="2" style="padding-top: 16px; border-top: 2px dashed ${COLORS.border};">
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
                  <tr>
                    <td style="font-size: 16px; font-weight: 800; color: ${COLORS.text}; text-align: left;">Total Amount</td>
                    <td style="font-size: 20px; font-weight: 900; color: ${COLORS.primary}; text-align: right;">₹${booking.finalAmount}</td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </div>

        <div class="btn-container">
          <a href="#" class="btn">Track Order in App</a>
        </div>
      `;

      await transporter.sendMail({
        from: process.env.EMAIL_FROM || 'Nexora Go <noreply@nexorago.com>',
        to: user.email,
        subject: `Booking Confirmed #${bookingId} - Nexora Go`,
        html: emailWrapper(content, 'Confirmed', 'Your booking is scheduled successfully')
      });
    }

    if (vendor && vendor.email) {
      const vContent = `
        <div class="badge badge-primary">New Job</div>
        <h2>Incoming Order</h2>
        <p>Hello ${vendor.name}, a new booking has been assigned to you. Plan your resources accordingly.</p>
        
        <div class="card" style="background-color: #ffffff; border: 1px solid ${COLORS.border}; border-radius: 20px; padding: 24px; margin: 24px 0;">
          <div class="card-title" style="margin-bottom: 16px; border-bottom: 1px solid ${COLORS.border}; padding-bottom: 8px;">Job Details</div>
          
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 6px 0; font-size: 13px; font-weight: 600; color: ${COLORS.lightText}; text-align: left;">Order ID</td>
              <td style="padding: 6px 0; font-size: 13px; font-weight: 700; color: ${COLORS.text}; text-align: right;">#${bookingId}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-size: 13px; font-weight: 600; color: ${COLORS.lightText}; text-align: left;">Service</td>
              <td style="padding: 6px 0; font-size: 13px; font-weight: 700; color: ${COLORS.text}; text-align: right;">${service.title || service.name}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-size: 13px; font-weight: 600; color: ${COLORS.lightText}; text-align: left;">Customer</td>
              <td style="padding: 6px 0; font-size: 13px; font-weight: 700; color: ${COLORS.text}; text-align: right;">${user.name}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-size: 13px; font-weight: 600; color: ${COLORS.lightText}; text-align: left;">Schedule</td>
              <td style="padding: 6px 0; font-size: 13px; font-weight: 700; color: ${COLORS.text}; text-align: right;">${new Date(booking.scheduledDate).toLocaleDateString()} at ${booking.scheduledTime}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-size: 13px; font-weight: 600; color: ${COLORS.lightText}; text-align: left;">Amount</td>
              <td style="padding: 6px 0; font-size: 13px; font-weight: 700; color: ${COLORS.text}; text-align: right;">₹${booking.finalAmount}</td>
            </tr>
          </table>
        </div>

        <div class="btn-container">
          <a href="#" class="btn" style="background-color: ${COLORS.secondary};">Accept & View Details</a>
        </div>
      `;

      await transporter.sendMail({
        from: process.env.EMAIL_FROM || 'Nexora Go <noreply@nexorago.com>',
        to: vendor.email,
        subject: `New Job Assigned #${bookingId} - Nexora Go`,
        html: emailWrapper(vContent, 'New Job', 'Action Required: New job assigned')
      });
    }
  } catch (error) { console.error('Booking email error:', error); }
};

/**
 * Send Invoice Email - Professional Invoice Style
 */
const sendBookingCompletionEmails = async (booking) => {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) return;
    const transporter = createTransporter();
    const user = booking.userId;
    const bookingId = booking.bookingNumber || booking._id;

    if (user && user.email) {
      const basePrice = Number(booking.basePrice || 0);
      const visitingCharges = Number(booking.visitingCharges || 0);
      const tax = Number(booking.tax || 0);
      const discount = Number(booking.discount || 0);
      const penalty = Number(booking.penalty || 0);
      const extraChargesTotal = Number(booking.extraChargesTotal || 
        (Array.isArray(booking.extraCharges) ? booking.extraCharges.reduce((sum, c) => sum + (c.total || (c.price * (c.quantity || 1)) || 0), 0) : 0));
      
      const finalAmount = Number(booking.finalAmount || booking.userPayableAmount || (basePrice + visitingCharges + tax + extraChargesTotal + penalty - discount));
      const completedDate = booking.completedAt ? new Date(booking.completedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'numeric', year: 'numeric' }) : new Date().toLocaleDateString('en-IN');
      const paymentMethodStr = booking.paymentMethod ? booking.paymentMethod.toUpperCase() : 'ONLINE / CASH';
      const paymentStatusStr = booking.paymentStatus ? booking.paymentStatus.toUpperCase() : 'PAID';
      const serviceName = booking.serviceName || booking.serviceId?.title || 'Home Service';

      // Build extra charges HTML rows if any
      let extraChargesHtml = '';
      if (Array.isArray(booking.extraCharges) && booking.extraCharges.length > 0) {
        extraChargesHtml = booking.extraCharges.map(item => `
          <tr>
            <td style="padding: 6px 0; font-size: 13px; font-weight: 600; color: ${COLORS.lightText}; text-align: left;">
              + ${item.name || 'Extra Charge'} ${item.quantity > 1 ? `(x${item.quantity})` : ''}
            </td>
            <td style="padding: 6px 0; font-size: 13px; font-weight: 700; color: ${COLORS.text}; text-align: right;">
              +₹${item.total || (item.price * (item.quantity || 1))}
            </td>
          </tr>
        `).join('');
      } else if (extraChargesTotal > 0) {
        extraChargesHtml = `
          <tr>
            <td style="padding: 6px 0; font-size: 13px; font-weight: 600; color: ${COLORS.lightText}; text-align: left;">Extra Charges / Parts</td>
            <td style="padding: 6px 0; font-size: 13px; font-weight: 700; color: ${COLORS.text}; text-align: right;">+₹${extraChargesTotal}</td>
          </tr>
        `;
      }

      // Build discount HTML row if any
      const discountHtml = discount > 0 ? `
        <tr>
          <td style="padding: 6px 0; font-size: 13px; font-weight: 600; color: ${COLORS.success}; text-align: left;">Coupon / Discount</td>
          <td style="padding: 6px 0; font-size: 13px; font-weight: 700; color: ${COLORS.success}; text-align: right;">-₹${discount}</td>
        </tr>
      ` : '';

      const content = `
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="font-size: 40px; margin-bottom: 12px;">⭐</div>
          <h2 style="margin-bottom: 8px;">Service Completed</h2>
          <p style="margin: 0; font-size: 15px;">Thank you for choosing <strong>Nexora Go</strong>. We hope the service for <strong>${serviceName}</strong> was to your satisfaction.</p>
        </div>

        <div class="card" style="background-color: #ffffff; border: 1px solid ${COLORS.border}; border-radius: 20px; padding: 24px; margin: 24px 0;">
          <div class="card-title" style="margin-bottom: 16px; border-bottom: 1px solid ${COLORS.border}; padding-bottom: 8px;">Official Receipt</div>
          
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 6px 0; font-size: 13px; font-weight: 600; color: ${COLORS.lightText}; text-align: left;">Invoice No.</td>
              <td style="padding: 6px 0; font-size: 13px; font-weight: 700; color: ${COLORS.text}; text-align: right;">INV-${bookingId}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-size: 13px; font-weight: 600; color: ${COLORS.lightText}; text-align: left;">Completed On</td>
              <td style="padding: 6px 0; font-size: 13px; font-weight: 700; color: ${COLORS.text}; text-align: right;">${completedDate}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-size: 13px; font-weight: 600; color: ${COLORS.lightText}; text-align: left;">Payment Method</td>
              <td style="padding: 6px 0; font-size: 13px; font-weight: 700; color: ${COLORS.text}; text-align: right;">${paymentMethodStr} (${paymentStatusStr})</td>
            </tr>

            <tr>
              <td colspan="2" style="padding: 12px 0 6px 0; border-top: 1px solid ${COLORS.border}; font-size: 11px; font-weight: 700; color: ${COLORS.lightText}; text-transform: uppercase; letter-spacing: 0.5px;">
                Billing Breakdown
              </td>
            </tr>

            <tr>
              <td style="padding: 6px 0; font-size: 13px; font-weight: 600; color: ${COLORS.lightText}; text-align: left;">Service Base Charge</td>
              <td style="padding: 6px 0; font-size: 13px; font-weight: 700; color: ${COLORS.text}; text-align: right;">₹${basePrice}</td>
            </tr>

            ${extraChargesHtml}

            <tr>
              <td style="padding: 6px 0; font-size: 13px; font-weight: 600; color: ${COLORS.lightText}; text-align: left;">Visiting Fee</td>
              <td style="padding: 6px 0; font-size: 13px; font-weight: 700; color: ${COLORS.text}; text-align: right;">₹${visitingCharges}</td>
            </tr>

            <tr>
              <td style="padding: 6px 0; font-size: 13px; font-weight: 600; color: ${COLORS.lightText}; text-align: left;">HST / Taxes</td>
              <td style="padding: 6px 0; font-size: 13px; font-weight: 700; color: ${COLORS.text}; text-align: right;">₹${tax}</td>
            </tr>

            ${discountHtml}

            <tr>
              <td colspan="2" style="padding-top: 16px; border-top: 2px dashed ${COLORS.border};">
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
                  <tr>
                    <td style="font-size: 16px; font-weight: 800; color: ${COLORS.text}; text-align: left;">Amount Paid</td>
                    <td style="font-size: 20px; font-weight: 900; color: ${COLORS.primary}; text-align: right;">₹${finalAmount}</td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </div>

        <div style="text-align: center; margin-top: 24px; border: 1px solid ${COLORS.border}; border-radius: 16px; padding: 20px;">
           <div style="font-weight: 700; font-size: 13px; color: ${COLORS.text}; margin-bottom: 6px; text-transform: uppercase;">Rate the Professional</div>
           <p style="font-size: 13px; margin: 0 0 12px 0;">How was your experience with us? Help others by rating the service.</p>
           <div class="btn-container" style="margin-top: 12px;">
             <a href="#" class="btn" style="background-color: #f59e0b; padding: 12px 24px; font-size: 14px;">Submit Rating</a>
           </div>
        </div>
      `;

      await transporter.sendMail({
        from: process.env.EMAIL_FROM || 'Nexora Go <noreply@nexorago.com>',
        to: user.email,
        subject: `Service Invoice #${bookingId} - Nexora Go`,
        html: emailWrapper(content, 'Invoice', 'Your service is complete. Here is the receipt.')
      });
    }
  } catch (error) { console.error('Invoice email error:', error); }
};

/**
 * Send Withdrawal Approved Email
 */
const sendWithdrawalApprovedEmail = async (vendor, amount, transactionId) => {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS || !vendor.email) return;
    const transporter = createTransporter();

    const content = `
      <div style="text-align: center;">
        <div class="badge badge-success">Settlement Done</div>
        <h2>Funds Withdrawn Successfully</h2>
        <p>Hi ${vendor.name}, your withdrawal request has been approved and successfully processed to your account.</p>
        
        <div class="card" style="background-color: #ffffff; border: 1px solid ${COLORS.border}; border-radius: 20px; padding: 24px; margin: 24px 0;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 6px 0; font-size: 13px; font-weight: 600; color: ${COLORS.lightText}; text-align: left;">Transaction Ref</td>
              <td style="padding: 6px 0; font-size: 13px; font-weight: 700; color: ${COLORS.text}; text-align: right;">${transactionId || 'N/A'}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-size: 13px; font-weight: 600; color: ${COLORS.lightText}; text-align: left;">Settlement Date</td>
              <td style="padding: 6px 0; font-size: 13px; font-weight: 700; color: ${COLORS.text}; text-align: right;">${new Date().toLocaleDateString()}</td>
            </tr>
            <tr>
              <td colspan="2" style="padding-top: 16px; border-top: 2px dashed ${COLORS.border};">
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
                  <tr>
                    <td style="font-size: 16px; font-weight: 800; color: ${COLORS.text}; text-align: left;">Amount Sent</td>
                    <td style="font-size: 20px; font-weight: 900; color: ${COLORS.success}; text-align: right;">₹${amount}</td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'Nexora Go <noreply@nexorago.com>',
      to: vendor.email,
      subject: 'Withdrawal Success - Nexora Go',
      html: emailWrapper(content, 'Withdrawal', 'Your funds are on the way')
    });
  } catch (error) { console.error(error); }
};

/**
 * Send Dues Payment Approved Email
 */
const sendDuesPaymentApprovedEmail = async (vendor, amount, balanceAfter) => {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS || !vendor.email) return;
    const transporter = createTransporter();

    const content = `
      <div style="text-align: center;">
        <div class="badge badge-success">Verified</div>
        <h2>Payment Acknowledged</h2>
        <p>Hi ${vendor.name}, we've successfully verified your dues payment. Your wallet has been updated.</p>
        
        <div class="card" style="background-color: #ffffff; border: 1px solid ${COLORS.border}; border-radius: 20px; padding: 24px; margin: 24px 0;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 6px 0; font-size: 13px; font-weight: 600; color: ${COLORS.lightText}; text-align: left;">Payment Amount</td>
              <td style="padding: 6px 0; font-size: 13px; font-weight: 700; color: ${COLORS.text}; text-align: right;">₹${amount}</td>
            </tr>
            <tr>
              <td colspan="2" style="padding-top: 16px; border-top: 2px dashed ${COLORS.border};">
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
                  <tr>
                    <td style="font-size: 16px; font-weight: 800; color: ${COLORS.text}; text-align: left;">Remaining Balance</td>
                    <td style="font-size: 20px; font-weight: 900; color: ${COLORS.text}; text-align: right;">₹${balanceAfter}</td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'Nexora Go <noreply@nexorago.com>',
      to: vendor.email,
      subject: 'Dues Payment Verified - Nexora Go',
      html: emailWrapper(content, 'Verified', 'We have received your payment')
    });
  } catch (error) { console.error(error); }
};

/**
 * Send Password Reset Link Email
 */
const sendPasswordResetEmail = async (email, name, resetUrl, frontendUrl = '') => {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.log(`[EMAIL SERVICE] Password Reset Link for ${email}: ${resetUrl}`);
      return { success: true };
    }

    const transporter = createTransporter();
    const content = `
      <div style="text-align: left; padding: 10px 0;">
        <div class="badge badge-primary" style="background-color: rgba(0, 36, 107, 0.08); color: #00246b; font-weight: 700; padding: 6px 14px; border-radius: 20px; display: inline-block; margin-bottom: 20px; font-size: 13px;">🔒 Security Verification</div>
        <h2 style="font-size: 26px; font-weight: 800; color: #0f172a; margin-bottom: 12px; letter-spacing: -0.5px;">Reset Your Password</h2>
        <p style="font-size: 16px; color: #334155; line-height: 1.6; margin-bottom: 12px;">Hi <strong>${name || 'Valued User'}</strong>,</p>
        <p style="font-size: 15px; color: #475569; line-height: 1.6; margin-bottom: 24px;">We received a request to reset the password for your <strong>Nexora Go</strong> account. Click the button below to choose a new password:</p>
        
        <div class="btn-container" style="text-align: left; margin: 28px 0 32px 0;">
          <a href="${resetUrl}" class="btn" style="background: linear-gradient(135deg, #00246b 0%, #0055ff 100%); color: #ffffff !important; padding: 16px 36px; border-radius: 14px; font-weight: 700; font-size: 16px; text-decoration: none; display: inline-block; box-shadow: 0 10px 20px -3px rgba(0, 36, 107, 0.35);">Reset Password</a>
        </div>
        
        <div style="background-color: #f8fafc; border-left: 4px solid #D68F35; padding: 16px 20px; border-radius: 0 14px 14px 0; margin-bottom: 28px;">
          <p style="font-size: 14px; color: #475569; margin: 0; font-weight: 600;">⏱️ This link is valid for 15 minutes only.</p>
          <p style="font-size: 13px; color: #64748b; margin: 4px 0 0 0;">If you didn't request a password reset, your account is completely safe and you can safely ignore this email.</p>
        </div>

        <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 20px;">
          <p style="font-size: 12px; color: #94a3b8; margin: 0 0 6px 0;">Button not working? Copy and paste this URL into your browser:</p>
          <p style="font-size: 12px; color: #0055ff; word-break: break-all; margin: 0; font-family: monospace;">${resetUrl}</p>
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'Nexora Go <noreply@nexorago.com>',
      to: email,
      subject: 'Reset Your Password - Nexora Go',
      html: emailWrapper(content, 'Reset Your Password', 'Reset Link', frontendUrl),
      attachments: getLogoAttachment()
    });
    return { success: true };
  } catch (error) {
    console.error('sendPasswordResetEmail Error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send Password Changed Confirmation Email
 */
const sendPasswordChangedEmail = async (email, name) => {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.log(`[EMAIL SERVICE] Password successfully updated for ${email}`);
      return { success: true };
    }

    const transporter = createTransporter();
    const content = `
      <div style="text-align: left; padding: 20px 0;">
        <div class="badge badge-success">Success</div>
        <h2>Password Updated Successfully</h2>
        <p>Hi ${name || 'User'},</p>
        <p>This is a confirmation that your password has been changed successfully.</p>
        <p>If you did not perform this action, please contact support immediately to secure your account.</p>
      </div>
    `;

    await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'Nexora Go <noreply@nexorago.com>',
      to: email,
      subject: 'Password Changed Successfully',
      html: emailWrapper(content, 'Password Updated', 'Your password was changed')
    });
  } catch (error) {
    console.error('sendPasswordChangedEmail Error:', error);
  }
};

module.exports = {
  sendOTPEmail,
  sendWelcomeEmail,
  sendBookingEmails,
  sendBookingCompletionEmails,
  sendWithdrawalApprovedEmail,
  sendDuesPaymentApprovedEmail,
  sendPasswordResetEmail,
  sendPasswordChangedEmail
};
