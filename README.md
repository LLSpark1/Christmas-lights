# Lights Job Estimator

Software for Christmas light installation companies: look up a job address, enter how many feet go where, pick the exact light, send a rounded-up order to your supplier, and email the customer a quote that shows what you take home after crew pay.

Each company signs up with its own login and sees only its own jobs, prices and suppliers.

## How it's built

| Part | What it does |
|---|---|
| `index.html`, `js/app.js` | The app. Plain HTML and JavaScript, no build step. |
| `js/store.js` | Saves and loads data: Supabase when connected, otherwise this browser (demo mode). |
| `config.js` | Your Supabase project address and public key. Empty = demo mode. |
| `supabase/schema.sql` | Database tables plus the rules that keep each company's data private. |

Hosting is free on GitHub Pages; logins and data are free on Supabase's starter plan.

## Try it (demo mode)

Open `index.html` in a browser. With `config.js` empty there's no login, and jobs are saved only in that browser.

## Turn on logins (one-time setup, about 15 minutes)

1. **Create the database.** Sign up at [supabase.com](https://supabase.com) and create a new project. Save the database password it shows you.
2. **Load the tables and privacy rules.** In the project, open **SQL Editor → New query**, paste everything from `supabase/schema.sql`, and press **Run**. It should finish with "Success. No rows returned".
3. **Tell Supabase where the app lives.** Go to **Authentication → URL Configuration**. Set **Site URL** to your app's address (for GitHub Pages: `https://llspark1.github.io/christmas-lights/`) and add the same address under **Redirect URLs**. Confirmation and password-reset emails link back here.
4. **Connect the app.** Go to **Project Settings → API**. Copy the **Project URL** and the **anon public** key into `config.js`, then commit and push. The anon key is meant to be public; the rules from step 2 are what protect each company's data. Never put the `service_role` key in this repo.
5. **Publish the app.** In this GitHub repo, go to **Settings → Pages**, choose **Deploy from a branch**, then `main` and `/ (root)`. A minute later the app is live at the address from step 3.

### Before real customers sign up

- **Email sending:** Supabase's built-in email service only sends a few emails an hour, which is fine for testing. For customers, connect your own email service under **Authentication → Emails → SMTP Settings** (for example Resend, Postmark or SendGrid).
- **Email confirmation** is on by default: new accounts must click a link before they can sign in. Leave it on.

## How sign-up works

1. A new customer opens the app, taps **Create an account**, and enters an email and password.
2. They confirm their email, sign in, and name their company. That account becomes the company **owner**.
3. The owner's jobs, prices, crew pay and suppliers are private to that company.

Not built yet: inviting crew members to an existing company, company logos on quotes, and taking payment (Stripe).

## Using the app

1. **Address** – type it and tap *Look up on satellite map*. In Google Maps, switch to Satellite, right-click (or press and hold) the roof edge and choose *Measure distance*.
2. **Measurements & lights** – one row per spot: where, length (feet, or square feet for net lights, e.g. `20 x 30`), and the light type + color.
3. **Order** – rounded up to full boxes, spools and bags. Choose a supplier, then *Email order* or *Copy order*.
4. **Customer quote** – prices each spot from your rates, adds the two-story charge if checked, and applies your minimum job price. The "Only you see this" box shows what you take home after the lights, crew pay, payroll taxes, workers' comp, and gas/insurance/gear.

Set prices, crew pay, business name and suppliers under **Prices & suppliers**.

## Estimating rules

| Light | Rule |
|---|---|
| C9 / C7 bulbs | 1 bulb per foot (12" spacing) + 1; wire = feet × 1.05 + 3 ft lead; 1 clip per bulb; 1 male + 1 female zip plug per run |
| Mini lights | 1 × 70-ct (24 ft) string per 23 ft |
| Net lights | 1 × 4'×6' net per 24 sq ft |
| Rope light | feet × 1.05, sold in 150 ft spools |

These live in `needs()` in `js/app.js`.

## Crew and take-home

Defaults under **Prices & suppliers → My crew**: 2 workers per job, $34/hr, 20% payroll taxes, 13% workers' comp, and $75 per job for gas/insurance/gear.

Install hours are estimated at about 25 ft per worker per hour (plus ~12 crew-minutes per net light, +25% for two-story), with take-down at about half the install time. Type your own hours on any job to override the estimate.

## Starting prices

Starting points for a new installer (lights + install + take-down included). Check what local companies charge and adjust.

| Item | Default |
|---|---|
| C9 bulbs | $9 / ft |
| C7 bulbs | $8 / ft |
| Mini lights | $6 / ft |
| Net lights | $3 / sq ft |
| Rope light | $8 / ft |
| Two-story / steep roof | +25% |
| Minimum job | $500 |

Light costs used for the take-home estimate (box of 25 C9/C7 bulbs $20, 1,000 ft wire $220, 100 clips $12, 10 zip plugs $8, mini string $10, net $22, 150 ft rope $110) are rough wholesale guesses; they also live in `needs()`.
