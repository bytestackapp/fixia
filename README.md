# Fixia 2.0

```
api/                 Server (Vercel functions). The ONLY code that talks to the database.
  auth.js            Sign in/out, sign-up, email codes, password reset (works without login)
  app.js             Every signed-in action (one line per action)
  admin.js           Every admin action (admin accounts only)
  cron.js            Daily job: reminders, expiry, suspensions
  _lib/              Helpers: db, auth, http, mail, push, storage, packages, referral, settings
  _lib/actions/      The actual logic, one file per area
src/
  styles/            tokens.css (colours/fonts/spacing), base.css, ui.css
  components/        Shell (navigation), ui/ (Button, Field, Dialog, Kit), shared pieces
  pages/             One file per screen · profile/ · admin/
  lib/               api.js, auth, queries, ads, push, psgc, categories, format, image
public/              images/, manifest.json, sw.js (push notifications)
sql/01-lockdown.sql  Run ONCE at cutover
.github/workflows/   Android APK build
```

## Vercel environment variables
SUPA_URL, SUPA_SERVICE_KEY, APP_URL, JWT_SECRET (new), CRON_SECRET (new), GMAIL_USER, GMAIL_PASS,
PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_ENV, PAYMONGO_SECRET_KEY, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY.
(SUPA_KEY is no longer used.)

## Delete these old files from api/
send-email.js, send-push.js, otp.js, payments.js, password-reset.js, subscription-cron.js, delete-storage-file.js, db.js
(their work now lives in api/_lib and api/auth.js / app.js / cron.js)

## Android (GitHub secrets)
API_BASE (your Vercel address), FIXIA_KEYSTORE_B64, FIXIA_KEYSTORE_PASSWORD.
