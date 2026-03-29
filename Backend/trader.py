"""
STEP 4: Live auto-trader
Reads today's AIS tanker data, computes delay signal,
and places trades on Polymarket if edge is sufficient.

    python 4_trader.py

⚠️  SAFETY: Starts in DRY_RUN mode. No real money moves until you set DRY_RUN=False.
"""

import os
import json
import time
import urllib.request
import zipfile
import csv
from datetime import date, timedelta
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

# ── Config ────────────────────────────────────────────────────────────────────

DRY_RUN         = True   # ← Set to False only after backtesting confirms edge
MAX_TRADE_USDC  = float(os.getenv("MAX_TRADE_USDC",  "10"))
MAX_DAILY_USDC  = float(os.getenv("MAX_DAILY_USDC",  "50"))
MIN_EDGE        = float(os.getenv("MIN_EDGE",         "0.05"))
PRIVATE_KEY     = os.getenv("PRIVATE_KEY")
FUNDER_ADDRESS  = os.getenv("FUNDER_ADDRESS")
API_KEY         = os.getenv("POLY_API_KEY")
API_SECRET      = os.getenv("POLY_API_SECRET")
API_PASSPHRASE  = os.getenv("POLY_API_PASSPHRASE")

AIS_BASE    = "https://coast.noaa.gov/htdata/CMSP/AISDataHandler/2024"
TANKER_TYPES = set(range(80, 90))

PORTS = {
    "houston":      [-95.4, -94.7, 29.4, 29.9],
    "loop":         [-91.0, -90.4, 28.7, 29.1],
    "nynj":         [-74.3, -73.8, 40.4, 40.8],
    "la_longbeach": [-118.4, -117.9, 33.6, 34.0],
    "corpus":       [-97.5, -97.1, 27.7, 28.0],
}

EXPECTED_DWELL = {
    "houston": 48, "loop": 24, "nynj": 36, "la_longbeach": 48, "corpus": 30,
}

daily_spent = 0.0

# ── AIS signal ────────────────────────────────────────────────────────────────

def in_port(lat: float, lon: float) -> str | None:
    for port, (min_lon, max_lon, min_lat, max_lat) in PORTS.items():
        if min_lon <= lon <= max_lon and min_lat <= lat <= max_lat:
            return port
    return None

def fetch_todays_signal() -> dict:
    """Download today's AIS file, compute delay scores, return per-port signals."""
    today     = date.today()
    fname     = f"AIS_{today.strftime('%Y_%m_%d')}.zip"
    url       = f"{AIS_BASE}/{fname}"
    zip_path  = Path(fname)

    print(f"Downloading today's AIS data: {fname}")
    try:
        urllib.request.urlretrieve(url, zip_path)
    except Exception as e:
        # Try yesterday if today's not yet published
        yesterday = today - timedelta(days=1)
        fname     = f"AIS_{yesterday.strftime('%Y_%m_%d')}.zip"
        url       = f"{AIS_BASE}/{fname}"
        print(f"  Today not available, trying yesterday: {fname}")
        urllib.request.urlretrieve(url, zip_path)

    vessels = {}  # mmsi -> { port -> [timestamps] }

    with zipfile.ZipFile(zip_path, "r") as z:
        for name in z.namelist():
            with z.open(name) as f:
                reader = csv.DictReader(line.decode("utf-8") for line in f)
                for row in reader:
                    try:
                        vtype = int(float(row.get("VesselType", 0) or 0))
                        lat   = float(row.get("LAT", 0) or 0)
                        lon   = float(row.get("LON", 0) or 0)
                        mmsi  = row.get("MMSI", "")
                        ts    = row.get("BaseDateTime", "")
                    except ValueError:
                        continue

                    if vtype in TANKER_TYPES and mmsi:
                        port = in_port(lat, lon)
                        if port:
                            vessels.setdefault(mmsi, {}).setdefault(port, []).append(ts)

    zip_path.unlink()

    # Compute delay score per port
    from datetime import datetime
    signals = {}
    for port, threshold in EXPECTED_DWELL.items():
        total   = 0
        delayed = 0
        for mmsi, port_times in vessels.items():
            if port not in port_times:
                continue
            total += 1
            times = sorted([
                datetime.fromisoformat(t.replace("Z", ""))
                for t in port_times[port] if t
            ])
            if len(times) >= 2:
                span_hrs = (times[-1] - times[0]).total_seconds() / 3600
                if span_hrs > threshold:
                    delayed += 1

        score = delayed / total if total > 0 else 0.0
        signals[port] = {
            "total_vessels":   total,
            "delayed_vessels": delayed,
            "delay_score":     round(score, 3),
            "signal":          "BULLISH" if score > 0.3 else "NEUTRAL",
        }
        print(f"  {port}: {delayed}/{total} delayed (score={score:.3f}) → {signals[port]['signal']}")

    return signals

# ── Polymarket client ─────────────────────────────────────────────────────────

def get_client():
    from py_clob_client.client import ClobClient
    from py_clob_client.clob_types import ApiCreds

    client = ClobClient(
        "https://clob.polymarket.com",
        key=PRIVATE_KEY,
        chain_id=137,
        signature_type=1,
        funder=FUNDER_ADDRESS,
    )
    client.set_api_creds(ApiCreds(
        api_key=API_KEY,
        api_secret=API_SECRET,
        api_passphrase=API_PASSPHRASE,
    ))
    return client

def get_current_price(client, token_id: str) -> float:
    result = client.get_midpoint(token_id)
    return float(result.get("mid", 0))

# ── Trade execution ───────────────────────────────────────────────────────────

def place_trade(client, token_id: str, side: str, price: float, usdc_amount: float):
    global daily_spent

    if daily_spent + usdc_amount > MAX_DAILY_USDC:
        print(f"  ⚠️  Daily limit reached (${daily_spent:.2f}/${MAX_DAILY_USDC}). Skipping.")
        return

    shares = usdc_amount / price

    if DRY_RUN:
        print(f"  🔵 DRY RUN — would BUY {shares:.2f} shares of {side} at ${price:.3f} (${usdc_amount:.2f})")
        return

    print(f"  💸 Placing REAL order: {shares:.2f} {side} shares at ${price:.3f}...")

    try:
        from py_clob_client.clob_types import MarketOrderArgs, OrderType

        order_args = MarketOrderArgs(
            token_id=token_id,
            amount=usdc_amount,
        )
        signed_order = client.create_market_order(order_args)
        resp = client.post_order(signed_order, OrderType.FOK)

        if resp.get("success"):
            daily_spent += usdc_amount
            print(f"  ✅ Order filled. Daily spent: ${daily_spent:.2f}")
        else:
            print(f"  ❌ Order failed: {resp}")

    except Exception as e:
        print(f"  ❌ Error placing order: {e}")

# ── Main loop ─────────────────────────────────────────────────────────────────

def load_watched_markets() -> list:
    """Load markets you want to trade from markets.json."""
    try:
        with open("markets.json") as f:
            markets = json.load(f)
        oil_markets = []
        for m in markets:
            tokens = m.get("tokens", [])
            yes_token = next((t for t in tokens if t.get("outcome","").upper() == "YES"), None)
            if yes_token:
                oil_markets.append({
                    "question": m.get("question", ""),
                    "token_id": yes_token.get("token_id", ""),
                    "end_date": m.get("endDate", "")[:10],
                })
        return oil_markets
    except FileNotFoundError:
        print("markets.json not found. Run python 2_find_markets.py first.")
        return []

def main():
    print("=" * 60)
    print(f"  Polymarket AIS Oil Trader")
    print(f"  Mode: {'🔵 DRY RUN (no real money)' if DRY_RUN else '🔴 LIVE TRADING'}")
    print(f"  Max per trade: ${MAX_TRADE_USDC}  |  Max per day: ${MAX_DAILY_USDC}")
    print("=" * 60)

    if not DRY_RUN and not all([PRIVATE_KEY, FUNDER_ADDRESS, API_KEY]):
        print("ERROR: Missing credentials in .env. Run 1_setup_wallet.py first.")
        return

    markets = load_watched_markets()
    if not markets:
        return

    print(f"\nWatching {len(markets)} oil markets.")
    client = get_client() if not DRY_RUN else None

    # Get today's AIS signal
    print("\n── Computing AIS delay signal ──────────────────────")
    signals = fetch_todays_signal()

    # Overall signal: are most ports bullish?
    bullish_ports = sum(1 for s in signals.values() if s["signal"] == "BULLISH")
    overall = "BULLISH" if bullish_ports >= 2 else "NEUTRAL"
    print(f"\nOverall signal: {overall} ({bullish_ports}/5 ports delayed)")

    if overall == "NEUTRAL":
        print("No strong signal today. No trades placed.")
        return

    # For each watched market, check price and trade if edge exists
    print("\n── Evaluating markets ──────────────────────────────")
    for m in markets:
        print(f"\n  {m['question'][:70]}")
        print(f"  Closes: {m['end_date']}")

        token_id = m["token_id"]
        if not token_id:
            print("  No token ID. Skipping.")
            continue

        try:
            # In dry run we still hit the public API for price
            from py_clob_client.client import ClobClient
            pub_client = ClobClient("https://clob.polymarket.com")
            price = float(pub_client.get_midpoint(token_id).get("mid", 0))
        except Exception as e:
            print(f"  Could not get price: {e}")
            continue

        print(f"  Current YES price: ${price:.3f}")

        # Simple edge: if bullish and YES < 0.6, there's edge
        edge = 0.6 - price if overall == "BULLISH" else 0

        if edge >= MIN_EDGE:
            print(f"  Edge detected: {edge:.3f} >= {MIN_EDGE} threshold")
            trade_size = min(MAX_TRADE_USDC, MAX_TRADE_USDC * (edge / 0.2))
            place_trade(client, token_id, "YES", price, trade_size)
        else:
            print(f"  Insufficient edge ({edge:.3f} < {MIN_EDGE}). Skipping.")

    print("\n── Done ────────────────────────────────────────────")
    print(f"Daily total spent: ${daily_spent:.2f}")
    if DRY_RUN:
        print("\n⚠️  This was a dry run. Set DRY_RUN=False in 4_trader.py to trade real money.")

if __name__ == "__main__":
    main()