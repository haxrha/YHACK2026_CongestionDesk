# Congestion Desk

AIS × Polymarket: a **Next.js** dashboard that combines historical backtests, live tanker congestion, Polymarket-facing signals, macro outlook, and a **CO₂** view tied to port activity.

---

## How to run the app

### Prerequisites

- **Node.js** 18+ (see `frontend/package.json` engines via Next 14)
- **npm** (or pnpm/yarn if you prefer—commands below use `npm`)

### Frontend (main UI)

```bash
cd frontend
npm install
npm run dev
```

Open **[http://localhost:3000](http://localhost:3000)**.

### Sign-in (local dev)

The app uses a **development cookie** session (no external IdP required for local use):

1. Go to `/login`.
2. Click **Continue** to set the cookie via `/api/dev-login`.
3. You are redirected to the desk; use **Sign out** (`/api/dev-logout`) when needed.

Optional: copy `frontend/.env.local.example` to `frontend/.env.local` and adjust if you add Auth0 or other providers later.

### Optional: AI market context

**Market context** (hero card) and **port insight** calls use Google Gemini when configured:

- Set `GEMINI_API_KEY` in `frontend/.env.local`.
- Optionally set `GEMINI_MODEL` (defaults to `gemini-2.0-flash`).

Without a key, those features show a friendly “add key” message; the rest of the desk still works.

### Production build

```bash
cd frontend
npm run build
npm start
```

---

## Using the desk

After you are signed in:

| Area | What it is |
|------|------------|
| **Desk** tab | Tanker map (historical AIS from the repo or live cache when present), live signal panel, price vs edge chart, and **Backtest results** table synced to the selected date. |
| **Outlook & 2026** tab | Macro ensemble (reads `macro_markets.json` + live CLOB when token IDs are set) and a YTD-style returns outlook card. |
| **CO₂ view** | Link in the header → `/emissions` — congestion-style signals mapped to IMO-style fuel / CO₂ estimates. |

**Backtest data** loads from `frontend/public/data/backtest_results.csv`.

**Live map / signals** read, in order:

1. `Backend/live_signals.csv` and `Backend/vessel_cache.json` **if** those paths exist next to `frontend` (the code expects a `Backend` folder name; on case-insensitive filesystems `backend` may work), **else**
2. `frontend/public/data/live_signals.csv` and `frontend/public/data/vessel_cache.json`.

Generate or refresh live data by running the Python pipeline in `backend/` (e.g. scripts that update `live_signals.csv` and `vessel_cache.json`) and copying or symlinking outputs into one of the locations above so the Next API routes can read them.

---

## Backend (Python) — overview

Python code under **`backend/`** handles AIS-derived signals, Polymarket helpers, backtesting, and live execution (e.g. `backtest.py`, `live_tradingexecution.py`, `load_data.py`). Run scripts from `backend/` with your virtual environment activated and dependencies installed (use `pip install` for whatever packages those scripts import—`requirements.txt` is not checked in; add one if you standardize the stack).

Typical workflow:

1. Prepare or update AIS / cache JSON and optimised weights as needed.
2. Run backtests or live execution to produce CSV/JSON consumed by the frontend or copied into `public/data/`.

---

## Project layout (short)

- `frontend/` — Next.js 14 app (App Router), Tailwind, desk + emissions UI, API routes under `src/app/api/`.
- `backend/` — Python analysis, Polymarket integration, live signal writers.
- `frontend/public/data/` — Static CSV/JSON for backtests and optional fallbacks for live files.

---

# About the project (hackathon narrative)

## Inspiration

One of the main things that inspired us was the news we have been seeing on oil prices. It has been very volatile recently with the tensions in the Middle East, and we wanted to come up with something that analyzes what is going on with oil shipments. A lot of times people analyze price data and use complex formulas or regression models to come up with trading strategies; however, the things that make these prices move **are** people, and that is what we aim to analyze. We also hope to provide valuable insights to government agencies about the impact of port congestion and shipping on the climate.

## What it does

It analyzes live shipping data to track oil tankers traveling into ports in the U.S. such as Long Beach, CA, Houston, and Corpus Christi, TX, along with NY, displaying the level of congestion along with the number of tankers that are there at a certain date and time. We also display current-day trades that our algorithm is making along with a prediction for potential returns for the next day. Additionally, we display a carbon emissions page that compares congestion at these different ports with the carbon emissions in those areas.

## How we built it

**Frontend:** We primarily used Next.js/React along with Tailwind CSS for the UI. We had several sections: a login flow, a page that looks at historical backtesting along with current live trading, and a page that overlays carbon emissions using NOAA-related API data with tanker congestion data.

**Backend:** We primarily used Python for our backend, which focused on analyzing and testing historical data from 1 Jan 2024–1 Apr 2024 from AIS (vessel tracking). Specifically, our backend used a regression model through XGBoost that analyzes multiple factors such as the amount of tankers at each port along with delay before a tanker reaches port (using headings and related math to calculate this). We also analyzed throughput (arrivals minus departures), and whether there was overlap across multiple ports (e.g. Houston and Corpus Christi, Texas). We then overlaid this with live Polymarket data at the time (we focused on a prompt about Venezuelan crude production through end of March, since that depends a lot on shipping patterns along with congestion), creating a mean score (threshold value `> 0.3`) that determined whether we traded or not. We saw generally positive results through our backtest.

We then used live trading by importing Polymarket data (e.g. crude oil strike prompts through end of March) and tested the strategy over a recent window. We saw fairly neutral results. The main reason is that oil prices have been fairly volatile, but volatility has not directly affected shipping congestion as much.

**Database:** We used MongoDB for storing a database of our backtested data.

**Authentication:** We used OAuth for authentication.

*(Note: this repository’s current web app uses CSV/JSON files and a dev cookie session for local runs; MongoDB/OAuth can be wired in as you deploy.)*

## Challenges we ran into

One of the biggest challenges was not only getting the data for the project, but also issues backtesting with Polymarket through oil markets. Polymarket did not really have any markets that looked at oil prices until early 2025, so even though the one we found from the time period was useful it was not as accurate, since there is not a clear, direct correlation between oil shipments to U.S. ports and Venezuelan oil production—Venezuela has access to its own reserves. Additionally, even though getting past data from AIS (Marine Cadastre, which is open source) was easy, it was more difficult to get modern-day data without paying; however, we did find an alternative AISStreams API that pulls live data on shipping congestion in order to test our model on live prompts.

## Accomplishments that we are proud of

We are proud that we used alternative data to build something that not only could generate alpha from trading, but can also help the community and the environment. This type of data could be very useful to policymakers in order to prevent overcrowding or delays at certain ports. It is also useful because the dashboard shows the carbon impact at these locations.

## What we learned

We learned a lot—this was our first time deploying a trading strategy, so learning how to use and analyze market data was something we really enjoyed. A big lesson: do not try to download 30GB of shipping data at once—it crashed a laptop.

## What is next for Congestion Desk

Next, we want to use more data in backtesting and see if there is more we can find. Specifically, we want to backtest during major oil/global events that affected oil prices and during periods where oil prices were fairly stable.

---

## License

Add a license file if you open-source the repo.
