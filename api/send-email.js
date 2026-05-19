/*
 * ═══════════════════════════════════════════════════════════════
 *  FIXIA — Service Marketplace
 *  /api/send-email.js  —  Vercel Serverless Function
 *  © ByteStack Labs 2025. All Rights Reserved.
 *
 *  Called by: fixia-data.js → FX.sendEmail(type, data)
 *  Transport: Nodemailer + Gmail App Password
 *
 *  EMAIL TYPES:
 *  ┌──────────────────────────────┬──────────────────────────────┐
 *  │ Type                         │ Trigger                      │
 *  ├──────────────────────────────┼──────────────────────────────┤
 *  │ regular_welcome              │ Regular user signs up        │
 *  │ regular_payment_notify       │ Regular pays for Plus        │
 *  │ provider_signup_confirm      │ Provider submits application │
 *  │ provider_signup_notify       │ Owner: new provider pending  │
 *  │ provider_approved            │ Admin approves provider      │
 *  │ provider_rejected            │ Admin rejects provider       │
 *  │ elite_granted                │ Admin grants Fixia Elite     │
 *  │ elite_revoked                │ Admin revokes Fixia Elite    │
 *  │ rating_notify_provider       │ New rating submitted         │
 *  │ reset_password               │ Password reset request       │
 *  │ account_suspended            │ Admin suspends an account    │
 *  └──────────────────────────────┴──────────────────────────────┘
 * ═══════════════════════════════════════════════════════════════
 */

const nodemailer = require('nodemailer');

const OWNER_EMAIL = process.env.GMAIL_USER;
const APP_URL     = process.env.APP_URL || 'https://fixia.ph';
const APP_NAME    = 'Fixia';

/* ── Nodemailer transporter ──────────────────────────────────── */
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS   // Gmail App Password (not account password)
  }
});

/* ══════════════════════════════════════════════════════════════
   SHARED HTML HELPERS
══════════════════════════════════════════════════════════════ */
function brandHeader() {
  return `
  <div style="background:linear-gradient(135deg,#0F1B2D 0%,#1E3048 60%,#FF5A1F22 100%);
              padding:24px 28px;border-radius:12px 12px 0 0;">
    <table cellpadding="0" cellspacing="0" style="width:100%;">
      <tr>
        <td>
          <span style="font-family:sans-serif;font-size:22px;font-weight:800;
                       letter-spacing:-0.04em;color:#fff;">
            fix<span style="color:#FF5A1F;">ia</span>
          </span>
          <span style="font-family:sans-serif;font-size:11px;color:rgba(255,255,255,0.4);
                       margin-left:8px;font-weight:600;letter-spacing:0.06em;
                       text-transform:uppercase;">Service Marketplace</span>
        </td>
      </tr>
    </table>
  </div>`;
}

function brandFooter() {
  return `
  <div style="background:#F5F7FA;padding:16px 28px;border-radius:0 0 12px 12px;
              border-top:1px solid #E8ECF0;">
    <p style="color:#aaa;font-size:11px;font-family:sans-serif;
              margin:0;text-align:center;line-height:1.7;">
      © ${new Date().getFullYear()} Fixia — ByteStack Labs. All Rights Reserved.<br/>
      This is an automated message — please do not reply directly.<br/>
      For support: <a href="mailto:${OWNER_EMAIL}" style="color:#FF5A1F;">${OWNER_EMAIL}</a>
    </p>
  </div>`;
}

function wrap(content) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
</head>
<body style="margin:0;padding:0;background:#EAEDF0;">
  <div style="padding:28px 12px;font-family:sans-serif;">
    <div style="max-width:560px;margin:0 auto;background:#fff;
                border-radius:12px;overflow:hidden;
                box-shadow:0 4px 24px rgba(0,0,0,0.09);">
      ${brandHeader()}
      <div style="padding:26px 28px;">
        ${content}
      </div>
      ${brandFooter()}
    </div>
  </div>
</body>
</html>`;
}

function infoRow(label, value) {
  return `
  <tr>
    <td style="padding:8px 0;color:#8896A5;font-size:13px;width:140px;
               vertical-align:top;font-family:sans-serif;">${label}</td>
    <td style="padding:8px 0;color:#1A2332;font-size:13px;
               font-weight:700;font-family:sans-serif;">${value}</td>
  </tr>`;
}

function infoTable(rows) {
  return `
  <table cellpadding="0" cellspacing="0"
    style="width:100%;border-collapse:collapse;
           background:#F5F7FA;border-radius:10px;
           padding:4px 14px;margin:14px 0;border:1px solid #E8ECF0;">
    <tbody>${rows}</tbody>
  </table>`;
}

function btnPrimary(label, href) {
  return `
  <a href="${href}"
     style="display:inline-block;background:linear-gradient(135deg,#FF5A1F,#D94200);
            color:#fff;padding:12px 26px;border-radius:10px;
            text-decoration:none;font-weight:700;font-size:14px;
            font-family:sans-serif;margin-top:14px;
            box-shadow:0 4px 14px rgba(255,90,31,0.3);">
    ${label}
  </a>`;
}

function alertBox(msg, type = 'warning') {
  const styles = {
    warning: { bg:'#FFFBEB', border:'#F59E0B', text:'#92400E' },
    danger:  { bg:'#FFF5F5', border:'#FCA5A5', text:'#991B1B' },
    info:    { bg:'#FFF0EB', border:'#FF5A1F', text:'#7C2D12' },
    success: { bg:'#ECFDF5', border:'#6EE7B7', text:'#065F46' },
  };
  const s = styles[type] || styles.info;
  return `
  <div style="background:${s.bg};border:1px solid ${s.border};
              border-radius:8px;padding:12px 14px;margin:14px 0;">
    <p style="color:${s.text};font-size:13px;margin:0;
              font-family:sans-serif;line-height:1.6;">${msg}</p>
  </div>`;
}

function heading(text, sub = '') {
  return `
  <h2 style="color:#0F1B2D;margin:0 0 ${sub ? '4px' : '16px'};
             font-size:20px;font-family:sans-serif;font-weight:800;">${text}</h2>
  ${sub ? `<p style="color:#8896A5;font-size:14px;font-family:sans-serif;
                      margin:0 0 16px;line-height:1.6;">${sub}</p>` : ''}`;
}

function starsHtml(n) {
  return '⭐'.repeat(Math.min(5, Math.max(1, n)));
}

/* ══════════════════════════════════════════════════════════════
   EMAIL TEMPLATES
══════════════════════════════════════════════════════════════ */
const templates = {

  /* ── Regular user: welcome after signup ─────────────────────── */
  regular_welcome: (d) => ({
    to:      d.email,
    subject: `Welcome to Fixia, ${d.fullName}! 🎉`,
    html: wrap(`
      ${heading(`Welcome to Fixia, ${d.fullName}! 🎉`,
        'You\'re all set to discover trusted local service providers near you.')}
      ${infoTable(
        infoRow('Username', `<span style="font-family:monospace;">${d.username}</span>`) +
        infoRow('Plan',     d.package || 'Free')
      )}
      <p style="color:#4A5568;font-size:13px;font-family:sans-serif;line-height:1.7;margin:0 0 14px;">
        Browse services by category, filter by your area, and contact providers directly.
        After any transaction, don't forget to leave a rating — it helps great providers get noticed!
      </p>
      ${d.package === 'free' ? alertBox(
        '💡 You\'re on the <strong>Free plan</strong>. Upgrade to <strong>Fixia Plus</strong> anytime to enjoy an ad-free browsing experience.',
        'info'
      ) : alertBox('✅ Your <strong>' + d.package + '</strong> plan is active. Enjoy your ad-free experience!', 'success')}
      ${btnPrimary('Browse Services →', APP_URL + '/homepage.html')}
    `)
  }),

/* ── Email OTP verification ──────────────────────────────────── */
  email_otp: (d) => ({
    to:      d.email,
    subject: `${d.otp} is your Fixia verification code`,
    html: wrap(`
      ${heading('Verify Your Email Address', 'Use the code below to complete your Fixia registration.')}
      <div style="text-align:center;margin:24px 0;">
        <div style="display:inline-block;background:#FFF0EB;border:2px dashed #FF5A1F;border-radius:12px;padding:18px 36px;">
          <div style="font-size:2.2rem;font-weight:900;letter-spacing:0.18em;color:#FF5A1F;font-family:monospace;">${d.otp}</div>
          <div style="font-size:0.75rem;color:#8896A5;margin-top:6px;">Expires in 10 minutes</div>
        </div>
      </div>
      ${alertBox('If you did not request this code, please ignore this email. Do not share this code with anyone.', 'info')}
    `),
  }), 
  
  /* ── Regular user: payment received (Plus upgrade) ──────────── */
  regular_payment_notify: (d) => ({
    to:      OWNER_EMAIL,
    subject: `[Fixia] Regular User Payment — ${d.fullName} (${d.package})`,
    html: wrap(`
      ${heading('New Regular User Payment 💳')}
      <p style="color:#4A5568;font-size:13px;font-family:sans-serif;line-height:1.7;margin:0 0 14px;">
        A regular user has paid for the <strong>${d.package}</strong> plan and is awaiting verification.
      </p>
      ${infoTable(
        infoRow('Name',      d.fullName) +
        infoRow('Email',     d.email) +
        infoRow('Plan',      d.package) +
        infoRow('Method',    d.paymentMethod) +
        infoRow('Reference', d.paymentReference || '—') +
        infoRow('Amount',    d.paymentAmount)
      )}
      ${d.paymentMethod !== 'PayPal' ? alertBox(
        `Please verify the <strong>${d.paymentMethod}</strong> reference <strong>${d.paymentReference}</strong> before activating their Fixia Plus plan.`,
        'warning'
      ) : alertBox('✅ PayPal payment was automatically verified.', 'success')}
      ${btnPrimary('Go to Admin Panel →', APP_URL + '/admin.html')}
    `)
  }),

  /* ── Provider: confirmation after signup submission ──────────── */
  provider_signup_confirm: (d) => ({
    to:      d.email,
    subject: `[Fixia] Application Received — ${d.bizName}`,
    html: wrap(`
      ${heading('Application Received! 📋',
        `Thank you, ${d.fullName}. We've received your application for <strong>${d.bizName}</strong>.`)}
      ${infoTable(
        infoRow('Business / Name', d.bizName) +
        infoRow('Plan Selected',   d.package || '—') +
        infoRow('Status',          '⏳ Pending Review')
      )}
      <p style="color:#4A5568;font-size:13px;font-family:sans-serif;line-height:1.7;margin:14px 0;">
        Our team will review your submitted ID and details within <strong>24–48 hours</strong>.
        You'll receive another email once your account is approved or if we need more information.
      </p>
      ${alertBox('Do not create another account while your application is being reviewed.', 'info')}
    `)
  }),

  /* ── Owner: new provider application submitted ───────────────── */
  provider_signup_notify: (d) => ({
    to:      OWNER_EMAIL,
    subject: `[Fixia] New Provider Application — ${d.bizName} (${d.package})`,
    html: wrap(`
      ${heading('New Provider Application 🔧')}
      <p style="color:#4A5568;font-size:13px;font-family:sans-serif;line-height:1.7;margin:0 0 14px;">
        A new provider has submitted an application and is pending your review.
      </p>
      ${infoTable(
        infoRow('Business',   d.bizName) +
        infoRow('Name',       d.fullName) +
        infoRow('Email',      d.email) +
        infoRow('Type',       d.provType) +
        infoRow('Service',    d.service) +
        infoRow('Location',   d.location) +
        infoRow('Plan',       d.package) +
        infoRow('Method',     d.paymentMethod) +
        infoRow('Reference',  d.paymentReference || '—') +
        infoRow('Amount',     d.paymentAmount)
      )}
      ${alertBox(
        `Verify the payment reference <strong>${d.paymentReference || '—'}</strong> via <strong>${d.paymentMethod}</strong>, then review their uploaded ID in the admin panel before approving.`,
        'warning'
      )}
      ${btnPrimary('Review in Admin Panel →', APP_URL + '/admin.html')}
    `)
  }),

  /* ── Provider: account approved ─────────────────────────────── */
  provider_approved: (d) => ({
    to:      d.email,
    subject: `[Fixia] Your Account is Approved! ✅ — ${d.bizName}`,
    html: wrap(`
      ${heading('You\'re Approved! ✅',
        `Congratulations, ${d.fullName}! Your provider account for <strong>${d.bizName}</strong> is now live on Fixia.`)}
      ${infoTable(
        infoRow('Business',  d.bizName) +
        infoRow('Username',  `<span style="font-family:monospace;">${d.username}</span>`) +
        infoRow('Plan',      d.package || '—') +
        infoRow('Status',    '✅ Active')
      )}
      <p style="color:#4A5568;font-size:13px;font-family:sans-serif;line-height:1.7;margin:14px 0;">
        Log in to your provider dashboard to add your service listings, manage your profile,
        and start getting discovered by customers in your area.
      </p>
      ${alertBox('💡 Tip: The more complete your profile and the more reviews you collect, the higher you\'ll rank in search results!', 'success')}
      ${btnPrimary('Go to Provider Dashboard →', APP_URL + '/provider-dashboard.html')}
    `)
  }),

  /* ── Provider: account rejected ─────────────────────────────── */
  provider_rejected: (d) => ({
    to:      d.email,
    subject: `[Fixia] Update on Your Application — ${d.bizName}`,
    html: wrap(`
      ${heading('Application Update')}
      <p style="color:#4A5568;font-size:13px;font-family:sans-serif;line-height:1.7;margin:0 0 14px;">
        Hi <strong>${d.fullName}</strong>, unfortunately your provider application
        for <strong>${d.bizName}</strong> was not approved at this time.
      </p>
      ${d.reason ? alertBox(`<strong>Reason:</strong> ${d.reason}`, 'danger') : ''}
      <p style="color:#4A5568;font-size:13px;font-family:sans-serif;line-height:1.7;margin:14px 0;">
        If you believe this is an error or have additional documents to submit,
        please contact us at <a href="mailto:${OWNER_EMAIL}" style="color:#FF5A1F;">${OWNER_EMAIL}</a>.
      </p>
    `)
  }),

  /* ── Provider: Fixia Elite granted ──────────────────────────── */
  elite_granted: (d) => ({
    to:      d.email,
    subject: `[Fixia] 👑 You've Been Granted Fixia Elite! — ${d.bizName}`,
    html: wrap(`
      <div style="text-align:center;margin-bottom:20px;">
        <div style="font-size:48px;margin-bottom:8px;">👑</div>
        ${heading('Fixia Elite — Unlocked!')}
      </div>
      <p style="color:#4A5568;font-size:13px;font-family:sans-serif;line-height:1.7;margin:0 0 14px;">
        Congratulations, <strong>${d.fullName}</strong>! 
        <strong>${d.bizName}</strong> has been granted the exclusive <strong>Fixia Elite</strong> status.
      </p>
      ${infoTable(
        infoRow('Status',   '👑 Fixia Elite') +
        infoRow('Granted',  new Date().toLocaleDateString('en-PH', { timeZone:'Asia/Manila' })) +
        infoRow('Expires',  d.expiresAt || 'No expiry — Permanent')
      )}
      ${alertBox(`
        As a Fixia Elite provider, your listing is <strong>pinned at the top of the featured strip</strong>,
        you receive a special crown badge, priority placement in all search results,
        and exclusive recognition within the Fixia community.
      `, 'success')}
      ${btnPrimary('View Your Dashboard →', APP_URL + '/provider-dashboard.html')}
    `)
  }),

  /* ── Provider: Fixia Elite revoked ──────────────────────────── */
  elite_revoked: (d) => ({
    to:      d.email,
    subject: `[Fixia] Fixia Elite Status Update — ${d.bizName}`,
    html: wrap(`
      ${heading('Fixia Elite Status Update')}
      <p style="color:#4A5568;font-size:13px;font-family:sans-serif;line-height:1.7;margin:0 0 14px;">
        Hi <strong>${d.fullName}</strong>, your <strong>Fixia Elite</strong> status for
        <strong>${d.bizName}</strong> has ended. Your listing remains active under your current package.
      </p>
      <p style="color:#4A5568;font-size:13px;font-family:sans-serif;line-height:1.7;margin:0;">
        Watch out for future Fixia promotions and competitions — Elite status can be earned again!
      </p>
    `)
  }),

  /* ── Rating notification to provider ────────────────────────── */
  rating_notify_provider: (d) => ({
    to:      d.email,
    subject: `[Fixia] New Rating for ${d.bizName} — ${starsHtml(d.stars)}`,
    html: wrap(`
      ${heading(`New Rating! ${starsHtml(d.stars)}`)}
      <p style="color:#4A5568;font-size:13px;font-family:sans-serif;line-height:1.7;margin:0 0 14px;">
        A customer left a new rating for <strong>${d.bizName}</strong>.
      </p>
      ${infoTable(
        infoRow('Stars',   starsHtml(d.stars) + ` (${d.stars}/5)`) +
        infoRow('Comment', d.comment || '(No comment left)') +
        infoRow('New Avg', `⭐ ${d.newAvg} overall`)
      )}
      ${d.stars >= 4
        ? alertBox('Great job! Keep up the excellent service. Encourage more customers to leave reviews to boost your ranking.', 'success')
        : alertBox('Every review is an opportunity to improve. If you have concerns, feel free to reach out to the customer.', 'info')
      }
      ${btnPrimary('View My Dashboard →', APP_URL + '/provider-dashboard.html')}
    `)
  }),

  /* ── Password reset ──────────────────────────────────────────── */
  reset_password: (d) => ({
    to:      d.email,
    subject: `[Fixia] Password Reset Request`,
    html: wrap(`
      ${heading('Reset Your Password 🔐')}
      <p style="color:#4A5568;font-size:13px;font-family:sans-serif;line-height:1.7;margin:0 0 14px;">
        Hi <strong>${d.fullName}</strong>, we received a request to reset your Fixia password.
        This link expires in <strong>1 hour</strong>.
      </p>
      ${btnPrimary('Reset My Password →', APP_URL + '/reset-password.html?token=' + d.token)}
      ${alertBox('If you did not request a password reset, you can safely ignore this email. Your password will not change.', 'info')}
      <p style="color:#bbb;font-size:11px;font-family:sans-serif;margin-top:16px;word-break:break-all;">
        Or copy this link:<br/>
        ${APP_URL}/reset-password.html?token=${d.token}
      </p>
    `)
  }),

  /* ── Account suspended ───────────────────────────────────────── */
  account_suspended: (d) => ({
    to:      d.email,
    subject: `[Fixia] Account Suspended — Action Required`,
    html: wrap(`
      ${heading('Account Suspended 🚫')}
      <p style="color:#4A5568;font-size:13px;font-family:sans-serif;line-height:1.7;margin:0 0 14px;">
        Hi <strong>${d.fullName}</strong>, your Fixia account has been temporarily suspended.
      </p>
      ${d.reason ? alertBox(`<strong>Reason:</strong> ${d.reason}`, 'danger') : ''}
      <p style="color:#4A5568;font-size:13px;font-family:sans-serif;line-height:1.7;margin:14px 0 0;">
        To appeal this decision or for more information, contact us at
        <a href="mailto:${OWNER_EMAIL}" style="color:#FF5A1F;">${OWNER_EMAIL}</a>.
      </p>
    `)
  }),

};

/* ══════════════════════════════════════════════════════════════
   HANDLER
══════════════════════════════════════════════════════════════ */
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const { type, data } = req.body || {};

  if (!type || !templates[type]) {
    return res.status(400).json({ error: `Unknown email type: "${type}"` });
  }

  try {
    const { to, subject, html } = templates[type](data);
    await transporter.sendMail({
      from:    `"${APP_NAME}" <${OWNER_EMAIL}>`,
      to,
      subject,
      html,
    });
    console.log(`[Fixia Email] type="${type}" to="${to}"`);
    return res.status(200).json({ ok: true });
  } catch(err) {
    console.error(`[Fixia Email] FAILED type="${type}":`, err.message);
    return res.status(500).json({ error: err.message });
  }
};
