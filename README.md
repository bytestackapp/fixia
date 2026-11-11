# Fixia 2.0

## Folder map
```
api/            Server functions (Vercel). Only place that talks to the database.
  _lib/         Shared server helpers (db.js, auth.js)
  auth.js       Sign in / who am I / sign out
sql/            One-time database scripts
src/
  styles/       tokens.css (colours, fonts, spacing), base.css, ui.css
  components/   Shell (navigation) and ui/ (Button, Field ...)
  pages/        One file per screen (+ its .css)
  lib/          api.js (server calls), auth.jsx (sign-in state)
public/         images/, manifest.json
```

## Run it
1. `npm install`
2. Vercel > Project > Environment Variables, add: `JWT_SECRET` (any 40+ random characters), plus your existing
   `SUPA_URL`, `SUPA_SERVICE_KEY`, `APP_URL`, `GMAIL_USER`, `GMAIL_PASS`, `PAYPAL_*`, `PAYMONGO_SECRET_KEY`, `VAPID_*`, `CRON_SECRET`.
3. Copy your existing `images/` folder into `public/images/` and `manifest.json` into `public/`.
4. Copy these old files, unchanged for now, into `api/`: `send-email.js`, `send-push.js`, `otp.js`, `payments.js`, `password-reset.js`, `subscription-cron.js`, `delete-storage-file.js`. They are rewritten in later phases.
5. Do NOT delete `api/db.js` from the old project until the new screens replace it. Do NOT run `sql/01-lockdown.sql` until cutover.
6. Deploy to a NEW Vercel project (so the live app keeps working while we build).
