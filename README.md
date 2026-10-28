# Lights Job Estimator

A one-page tool for a Christmas light installation business: look up a job address, enter how many feet go where, pick the exact light, and send a rounded-up order to your supplier.

## Use it

Open `index.html` in a browser, or turn on GitHub Pages (Settings → Pages → Deploy from branch → `main` / root) to get a link you can open on your phone.

1. **Address** – type it and tap *Look up on satellite map*. In Google Maps, switch to Satellite, right-click (or press and hold) the roof edge and choose *Measure distance*.
2. **Measurements & lights** – one row per spot: where, length (feet, or square feet for net lights), and the light type + color.
3. **Order** – the list is rounded up to full boxes, spools and bags. Choose a supplier, then *Email order* or *Copy order*.

Add your suppliers and their order emails under **My suppliers**.

## Estimating rules

| Light | Rule |
|---|---|
| C9 / C7 bulbs | 1 bulb per foot (12" spacing) + 1; wire = feet × 1.05 + 3 ft lead; 1 clip per bulb; 1 male + 1 female zip plug per run |
| Mini lights | 1 × 70-ct (24 ft) string per 23 ft |
| Net lights | 1 × 4'×6' net per 24 sq ft |
| Rope light | feet × 1.05, sold in 150 ft spools |

These live in the `needs()` function in `index.html` if you want to change them.

## Data

Jobs and suppliers are saved in your browser (localStorage) on the device you use. Clearing browser data removes them.
