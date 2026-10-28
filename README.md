# Lights Job Estimator

A one-page tool for a Christmas light installation business: look up a job address, enter how many feet go where, pick the exact light, and send a rounded-up order to your supplier.

## Use it

Open `index.html` in a browser, or turn on GitHub Pages (Settings → Pages → Deploy from branch → `main` / root) to get a link you can open on your phone.

1. **Address** – type it and tap *Look up on satellite map*. In Google Maps, switch to Satellite, right-click (or press and hold) the roof edge and choose *Measure distance*.
2. **Measurements & lights** – one row per spot: where, length (feet, or square feet for net lights), and the light type + color.
3. **Order** – the list is rounded up to full boxes, spools and bags. Choose a supplier, then *Email order* or *Copy order*.
4. **Customer quote** – prices each spot from your rates, adds the two-story charge if checked, and applies your minimum job price. *Email quote to customer* or *Copy quote*. The "Only you see this" box shows what you take home after the lights, crew pay, payroll taxes, workers' comp, and gas/insurance/gear.

Set your prices, business name and suppliers under **Prices & suppliers**.

## Crew and take-home

Set under **Prices & suppliers → My crew**: workers per job (default 2), pay per worker ($34/hr), payroll taxes (20%), workers' comp (13%), and gas/insurance/gear per job ($75).

Each quote estimates install hours at about 25 ft per worker per hour (plus ~12 crew-minutes per net light, +25% for two-story), with take-down at about half the install time. Type your own hours on any job to override the estimate.

## Starting prices

These are starting points for a new installer (lights + install + take-down included). Check what local companies charge and adjust.

| Item | Default |
|---|---|
| C9 bulbs | $9 / ft |
| C7 bulbs | $8 / ft |
| Mini lights | $6 / ft |
| Net lights | $3 / sq ft |
| Rope light | $8 / ft |
| Two-story / steep roof | +25% |
| Minimum job | $500 |

Light costs used for the profit estimate (box of 25 C9/C7 bulbs $20, 1,000 ft wire $220, 100 clips $12, 10 zip plugs $8, mini string $10, net $22, 150 ft rope $110) are rough wholesale guesses; they live in `needs()` in `index.html`.

## Estimating rules

| Light | Rule |
|---|---|
| C9 / C7 bulbs | 1 bulb per foot (12" spacing) + 1; wire = feet × 1.05 + 3 ft lead; 1 clip per bulb; 1 male + 1 female zip plug per run |
| Mini lights | 1 × 70-ct (24 ft) string per 23 ft |
| Net lights | 1 × 4'×6' net per 24 sq ft |
| Rope light | feet × 1.05, sold in 150 ft spools |

These live in the `needs()` function in `index.html` if you want to change them.

## Data

Jobs, prices and suppliers are saved in your browser (localStorage) on the device you use. Clearing browser data removes them.
