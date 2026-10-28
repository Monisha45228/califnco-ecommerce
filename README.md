# Califnco Water Technologies

Califnco is a web storefront and admin portal backed by Firebase Authentication and Cloud Firestore. Cloudinary stores product and social-post images; scheduled automations publish product content to Instagram and WhatsApp Status through a local WAHA Docker session. Local emulator mode supports development without a production Firebase project.

## Project layout

- `mobile-app/` — customer/dealer storefront, authentication, address entry, cart, and order tracking.
- `admin-panel/` — protected admin dashboard for users, products, orders, services, and social posts.
- `functions/` — trusted server-side order, payment, and notification operations.
- `ai-automation/` — daily Firestore product selection, Gemini content generation, Cloudinary image upload, Instagram publishing, and WAHA WhatsApp Status publishing.
- `.github/workflows/` — scheduled post-generation and admin-queue workflows.
- `shared/` — application types and the optional starter catalog, imported only when explicitly requested by an administrator.

Production integrations require provider credentials and setup described below. Local emulators are for development and do not publish to Instagram, process real payments, or deliver external email/SMS.

---

## Quick Start — Local Emulator (No Cloud Project Required)

Requirements: Windows PowerShell, Node.js 20.19+ (Node 22 LTS recommended for the deployed Functions runtime), npm, and Java 21+ for the Firebase Emulator Suite. On Windows, install the JDK with `winget install --id EclipseAdoptium.Temurin.21.JDK`. The first emulator launch downloads Firebase emulator binaries and needs an internet connection.

1. From the repository root, run:
   ```powershell
   npm run setup
   ```
   It creates each app's ignored `.env.local` from its example (emulator mode is enabled by default) and installs locked dependencies.
2. Launch Firebase emulators and both web apps:
   ```powershell
   npm run dev
   ```
   The launcher waits until Auth, Firestore, and Functions are listening before it opens either app. If startup times out, inspect the emulator PowerShell window for a Java, port, or download error. Emulator UI: `http://localhost:4000`; customer app: `http://localhost:3001`; admin app: `http://localhost:3000`.
3. In a **separate PowerShell window**, seed one local admin. Use a unique local-only password; it is read without echo and is not saved to the project:
   ```powershell
   $env:FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099"
   $env:FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080"
   $env:GCLOUD_PROJECT = "demo-califnco"
   $env:ADMIN_EMAIL = "admin@califnco.local"
   $securePassword = Read-Host "Local emulator admin password" -AsSecureString
   $env:ADMIN_PASSWORD = (New-Object System.Net.NetworkCredential("", $securePassword)).Password
   npm run seed:emulator-admin
   Remove-Item Env:ADMIN_PASSWORD
   ```
4. Sign into the admin portal with that local email and password. In **Product Catalog**, choose **Import starter catalog** once when the collection is empty. Sign up for a customer account in the mobile app and test live catalog updates, orders, stock changes, posts, services, and notifications.

The launcher imports emulator data from the ignored local `emulator-data/` folder and exports the data there on a clean shutdown, so local Auth accounts and Firestore profiles survive normal emulator restarts. Forced process termination may prevent the final export. This local data folder can contain personal/test data; keep it private and out of source control. This is a development/test environment—not production.
The emulator project ID is always `demo-califnco`, even if `VITE_FIREBASE_PROJECT_ID` in your real-project config contains a different ID. Do not change the emulator project ID unless you also change it in the emulator scripts, seed command, and app emulator configurations.

### Connect a real Firebase project

1. Create a Firebase project and Web App. Enable **Authentication → Sign-in method → Email/Password** and create the Firestore database. Firebase Storage is not used.
2. Copy the Web App values from **Project settings → General → Your apps** into both `mobile-app/.env.local` and `admin-panel/.env.local`. Fill `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, and `VITE_FIREBASE_APP_ID` with the same project values. Set `VITE_USE_FIREBASE_EMULATORS=false` in **both** files. Set the mobile `VITE_ADMIN_PANEL_URL` to the admin portal origin (it defaults to `http://localhost:3000` for development).
3. Add `localhost` and each production app domain to **Authentication → Settings → Authorized domains**. For web push, create a Web Push certificate under **Project settings → Cloud Messaging** and set `VITE_FIREBASE_VAPID_KEY` in the mobile env file.
4. Sign in to Firebase CLI and select the project from the repository root:
   ```powershell
   npx firebase login
   npx firebase use --add
   ```
5. Deploy Firestore rules/indexes without enabling billing:
   ```powershell
   npm run deploy:firestore
   ```
   Cloud Functions for order/payment/notification operations are separate and typically require Blaze. Deploy them only if you choose to enable billing:
   ```powershell
   npm run deploy:firebase
   ```
   Functions use Firebase-provided Admin SDK credentials; never put service-account keys in the front end or this repository.
6. Create the sole production admin account once in Firebase Console:
   - In **Authentication → Users**, add one account with the administrator's email and a unique, secure password. Do not put the password in this repository.
   - Copy that account's UID. In **Firestore → Data**, create `users/{uid}` with the following fields. Set `createdAt` to a Firestore timestamp and enter the same email as the Auth account.
     ```json
     {
       "name": "Administrator",
       "email": "admin@example.com",
       "phone": "",
       "role": "admin",
       "address": { "street": "", "city": "", "state": "", "postalCode": "" },
       "createdAt": "<Firestore timestamp>",
       "fcmToken": null
     }
     ```
   - This is the only production admin seed. `npm run seed:emulator-admin` is strictly for the local emulator; it refuses non-local Auth/Firestore hosts. Create other user accounts from the app; never add an admin role through public sign-up.

The mobile sign-up form creates customer or dealer accounts and writes `users/{uid}`. A user's Firestore role is checked on app entry; customer/dealer accounts cannot enter the admin portal, and admins are sent to that portal. Password reset is handled by Firebase Auth. Role promotion should only be done by a trusted administrator in Firebase Console.

### Firestore live-data behavior

- Products, customer orders, service bookings, notifications, posts, and admin user/order lists are subscribed to with Firestore realtime listeners. Products are no longer sourced from a client-side sample list. The admin **Import starter catalog** button only appears when the live products collection is empty and refuses to overwrite an existing catalog. Admins can create and edit customer-visible marketing posts in the Posts tab.
- Admin product editing supports existing Firestore catalog records, image URLs, Cloudinary uploads (image files up to 10 MB), image preview, pricing, stock, category, caption, hashtags, featured state, ratings, reviews, and editable key/value specifications. Product edits are saved to Firestore and stream to the storefront; legacy `imageUrl` fields are also recognized. Social posts can upload images to Cloudinary.
- The product-image audit uses Gemini vision to compare every Firestore product image to its name, description, and category. It defaults to a read-only report; `--apply` records audit results and replaces only mismatched images whose newly generated replacement passes a second visual check.
- Order creation runs through the authenticated `createOrder` callable, which validates the user, ten-digit phone, address, live product prices/stock, and dealer minimums. Razorpay test orders are created server-side; the checkout response is mapped to the server's expected fields, verified by HMAC, and confirmed as captured with Razorpay before Firestore marks the order `paid`. The customer sees a test-payment confirmation only after this server verification succeeds. Unpaid Razorpay reservations are released on cancellation only after checking for an active payment.
- Admin order status changes create Firestore notifications and send push notifications where a user has enabled FCM. Configured Brevo SMTP and optional SMS gateway notifications are attempted on order creation and status changes. Provider failures are recorded and do not roll back orders.
- Firestore rules restrict catalog, post, and account administration to the seeded admin; customers/dealers read only their own orders, services, and notifications. The Instagram approval setting is admin-only. Cloudinary uses an unsigned preset; restrict it because anyone who learns the preset name can upload within its limits.
- Existing production catalog images cannot be audited from this checkout because it has no Firebase project credentials. Review each live product image in the admin catalog before publishing; the starter catalog import does not modify an existing database.

### Cloudinary image storage

1. Create a Cloudinary account and an **unsigned image upload preset** in Upload settings. Restrict allowed formats to images (JPG, PNG, WebP), set the maximum file size to 10 MB, disable overwrite, and set a fixed `califnco` folder if available. Do not expose a Cloudinary API secret in the browser.
2. Set `VITE_CLOUDINARY_CLOUD_NAME` and `VITE_CLOUDINARY_UPLOAD_PRESET` in `admin-panel/.env.local` (and the admin host's environment for production). Product/post uploads return Cloudinary `secure_url` values saved in Firestore.
3. Set `CLOUDINARY_CLOUD_NAME` and `CLOUDINARY_UPLOAD_PRESET` in `ai-automation/.env` or GitHub Actions **Variables** for Instagram publishing. No Firebase Storage bucket or Storage credentials are needed.

Unsigned presets are public by design; anyone who learns the preset name can upload within its allowed limits. Use narrow preset restrictions and monitor Cloudinary usage. Its free plan quotas may change.

### Audit Firestore product images

Set `GEMINI_API_KEY`, `CLOUDINARY_CLOUD_NAME`, and `CLOUDINARY_UPLOAD_PRESET` in `ai-automation/.env`. For a production Firestore database, also set `FIREBASE_SERVICE_ACCOUNT_JSON` with Firestore read/write access. Install the Python requirements once, then run from the project root:

```powershell
python -m pip install -r ai-automation/requirements.txt
python ai-automation/audit_product_images.py
```

For the local Firestore emulator, start the emulator and set `$env:FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080"` and `$env:GCLOUD_PROJECT = "demo-califnco"` in the same PowerShell session before running the command; a service account is not needed. Unavailable or invalid image URLs are reported as mismatches. The default run asks Gemini vision whether each reachable image matches the Firestore product and prints one JSON report per item without changing the database. Review the report, then run with `--apply` to save match audit metadata and replace mismatched images. Replacement images are generated from the product's actual Firestore details, checked by Gemini, uploaded to Cloudinary, and written to the product's `image` and `imageUrl` fields only if the visual check passes. API quotas/Cloudinary usage may apply. No production image has been audited until this command successfully runs against the intended Firebase project.

### Daily WhatsApp Status using WAHA

This runs **locally on Windows** because the WAHA Docker session is linked to the secondary phone; GitHub-hosted cron runners cannot reach your local WAHA container or its linked WhatsApp session. WAHA is an unofficial WhatsApp Web integration, not the official WhatsApp Business API. Use a secondary number, follow WhatsApp's terms, and understand that unofficial automation can risk account restrictions. A Status is visible to the number's eligible WhatsApp contacts according to its privacy settings.

1. Install and start Docker Desktop. The WAHA container exposes its API only on `127.0.0.1:3008` and persists the linked session in a Docker volume.
2. Edit the existing ignored `ai-automation/.env`; it was created locally with the Cloudinary cloud name/upload preset from the admin environment and random WAHA API/dashboard credentials. Do not replace or share it. Add a Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey). Keep the existing `FIRESTORE_EMULATOR_HOST` and `GCLOUD_PROJECT` values only while using the local emulator. For production Firestore, remove the emulator settings and set `FIREBASE_SERVICE_ACCOUNT_JSON` with Firestore read/write permissions.
3. Install the Python dependencies once from the project root with `python -m pip install -r ai-automation/requirements.txt`. Start WAHA using `npm run whatsapp:waha` and open `http://127.0.0.1:3008/dashboard`. Sign into the dashboard using the credentials in the private `.env` and configure its API key with the `WAHA_API_KEY` from that file; create/start the `default` session and scan its QR code from **WhatsApp on the secondary phone → Linked devices**. Keep Docker Desktop running after linking.
4. Start the Firebase emulator if using emulator mode, then publish a one-time manual status with `npm run whatsapp:daily`. The automation selects a Firestore product not used in recent WhatsApp statuses, generates its caption with Gemini (or uses the truthful product-data fallback), generates an image (or falls back to the product's image), uploads a public JPEG to Cloudinary, then publishes the image/caption through WAHA. It records `posted` or `failed` and any error under `posts/whatsapp-daily-YYYY-MM-DD`; an already-posted daily record is skipped on retry.
5. Once the secondary session and manual post work, install a daily Windows Task Scheduler task at 09:00 local time using `npm run whatsapp:schedule`. Change the time with `npm run whatsapp:schedule -- -Time 10:30`. The computer, Docker Desktop, and the signed-in Windows user must be available at the scheduled time. If using the Firestore emulator, that emulator must also be running; for unattended production runs, configure the real-project service account instead. To remove the scheduled task, run `Unregister-ScheduledTask -TaskName 'Califnco WhatsApp Daily Status' -Confirm:$false`.

WAHA starts only after both WAHA secrets are present. If the Gemini key is blank, the workflow records a warning and uses a factual product-data caption; an unavailable or rejected Gemini request is recorded as a failure. Docker, the WhatsApp session, Cloudinary, or Firestore failures also fail the run instead of claiming success. The status record is visible in **Admin → Marketing Posts → WhatsApp Status history**. Do not place WAHA keys, Gemini keys, Firebase service-account JSON, or Cloudinary API secrets in source control or chat.

### Payments, email, SMS, and address setup

1. **Razorpay test mode:** get a test Key ID and Key Secret from the Razorpay Dashboard. Set `RAZORPAY_KEY_ID=rzp_test_...` in `functions/.env` and `RAZORPAY_KEY_SECRET=...` in the ignored `functions/.secret.local` file. The emulator must be restarted after changing these values. The backend rejects non-test key IDs and does not display a successful order/payment until Razorpay reports the payment as captured and the server verifies the signature. Use Razorpay's current test checkout payment details; test mode does not charge real money. Without both test credentials, the app reports that Razorpay test credentials are not configured and you can still place COD orders.
2. **Transactional email:** Brevo SMTP is the configured adapter. Verify a sender in Brevo, put the non-secret host/port/user/from values in `functions/.env`, and set `SMTP_PASSWORD` with Firebase Secret Manager (or `functions/.secret.local` for emulator use). Functions sends confirmation and status messages. If configuration is absent, email is skipped; delivery failures are visible in `orders/{orderId}.notificationErrors` and in the notification record. Deploying Cloud Functions typically requires Firebase Blaze.
3. **SMS:** the Functions adapter is optional and sends a bearer-authenticated JSON POST with `{ "to", "from", "message" }` to `SMS_PROVIDER_URL`; configure `SMS_FROM` and the `SMS_PROVIDER_TOKEN` secret only for a provider that accepts that contract. It does not simulate delivery. There is no dependable, ongoing zero-cost transactional SMS service for Indian production numbers; providers generally require paid credits, sender registration, and DLT compliance. Until a compatible provider is configured, the app's zero-cost alternative is Firestore notifications and FCM push (not SMS). Confirm provider support and India-specific sender/DLT requirements before enabling SMS.
4. **Address/map:** the storefront uses Leaflet with OpenStreetMap tiles and Nominatim reverse geocoding. Users can edit the returned fields manually if geocoding/location permission is unavailable. Nominatim is a community service with usage limits, not a guaranteed commercial SLA; follow its usage policy for production traffic.

### Daily Instagram automation

The scheduled service is **GitHub Actions**, not a process that must stay running on a local computer. `.github/workflows/instagram-daily.yml` runs daily at 09:00 India time (03:30 UTC). `.github/workflows/instagram-admin-queue.yml` checks admin post-now, regeneration, and scheduled-post requests every five minutes. Enable Actions and keep these workflows on the repository's default branch. GitHub schedule events may be delayed, and this automation has not been live-tested without provider credentials.

Install Python dependencies for a local/manual run with `python -m pip install -r ai-automation/requirements.txt`. Copy `ai-automation/.env.example` to `ai-automation/.env` for local use, or configure GitHub repository **Settings → Secrets and variables → Actions**:

Required Actions secrets:
- `FIREBASE_SERVICE_ACCOUNT_JSON` — service-account JSON with Firestore read/write permissions.
- `INSTAGRAM_ACCOUNT_ID` — numeric Instagram Professional account ID.
- `INSTAGRAM_ACCESS_TOKEN` — valid publishing token; keep it secret and refresh/rotate it before expiry.

Required Actions variables:
- `CLOUDINARY_CLOUD_NAME` — Cloudinary cloud name.
- `CLOUDINARY_UPLOAD_PRESET` — restricted unsigned image upload preset.

Optional Actions variables/secrets:
- `GEMINI_API_KEY` — Google AI Studio API key. The default model is `gemini-3.1-flash-lite`; if absent, the script uses its factual product-data caption fallback.
- `AUTO_APPROVE_INSTAGRAM_POSTS` — `true` to use as the initial default, otherwise `false`. The live admin toggle at `automationSettings/instagram.autoApprove` takes precedence.
- `INSTAGRAM_GRAPH_API_VERSION` — set a currently supported Meta Graph API version when upgrading.

The account must be an Instagram **Business or Creator** account linked to a Facebook Page, and the Meta developer app/user token must have the publishing permissions for the chosen Facebook Login flow (including `instagram_basic`, `instagram_content_publish`, and the required Page permissions). Complete any app review/Page Publishing Authorization that Meta requires. Use a long-lived token, monitor expiry, and never put the token in frontend variables or source control.

The daily job selects a Firestore product not posted in the recent-post window, uses its actual name/description/retail price for Gemini's caption (or a product-based fallback), requests a square image from Pollinations with the product details, and uploads the image to Cloudinary for Meta to fetch. If image generation is unavailable, it uses the product's existing image. Before upload, images are normalized to square JPEGs for Instagram's publishing API. With auto-approval off, it saves a `draft`; an admin can edit the caption/hashtags/image and use **Post now** or schedule it. The queue updates `posts/{postId}` with status and error details. A missing/invalid provider credential or API rejection records a failed post rather than claiming it was published. Pollinations and Gemini free-tier services can change availability/limits.

For a local manual run, run `python ai-automation/instagram_daily_poster.py` to generate the daily record or `python ai-automation/instagram_daily_poster.py --process-queue` to process queued admin actions/scheduled posts. Configure Firebase, Cloudinary, and Meta; Gemini is optional for fallback captions. Do not run a live publishing test unless you intend to publish to the connected account.

### Launch and verify

From the root project directory:
```powershell
npm run setup
npm run dev
```
`npm run dev` opens both apps and starts the emulators when both env files have `VITE_USE_FIREBASE_EMULATORS=true`. If using real Firebase, keep that flag `false` in both files; the launcher will open just the apps.

Run `npm run typecheck`, `npm run build`, and `npm audit --prefix mobile-app`, `npm audit --prefix admin-panel`, `npm audit --prefix functions` from the root to verify types, production builds, and dependencies.

For the emulator manually: run `npm run dev:emulators` in one terminal and wait until all emulators report ready before starting `npm run dev:mobile` or `npm run dev:admin` in separate terminals. When the app reports that it cannot reach `127.0.0.1:9099`, the Firebase Auth emulator is stopped or still starting; the recommended `npm run dev` launcher starts the emulators and waits for readiness. `npm run seed:emulator-admin` requires the local emulator host and admin environment variables shown above.

### Production integrations and limitations

- The app works locally with the Firebase Emulator Suite without project credentials. Real authentication and persisted Firestore require your Firebase project. Cloudinary is used for product/post images instead of Firebase Storage.
- Without enabling Blaze, deploy Firestore rules/indexes with `npm run deploy:firestore`. Production order creation, server-side Razorpay verification, transactional email, SMS, and push notification functions are not hosted by the local emulator and need a serverless-functions host; the included Firebase Functions deployment typically requires Blaze.
- Browser push is not available in Firebase emulators; the customer notification records are created after a status change, and actual FCM delivery needs a deployed function and a customer device/browser push token.
- Razorpay test payments, Meta posting, Gemini generation, Brevo email, and any external SMS gateway need the respective project credentials; a successful local build is not proof of live provider delivery.
- Production user data and product images are not included or audited by local setup. The starter catalog should be reviewed and product images verified before production use.

### End-to-end test checklist

- [ ] Start the emulators and both apps with `npm run dev`; confirm Auth, Firestore, and Functions report ready.
- [ ] Sign up a customer with valid email/password and a 10-digit phone; verify Auth creates the account and Firestore creates `users/{uid}` with role `customer`. Confirm shorter/longer phone numbers are rejected.
- [ ] Sign up a dealer and verify dealer-only pricing/pages; try opening the admin portal as customer/dealer and confirm access is denied. Sign in as the seeded admin and confirm it routes to the admin portal. Test Logout and Forgot Password.
- [ ] Configure the Cloudinary unsigned preset in the admin environment. In admin, import starter products only into an empty emulator catalog. Edit an existing product's image, description, specifications, caption, price, and stock; verify the customer storefront updates without refresh.
- [ ] Place an order using Razorpay **test** credentials (or select COD). Confirm the server-created order appears immediately in the admin Orders Desk, has the expected user/items/total/address/status/payment fields, and the customer's My Orders updates live when admin changes status.
- [ ] Configure a Brevo test sender and trigger an order/status email. If testing SMS, configure a compatible gateway and a test/authorized recipient; otherwise verify Firestore/FCM notification behavior and expect no SMS delivery.
- [ ] Open notifications, click **Mark all as read**, and verify unread indicators clear; if Firestore rejects the updates, check that the modal shows a helpful error.
- [ ] Configure GitHub Actions secrets, Cloudinary variables, Meta professional account/Page/app/token, and Firebase service account; Gemini is optional. Run the `instagram-daily.yml` workflow manually with auto-approval disabled; confirm a draft is saved and visible in Social Posts. Edit it, then test **Post now** only when publishing publicly is intended. With auto-approval enabled, confirm a successful run creates a posted record. Verify failures are recorded in Firestore with an error.
- [ ] Configure the private WAHA/Gemini settings, link a secondary WhatsApp number, and run `npm run whatsapp:daily` once before installing the 09:00 local Windows task.
- [ ] Verify address entry with manual edits and, where available, browser location/reverse geocoding. Confirm the final address is saved to the order.
- [ ] Run the typecheck, production builds, and dependency audits described above before deployment.

### Option 2: Launch Apps Individually

Start the Firebase emulators from the repository root and leave that terminal running:
```bash
npm run dev:emulators
```
Wait for the terminal to say **All emulators ready**, then start an app in a separate terminal.

#### 1. Mobile Application (Port 3001)
```bash
cd mobile-app
npm run dev
```
Open **[http://localhost:3001](http://localhost:3001)** in your browser.  
- Sign up or log in as a customer or dealer; the account role controls pricing and app access.
- Toggle **Dark / Light Mode** using the sun/moon button.
- Tap any product to view specs or tap the zoom eye icon for the **Image Lightbox**.
- Open the Cart, save a complete delivery address, and use the configured **Razorpay test checkout** or cash-on-delivery flow. Razorpay orders become paid only after server-side signature and captured-payment verification.
- Switch to the **Profile** tab to view your **Referral Code** and rewards balance.

#### 2. Operations Admin Portal (Port 3000 — Vercel Deployable)
```bash
cd admin-panel
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.  
- Log in with the single admin account created in Firebase Console.
- **Orders Desk:** Inspect live orders from the mobile app and update fulfillment status (*Placed* → *Confirmed* → *Shipped* → *Delivered*, or *Cancelled*).
- **Dealer Approvals:** Approve or reject wholesale applications.
- **Service Desk:** Assign certified field technicians to installation/AMC tickets.
- **Product Catalog:** Create and edit Firestore products, inventory, retail/wholesale pricing, image, caption, and hashtags.

#### 3. Daily Instagram automation
```bash
python ai-automation/instagram_daily_poster.py
```
- Configure GitHub Actions secrets and Meta/Gemini/Firebase as described in **Daily Instagram automation** above. The GitHub cron performs the daily run; this command is for a local manual run with `ai-automation/.env` configured.
- The automation writes status and errors to Firestore `posts`; it does not use a local JSON log.

---

## Deploying the Admin Panel to Vercel

1. Push this repository to GitHub or GitLab.
2. Go to **[vercel.com](https://vercel.com)** $\rightarrow$ **Add New Project**.
3. Set the **Root Directory** to `admin-panel`.
4. The included `admin-panel/vercel.json` automatically configures Vite build output and SPA routing rewrites.
5. Add the production Firebase web-app values plus `VITE_CLOUDINARY_CLOUD_NAME` and `VITE_CLOUDINARY_UPLOAD_PRESET` as Vercel environment variables, then deploy. Availability, build time, and hosting costs depend on your Vercel plan and configuration.
