"""
live_trader.py
---------------
Reads the latest tanker cache (vessel_cache.json), computes signals,
fetches current Polymarket data, and generates live trading signals.

Appends each run to live_signals.csv for history tracking.
"""

import csv
import json
import requests
from datetime import datetime, timezone
from pathlib import Path

CACHE_FILE        = Path("vessel_cache.json")
OPT_WEIGHTS_FILE  = Path("optimised_weights.json")
LIVE_SIGNALS_CSV  = Path("live_signals.csv")

EXPECTED_DWELL = {
    "houston":      48,
    "loop":         24,
    "nynj":         36,
    "la_longbeach": 48,
    "corpus":       30,
}

GULF_COAST_PORTS      = {"houston", "loop"}
SOG_WAITING_THRESHOLD = 1.0

# ── Helpers ───────────────────────────────────────────────────────────────────

def load_cache():
    if not CACHE_FILE.exists():
        print(f"No cache file found: {CACHE_FILE}")
        return {}
    with open(CACHE_FILE) as f:
        return json.load(f).get("ports", {})

def median(values: list) -> float:
    if not values:
        return 0.0
    s   = sorted(values)
    n   = len(s)
    mid = n // 2
    return s[mid] if n % 2 else (s[mid - 1] + s[mid]) / 2

def parse_times(timestamps: list) -> list:
    times = []
    for t in timestamps:
        if not t:
            continue
        try:
            times.append(datetime.fromisoformat(t.replace("Z", "")))
        except ValueError:
            pass
    return sorted(times)

# ── Signal computations ───────────────────────────────────────────────────────

def compute_dwell_score(vessels: dict, port: str) -> float:
    threshold_hrs = EXPECTED_DWELL.get(port, 36)
    total, delayed = 0, 0
    for vessel in vessels.values():
        times = parse_times(vessel["timestamps"])
        if len(times) < 2:
            continue
        total += 1
        span_hrs = (times[-1] - times[0]).total_seconds() / 3600
        if span_hrs > threshold_hrs:
            delayed += 1
    return delayed / total if total else 0.0

def compute_density_score(vessels: dict, baseline: float) -> float:
    if baseline <= 0:
        return 0.0
    ratio = len(vessels) / baseline
    return min(ratio / 2.0, 1.0)

def compute_throughput_score(vessels: dict) -> float:
    arrivals, departures, total = 0, 0, len(vessels)
    for vessel in vessels.values():
        times = parse_times(vessel["timestamps"])
        if not times:
            continue
        if times[0].hour > 1:
            arrivals += 1
        if times[-1].hour < 22:
            departures += 1
    if total == 0:
        return 0.0
    net_build = arrivals - departures
    return max(0.0, min(net_build / total, 1.0))

def compute_sog_score(vessels: dict) -> float:
    total, waiting = 0, 0
    for vessel in vessels.values():
        sog_readings = vessel.get("sog_readings", [])
        if not sog_readings:
            continue
        total += 1
        if median(sog_readings) < SOG_WAITING_THRESHOLD:
            waiting += 1
    return waiting / total if total else 0.0

def compute_multi_port_bonus(port_scores: dict) -> float:
    gulf_scores = [
        port_scores.get(p, {}).get("dwell", 0.0)
        for p in GULF_COAST_PORTS
        if p in port_scores
    ]
    if len(gulf_scores) < 2:
        return 0.0
    product = 1.0
    for s in gulf_scores:
        product *= s
    return product ** (1.0 / len(gulf_scores))

def composite_score(row: dict, w: tuple) -> float:
    return (
        w[0] * row["agg_dwell"]      +
        w[1] * row["agg_density"]    +
        w[2] * row["agg_throughput"] +
        w[3] * row["agg_sog"]        +
        w[4] * row["multi_port"]
    )

# ── Polymarket live price ─────────────────────────────────────────────────────

def get_current_price(token_id: str) -> float | None:
    """Fetches the current midpoint price for a Polymarket token."""
    try:
        r = requests.get(
            "https://clob.polymarket.com/midpoint",
            params={"token_id": token_id},
            timeout=10,
        )
        r.raise_for_status()
        return float(r.json()["mid"])
    except Exception as e:
        print(f"  Midpoint fetch failed ({e}), trying order book...")

    # Fallback: derive midpoint from order book
    try:
        r = requests.get(
            "https://clob.polymarket.com/book",
            params={"token_id": token_id},
            timeout=10,
        )
        r.raise_for_status()
        data     = r.json()
        bids     = data.get("bids", [])
        asks     = data.get("asks", [])
        best_bid = float(bids[0]["price"]) if bids else 0.0
        best_ask = float(asks[0]["price"]) if asks else 1.0
        return round((best_bid + best_ask) / 2, 4)
    except Exception as e:
        print(f"  Order book fetch also failed: {e}")
        return None

def get_market_info(token_id: str) -> dict:
    """Fetches human-readable market metadata from the Gamma API."""
    try:
        r = requests.get(
            "https://gamma-api.polymarket.com/markets",
            params={"clob_token_ids": token_id},
            timeout=10,
        )
        r.raise_for_status()
        markets = r.json()
        if markets:
            m = markets[0]
            return {
                "question": m.get("question", "Unknown"),
                "end_date": m.get("endDateIso", "Unknown"),
            }
    except Exception as e:
        print(f"  Could not fetch market info: {e}")
    return {}

# ── Build live signals ────────────────────────────────────────────────────────

def build_live_signals(cache: dict) -> list:
    port_scores = {}

    for port in EXPECTED_DWELL:
        vessels = cache.get(port, {})
        if not vessels:
            continue

        baseline = len(vessels)
        port_scores[port] = {
            "dwell":        compute_dwell_score(vessels, port),
            "density":      compute_density_score(vessels, baseline),
            "throughput":   compute_throughput_score(vessels),
            "sog":          compute_sog_score(vessels),
            "vessel_count": len(vessels),
        }

    if not port_scores:
        return []

    multi_port = compute_multi_port_bonus(port_scores)

    def avg_metric(key):
        vals = [s[key] for s in port_scores.values()]
        return sum(vals) / len(vals) if vals else 0.0

    return [{
        "timestamp":      datetime.now(timezone.utc).isoformat(),
        "port_scores":    port_scores,
        "agg_dwell":      round(avg_metric("dwell"),      3),
        "agg_density":    round(avg_metric("density"),    3),
        "agg_throughput": round(avg_metric("throughput"), 3),
        "agg_sog":        round(avg_metric("sog"),        3),
        "multi_port":     round(multi_port,               3),
    }]

# ── Save to CSV ───────────────────────────────────────────────────────────────

def save_to_csv(signal_row: dict, token_id: str, market_info: dict,
                price: float | None, score: float, trade_signal: str):
    file_exists = LIVE_SIGNALS_CSV.exists()

    row_out = {
        "timestamp":       signal_row["timestamp"],
        "token_id":        token_id,
        "market":          market_info.get("question", ""),
        "expires":         market_info.get("end_date", ""),
        "price":           price,
        "agg_dwell":       signal_row["agg_dwell"],
        "agg_density":     signal_row["agg_density"],
        "agg_throughput":  signal_row["agg_throughput"],
        "agg_sog":         signal_row["agg_sog"],
        "multi_port":      signal_row["multi_port"],
        "composite_score": round(score, 4),
        "signal":          trade_signal,
    }

    with open(LIVE_SIGNALS_CSV, "a", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=row_out.keys())
        if not file_exists:
            writer.writeheader()
        writer.writerow(row_out)

    print(f"  Saved to {LIVE_SIGNALS_CSV}")

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    token_id = input("Enter Polymarket token_id: ").strip()
    if not token_id:
        print("No token_id provided. Exiting.")
        return

    if not OPT_WEIGHTS_FILE.exists():
        print("No optimised_weights.json found. Run backtest first.")
        return

    with open(OPT_WEIGHTS_FILE) as f:
        weights_dict = json.load(f)["optimised_weights"]

    weights = (
        weights_dict["dwell"],
        weights_dict["density"],
        weights_dict["throughput"],
        weights_dict["sog"],
        weights_dict["multi_port"],
    )

    cache = load_cache()
    if not cache:
        print("Cache empty. Run AIS streamer first.")
        return

    signals = build_live_signals(cache)
    if not signals:
        print("No live signals computed — check vessel_cache.json.")
        return

    signal_row   = signals[0]
    score        = composite_score(signal_row, weights)
    trade_signal = "BULLISH" if score > 0.3 else "NEUTRAL"
    price        = get_current_price(token_id)
    market_info  = get_market_info(token_id)

    # ── Print signal ──────────────────────────────────────────────────────────
    print("\n── LIVE TRADING SIGNAL ──────────────────────────────────────")
    if market_info:
        print(f"  Market:           {market_info.get('question')}")
        print(f"  Expires:          {market_info.get('end_date')}")
    print(f"  Time (UTC):       {signal_row['timestamp']}")
    print(f"  Current price:    {price if price is not None else 'unavailable'}")
    print()
    print(f"  Dwell score:      {signal_row['agg_dwell']:.3f}  × {weights[0]}")
    print(f"  Density score:    {signal_row['agg_density']:.3f}  × {weights[1]}")
    print(f"  Throughput score: {signal_row['agg_throughput']:.3f}  × {weights[2]}")
    print(f"  SOG score:        {signal_row['agg_sog']:.3f}  × {weights[3]}")
    print(f"  Multi-port score: {signal_row['multi_port']:.3f}  × {weights[4]}")
    print()
    print(f"  Composite score:  {score:.3f}")
    print(f"  Trade signal:     {trade_signal}")
    print()

    if trade_signal == "BULLISH" and price is not None:
        implied_edge = round(1.0 - price, 4)
        print(f"  Implied edge if YES resolves: +{implied_edge:.4f} per share")
    else:
        print("  No trade — signal below threshold (0.3)")

    print("─────────────────────────────────────────────────────────────")

    # ── Port breakdown ────────────────────────────────────────────────────────
    print("\n── Port breakdown ───────────────────────────────────────────")
    for port, ps in signal_row["port_scores"].items():
        print(f"  {port:<14}  vessels={ps['vessel_count']:>3}  "
              f"dwell={ps['dwell']:.3f}  density={ps['density']:.3f}  "
              f"sog={ps['sog']:.3f}")
    print()

    # ── Save to CSV ───────────────────────────────────────────────────────────
    save_to_csv(signal_row, token_id, market_info, price, score, trade_signal)

    # TODO: Replace with actual execution
    # if trade_signal == "BULLISH":
    #     execute_trade("BUY", token_id, price, size=100)

if __name__ == "__main__":
    main()