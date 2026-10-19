# Fixia upgrade — how to apply

Copy everything in this folder into the project root (merge `public/`, replace `sw.js`, `vercel.json`, `manifest.json`, `package.json`, `git-push.bat`). Then:

```
node scripts/build-icons.js      # only if you add icons
node scripts/migrate-pages.js    # applies theme + icons + cache to all pages, makes keys come from env-config.js
npm install                      # creates package-lock.json (commit it — the workflow uses npm ci)
```
Edit `public/env-config.js` with the NEW Supabase URL + anon key.

Note: service-worker paths changed to `/images/...`, `/css/...` (your Vercel routes already map these to /public).

## What changed
- `css/fixia.css` – all colors, radius, shadows, fonts, layout are variables at the top. Change `--brand` etc. once → whole app changes. Loaded last, so it restyles existing classes without rewriting each page. Mobile: bottom bar. ≥900px: left side-rail, centred content, 2-col provider lists, centred dialogs.
- `css/icons.css` – SVG icons. Existing `<i class="fa-solid fa-house">` markup now renders inline SVG (no Font Awesome download, inherits color). Unknown icon → small dot; add it in `scripts/build-icons.js`.
- `js/fx-boot.js` – (1) prefixes `/api/` with your Vercel URL inside the APK, (2) stale-while-revalidate cache for packages, settings, ads, listings, ratings, provider lists (instant repeat loads, auto-cleared after any write/logout), (3) `FX.every()` polling that pauses in background (badge poll 10s → 30s), (4) memoised provider lookup. Also removed Google Fonts (system font = faster, works offline).
- `sw.js` – instant CSS/JS/images, network-first HTML with offline fallback. **Bump CACHE_VERSION each deploy.** iPhone stays PWA/SW.
- Emoji category tiles are unchanged; swap them for SVG later if you want.

## Vercel (new account)
Import the GitHub repo → no build command. Environment variables:
`SUPA_URL`, `SUPA_KEY` (anon), `SUPA_SERVICE_KEY`, `APP_URL` (your new domain), `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_ENV`, `PAYMONGO_SECRET_KEY`, `GMAIL_USER`, `GMAIL_PASS`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `CRON_SECRET` (Vercel then sends it to the cron automatically). Update `VERCEL_URL` in `server.js` for local dev. `/api` CORS is now `*` (auth is header-token based) so the APK origin works.

## Supabase: move old → new
1. New project, **same region/Postgres version**. Save both DB connection strings (Dashboard → Connect → Session pooler) and both `service_role` keys.
2. Install Supabase CLI. Dump the old DB:
```
supabase db dump --db-url "OLD_URL" -f schema.sql
supabase db dump --db-url "OLD_URL" -f data.sql --data-only --use-copy
```
(Fixia uses its own `users` table, not Supabase Auth, so the `public` schema is all you need. It includes tables, views, RLS policies and the functions `register_provider`, `increment_ad_impression`, `increment_ad_click`, `increment_featured_impression`.)
3. Restore into the new DB (needs `psql`): 
```
psql "NEW_URL" -f schema.sql
psql "NEW_URL" -c "SET session_replication_role = replica;" -f data.sql
```
4. Storage isn't in the dump. Copy files + create buckets (`fixia-avatars`, `fixia-ids`, `fixia-portfolio`, `fixia-requests`, all public like today):
```
set OLD_URL=… & set OLD_KEY=<old service_role> & set NEW_URL=… & set NEW_KEY=<new service_role>
node scripts/copy-storage.js
```
5. In the new SQL editor, point stored file URLs at the new project (replace OLDREF/NEWREF):
```sql
update users set avatar_url=replace(avatar_url,'OLDREF','NEWREF');
update providers set avatar_url=replace(avatar_url,'OLDREF','NEWREF'), id_file_url=replace(id_file_url,'OLDREF','NEWREF');
update change_requests set file_url=replace(file_url,'OLDREF','NEWREF');
update providers set portfolio_urls=array(select replace(u,'OLDREF','NEWREF') from unnest(portfolio_urls) u);
```
Then add Storage policies allowing anon `insert/select/delete` on those buckets (copy from old Dashboard → Storage → Policies).
6. Verify row counts match (`select count(*)` per table), test sign-up, login, booking, upload. Cut over: put the old site in maintenance, repeat steps 2–3 for a final sync, switch `env-config.js`/Vercel env, redeploy.
7. Your app writes to tables with the anon key, so RLS policies must stay as they are — do not tighten them until the writes are moved behind `/api/db`.

## APK (GitHub Actions)
One time, locally: `npm install`, `mkdir www`, `npx cap add android`, commit the `android/` folder. Create a key: `keytool -genkey -v -keystore fixia.keystore -alias fixia -keyalg RSA -keysize 2048 -validity 10000`, then `base64 -w0 fixia.keystore` (PowerShell: `[Convert]::ToBase64String([IO.File]::ReadAllBytes("fixia.keystore"))`). Keep the keystore safe — losing it means you can't update the app.
In `android/app/build.gradle` inside `android { }` add:
```
signingConfigs { release { storeFile file('fixia.keystore'); storePassword System.getenv('FIXIA_KEYSTORE_PASSWORD'); keyAlias 'fixia'; keyPassword System.getenv('FIXIA_KEYSTORE_PASSWORD') } }
buildTypes { release { signingConfig signingConfigs.release; minifyEnabled false } }
applicationVariants.all { variant -> variant.outputs.all { outputFileName = 'fixia.apk' } }
```
(merge into the existing buildTypes block). GitHub repo → Settings → Secrets: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `API_BASE` (https://your-app.vercel.app, no trailing slash), `FIXIA_KEYSTORE_B64`, `FIXIA_KEYSTORE_PASSWORD`. Actions → Build Android APK → Run workflow → download `fixia` artifact. Add `android/app/fixia.keystore`, `www/` to `.gitignore`.
Not in the APK: web-push (WebView doesn't support it — use `@capacitor/push-notifications` + Firebase later), admin page.

## Bugs I found in your code (fix before launch)
1. `api/create-paypal-checkout.js`: `const isUpgrade = ...` is written inside the `application_context` object → syntax error, the function won't deploy. Move that line above `JSON.stringify({`, i.e. just after `const totalPrice…`.
2. `profile.html` upgrade checkout reads `d.url`, but both checkout APIs return `approvalUrl` / `checkoutUrl` → use `const url = d.approvalUrl || d.checkoutUrl`. It also never sends `package`'s `processingFee`, and paymongo's success_url lacks the upgrade params.
3. Signup pages store the pending signup in `localStorage` but `payment-success.html` reads `sessionStorage` → every instant payment ends in "Session expired". Change those reads/removes to `localStorage`.
4. In the APK, PayPal/PayMongo return to your website, not the app; test that flow, or open it with `@capacitor/browser`.
5. `fixia-data.js` `APP_URL = window.location.origin` is `https://localhost` in the APK — referral links built in `profile.html` should use your real domain.
6. Run `node scripts/apply-bugfixes.js` (fixes #2 and #3) and replace `api/create-paypal-checkout.js` with the fixed file in this package (fixes #1).
