import nodemailer from 'nodemailer';
const OWNER = process.env.GMAIL_USER;
const APP = () => process.env.APP_URL || 'https://gofixia.vercel.app';
let tx;
const transport = () => (tx ||= nodemailer.createTransport({ service: 'gmail', auth: { user: OWNER, pass: process.env.GMAIL_PASS } }));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const wrap = (heading, body, cta) => `<!doctype html><html><body style="margin:0;background:#F4F5F6;font-family:Arial,Helvetica,sans-serif;color:#12161C">
<div style="max-width:560px;margin:0 auto;padding:24px 12px"><div style="background:#fff;border-top:3px solid #12161C">
<div style="padding:20px 28px;font:700 22px Arial;letter-spacing:-1px">fixia</div>
<div style="padding:0 28px 28px"><h2 style="margin:0 0 14px;font-size:20px">${heading}</h2>
<div style="font-size:14px;line-height:1.65;color:#444C58">${body}</div>
${cta ? `<p style="margin:22px 0 0"><a href="${APP()}${cta[1]}" style="background:#C93F08;color:#fff;padding:12px 22px;text-decoration:none;font-weight:700;font-size:14px">${esc(cta[0])}</a></p>` : ''}
</div></div><p style="font-size:11px;color:#5F6772;text-align:center">© Fixia · ByteStack Labs · automated message. Support: ${esc(OWNER)}</p></div></body></html>`;
const rows = (o) => `<table style="width:100%;border-collapse:collapse;margin:12px 0">${Object.entries(o).map(([k, v]) => `<tr><td style="padding:6px 0;color:#5F6772;width:130px;border-bottom:1px solid #D9DCE1">${esc(k)}</td><td style="padding:6px 0;font-weight:700;color:#12161C;border-bottom:1px solid #D9DCE1">${esc(v)}</td></tr>`).join('')}</table>`;

const T = {
  regular_welcome: (d) => [d.email, `Welcome to Fixia, ${d.fullName}`, wrap(`Welcome, ${esc(d.fullName)}`, `<p>You can now find trusted providers near you. After any job, leave a rating, it helps good providers get found.</p>${rows({ Username: d.username, Plan: d.package || 'Free' })}`, ['Browse services', '/'])],
  email_otp: (d) => [d.email, `${d.otp} is your Fixia verification code`, wrap('Verify your email', `<p>Your code is:</p><p style="font:700 34px monospace;letter-spacing:6px;margin:8px 0;color:#12161C">${esc(d.otp)}</p><p>It expires in 10 minutes. If you did not ask for it, ignore this email.</p>`)],
  payment_notify: (d) => [OWNER, `[Fixia] Payment — ${d.fullName} (${d.package})`, wrap('New payment', rows({ Name: d.fullName, Email: d.email, Plan: d.package, Method: d.method, Reference: d.reference || '—', Amount: d.amount, Status: d.verified ? 'Verified automatically' : 'Needs manual check' }), ['Open admin', '/admin/upgrades'])],
  provider_signup_confirm: (d) => [d.email, `Application received — ${d.bizName}`, wrap('Application received', `<p>Thank you, ${esc(d.fullName)}. We will review <b>${esc(d.bizName)}</b> within 24–48 hours and email you the result.</p>`)],
  provider_signup_notify: (d) => [OWNER, `[Fixia] New provider — ${d.bizName}`, wrap('New provider application', rows({ Business: d.bizName, Name: d.fullName, Email: d.email, Location: d.location, Plan: d.package }), ['Review', '/admin/pending'])],
  provider_approved: (d) => [d.email, `You are approved — ${d.bizName}`, wrap('You are approved', `<p>${esc(d.bizName)} is now live on Fixia. Add your services so customers can find you.</p>`, ['Open profile', '/profile'])],
  provider_rejected: (d) => [d.email, `Update on your application — ${d.bizName}`, wrap('Application update', `<p>Hi ${esc(d.fullName)}, your application for <b>${esc(d.bizName)}</b> was not approved.</p>${d.reason ? `<p><b>Reason:</b> ${esc(d.reason)}</p>` : ''}<p>Questions? Contact ${esc(OWNER)}.</p>`)],
  elite_granted: (d) => [d.email, `Fixia Elite — ${d.bizName}`, wrap('You are now Fixia Elite', `<p>${esc(d.bizName)} has been granted Elite status: pinned first on the home screen and in search. Expires: ${esc(d.expiresAt || 'never')}.</p>`, ['Open profile', '/profile'])],
  elite_revoked: (d) => [d.email, `Fixia Elite update — ${d.bizName}`, wrap('Elite status ended', `<p>Your Elite status for ${esc(d.bizName)} has ended. Your listing stays active under your plan.</p>`)],
  rating_notify: (d) => [d.email, `New ${d.stars}-star rating — ${d.bizName}`, wrap(`New rating: ${d.stars}/5`, `${rows({ Stars: `${d.stars}/5`, Comment: d.comment || '(no comment)', 'New average': d.newAvg })}`, ['Open profile', '/profile'])],
  reset_password: (d) => [d.email, 'Reset your Fixia password', wrap('Reset your password', `<p>Hi ${esc(d.fullName)}, use the button below within 1 hour. If you did not ask for this, ignore this email.</p><p style="word-break:break-all;font-size:12px">${APP()}/reset-password?token=${esc(d.token)}</p>`, ['Reset password', `/reset-password?token=${d.token}`])],
  account_suspended: (d) => [d.email, 'Account suspended', wrap('Account suspended', `<p>Hi ${esc(d.fullName)}, your account was suspended.</p>${d.reason ? `<p><b>Reason:</b> ${esc(d.reason)}</p>` : ''}<p>To appeal, contact ${esc(OWNER)}.</p>`)],
  expiry: (d) => [d.email, `Your Fixia plan ends in ${d.daysLeft} days`, wrap(`${d.daysLeft} days left`, `<p>Hi ${esc(d.fullName)}, your plan ends soon.${d.provider ? ' Providers are hidden from search after expiry.' : ''} Renew to keep your benefits.</p>`, ['Renew plan', '/profile?tab=plan'])],
  expired: (d) => [d.email, 'Your Fixia plan has ended', wrap('Plan ended', `<p>Hi ${esc(d.fullName)}, your plan has ended.${d.provider ? ' Your profile is hidden. You have 7 days before suspension.' : ' You are back on the Free plan.'}</p>`, ['Renew plan', '/profile?tab=plan'])],
  reactivate: (d) => [d.email, 'Come back to Fixia', wrap('We saved your spot', `<p>Hi ${esc(d.fullName)}, renew your plan to get your benefits back.</p>`, ['Renew plan', '/profile?tab=plan'])],
  suspended: (d) => [d.email, 'Account suspended (plan expired)', wrap('Account suspended', `<p>Your provider account was suspended after the grace period. Renew your plan or contact ${esc(OWNER)}.</p>`)],
};

T.email_change_code = (d) => [d.email, `${d.code} is your Fixia email change code`, wrap('Confirm your new email', `<p>A change of email was requested for <b>${esc(d.bizName)}</b> on Fixia. Your code is:</p><p style="font:700 30px monospace;letter-spacing:5px;margin:8px 0;color:#12161C">${esc(d.code)}</p><p>Enter it in the Fixia app under Profile &gt; Edit. If you were not expecting this, ignore this email.</p>`)];

// Never throws: mail trouble must not break sign-up or payments.
export async function mail(type, data) {
  try {
    const [to, subject, html] = T[type](data);
    await transport().sendMail({ from: `"Fixia" <${OWNER}>`, to, subject, html });
    return true;
  } catch (e) { console.error(`[mail:${type}]`, e.message); return false; }
}
export const ownerEmail = OWNER;
