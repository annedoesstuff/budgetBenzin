# budgetBenzin
Web-app, that shows current fuel prices, price history and buy recommendation for a specified area (Merseburg). 

Check it out: https://annedoesstuff.github.io/budgetBenzin/

## How It Works
1. **Data Fetching:** GitHub Actions workflow runs on a schedule (every hour).
2. **Python Script:** The workflow runs a Python script `backend/fetch_prices.py`. Script fetches data for a predefined area from the Tankerkönig API.
3. **Data Storage:** Fetched price is appended to a JSON file `data/prices.json`. Entries older than 14 days are removed.
4. **Commit Changes:** GitHub Action automatically commits updated `prices.json`.
5. **Frontend Display:** `index.html` uses `script.js` to fetch and parse the static `prices.json` file. It then dynamically renders the current price and the historical price chart using Chart.js.

## Tech Stack
- Frontend:
  - HTML, CSS
  - JavaScript
  - Chart.js
- Data Fetching & Automation:
  - Python
  - requests lib
  - GitHub Actions
- API & Hosting:
  - [Tankerkönig](https://creativecommons.tankerkoenig.de/) API
  - [GitHub Pages](https://pages.github.com/)

## Configuration
To use the app for a different location, you can change these constants in `backend/fetch_prices.py`:

- **LAT**: Latitude of the location.
- **LNG**: Longitude of the location.
- **RADIUS**: The search radius in kilometers.

