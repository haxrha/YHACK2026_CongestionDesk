"""
STEP 3: Backtest your AIS tanker delay signal
Computes five signal metrics per port per day:
  1. Dwell time     — vessels sitting longer than expected
  2. Port density   — vessel count vs 30-day rolling average
  3. Throughput     — arrivals minus departures (net queue build)
  4. SOG proxy      — fraction of vessels with median SOG < 1 knot
  5. Multi-port     — Houston + LOOP congested simultaneously

Then runs a weight optimizer to find the combination that best
predicts next-day Polymarket oil price movement.

    python 3_backtest.py

Requires: ais_tankers/ folder from the AIS download script
"""

import csv
import json
import itertools
import requests
from pathlib import Path
from datetime import datetime, timedelta
from collections import defaultdict

AIS_DIR   = Path("ais_tankers")
GAMMA_API = "https://gamma-api.polymarket.com"

EXPECTED_DWELL = {
    "houston":      48,
    "loop":         24,
    "nynj":         36,
    "la_longbeach": 48,
    "corpus":       30,
}

# Gulf Coast ports that form the joint congestion signal
GULF_COAST_PORTS = {"houston", "loop"}

# SOG threshold in knots — below this = vessel is effectively waiting
SOG_WAITING_THRESHOLD = 1.0

# ── Data loading ──────────────────────────────────────────────────────────────

def load_tanker_days() -> dict:
    """
    Returns {
        date_str: {
            port: {
                mmsi: {
                    "timestamps": [...],
                    "sog_readings": [...]
                }
            }
        }
    }
    """
    data = defaultdict(lambda: defaultdict(lambda: defaultdict(
        lambda: {"timestamps": [], "sog_readings": []}
    )))

    files = sorted(AIS_DIR.glob("tankers_*.csv"))
    if not files:
        print(f"No tanker CSVs found in {AIS_DIR}/")
        print("Run the AIS download script first.")
        return {}

    print(f"Loading {len(files)} daily tanker files...")

    for f in files:
        date_str = f.stem.replace("tankers_", "")
        with open(f, newline="") as fh:
            reader = csv.DictReader(fh)
            for row in reader:
                mmsi    = row.get("MMSI", "")
                port    = row.get("port", "")
                ts      = row.get("BaseDateTime", row.get("TIMESTAMP", ""))
                sog_raw = row.get("SOG", "")

                if not (mmsi and port and ts):
                    continue

                data[date_str][port][mmsi]["timestamps"].append(ts)

                try:
                    sog = float(sog_raw)
                    # Filter out sentinel values (102.3 = not available)
                    if 0.0 <= sog < 102.0:
                        data[date_str][port][mmsi]["sog_readings"].append(sog)
                except (ValueError, TypeError):
                    pass

    return data

# ── Per-vessel helpers ────────────────────────────────────────────────────────

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

def median(values: list) -> float:
    if not values:
        return 0.0
    s = sorted(values)
    n = len(s)
    mid = n // 2
    return s[mid] if n % 2 else (s[mid - 1] + s[mid]) / 2

# ── Five signal metrics ───────────────────────────────────────────────────────

def compute_dwell_score(vessels: dict, port: str) -> float:
    """Fraction of vessels with dwell time exceeding expected threshold."""
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
    return delayed / total if total > 0 else 0.0

def compute_density_score(vessels: dict, baseline: float) -> float:
    """
    Ratio of today's vessel count to 30-day rolling average.
    Score > 1.0 means more crowded than normal.
    Clamped to 0-2 range then normalised to 0-1.
    """
    if baseline <= 0:
        return 0.0
    ratio = len(vessels) / baseline
    return min(ratio / 2.0, 1.0)

def compute_throughput_score(vessels: dict) -> float:
    """
    Net queue build: arrivals minus departures as a fraction of total vessels.
    A vessel is an arrival if its first ping is after midnight,
    a departure if its last ping is before 23:00.
    Positive score = queue building (bullish).
    """
    arrivals   = 0
    departures = 0
    total      = len(vessels)

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
    """
    Fraction of vessels with median SOG below the waiting threshold.
    Higher score = more vessels are stationary = stronger congestion signal.
    """
    total, waiting = 0, 0
    for vessel in vessels.values():
        sog_readings = vessel["sog_readings"]
        if not sog_readings:
            continue
        total += 1
        if median(sog_readings) < SOG_WAITING_THRESHOLD:
            waiting += 1
    return waiting / total if total > 0 else 0.0

def compute_multi_port_bonus(port_scores: dict) -> float:
    """
    Returns a 0-1 bonus score when multiple Gulf Coast ports are
    simultaneously congested. Uses geometric mean so both must be
    high for the score to be high.
    """
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

# ── Build daily signals ───────────────────────────────────────────────────────

def build_daily_signals(data: dict) -> list:
    """
    For each date, compute all five metrics per port and combine
    into a raw (pre-weighted) signal record.
    """
    date_keys    = sorted(data.keys())
    daily_counts = defaultdict(list)

    for date_str in date_keys:
        for port in EXPECTED_DWELL:
            count = len(data[date_str].get(port, {}))
            daily_counts[port].append(count)

    print(f"Computing metrics across {len(date_keys)} days...")

    signals = []

    for day_idx, date_str in enumerate(date_keys):
        port_scores = {}

        for port in EXPECTED_DWELL:
            vessels = data[date_str].get(port, {})
            if not vessels:
                continue

            window_start = max(0, day_idx - 30)
            window       = daily_counts[port][window_start:day_idx]
            baseline     = sum(window) / len(window) if window else len(vessels)

            port_scores[port] = {
                "dwell":        compute_dwell_score(vessels, port),
                "density":      compute_density_score(vessels, baseline),
                "throughput":   compute_throughput_score(vessels),
                "sog":          compute_sog_score(vessels),
                "vessel_count": len(vessels),
            }

        if not port_scores:
            continue

        multi_port = compute_multi_port_bonus(port_scores)

        def avg_metric(key):
            vals = [s[key] for s in port_scores.values()]
            return sum(vals) / len(vals) if vals else 0.0

        signals.append({
            "date":           date_str,
            "port_scores":    port_scores,
            "agg_dwell":      round(avg_metric("dwell"),      3),
            "agg_density":    round(avg_metric("density"),    3),
            "agg_throughput": round(avg_metric("throughput"), 3),
            "agg_sog":        round(avg_metric("sog"),        3),
            "multi_port":     round(multi_port,               3),
        })

    return signals

# ── Weight optimizer ──────────────────────────────────────────────────────────

def composite_score(row: dict, w: tuple) -> float:
    return (
        w[0] * row["agg_dwell"]      +
        w[1] * row["agg_density"]    +
        w[2] * row["agg_throughput"] +
        w[3] * row["agg_sog"]        +
        w[4] * row["multi_port"]
    )

def evaluate_weights(signals: list, prices: dict, weights: tuple,
                     threshold: float = 0.3) -> dict:
    wins, losses, total_edge = 0, 0, 0.0

    for row in signals:
        date           = row["date"]
        price_today    = prices.get(date)
        next_day       = (datetime.fromisoformat(date) + timedelta(days=1)).strftime("%Y-%m-%d")
        price_tomorrow = prices.get(next_day)

        if price_today is None or price_tomorrow is None:
            continue

        score  = composite_score(row, weights)
        signal = "BULLISH" if score > threshold else "NEUTRAL"
        edge   = price_tomorrow - price_today

        correct = (signal == "BULLISH" and edge > 0) or \
                  (signal == "NEUTRAL" and edge <= 0)

        if correct:
            wins += 1
            total_edge += abs(edge)
        else:
            losses += 1
            total_edge -= abs(edge)

    total = wins + losses
    return {
        "weights":    weights,
        "win_rate":   wins / total if total > 0 else 0.0,
        "total_edge": total_edge,
        "trades":     total,
    }

def optimize_weights(signals: list, prices: dict) -> tuple:
    print("\nOptimising signal weights (grid search)...")

    weight_steps = [round(x * 0.1, 1) for x in range(0, 11)]
    best         = None
    best_result  = {"win_rate": 0.0, "total_edge": -999}
    candidates   = 0

    for combo in itertools.product(weight_steps, repeat=5):
        if abs(sum(combo) - 1.0) > 0.001:
            continue
        candidates += 1
        result = evaluate_weights(signals, prices, combo)
        if (result["win_rate"] > best_result["win_rate"] or
            (result["win_rate"] == best_result["win_rate"] and
             result["total_edge"] > best_result["total_edge"])):
            best        = combo
            best_result = result

    print(f"  Evaluated {candidates} weight combinations.")
    print(f"\n  Best weights found:")
    print(f"    Dwell:      {best[0]:.1f}")
    print(f"    Density:    {best[1]:.1f}")
    print(f"    Throughput: {best[2]:.1f}")
    print(f"    SOG:        {best[3]:.1f}")
    print(f"    Multi-port: {best[4]:.1f}")
    print(f"\n  Win rate:   {best_result['win_rate']*100:.1f}%")
    print(f"  Total edge: {best_result['total_edge']:+.3f}")
    print(f"  Trades:     {best_result['trades']}")

    return best, best_result

# ── Polymarket prices ─────────────────────────────────────────────────────────

def get_price_history(token_id: str) -> dict:
    try:
        r = requests.get(
            "https://clob.polymarket.com/prices-history",  # <-- CLOB, not Gamma
            params={
                "market":   token_id,
                "interval": "max",
                "fidelity": 1440,   # <-- 1440 minutes = 1 day
            },
            timeout=10,
        )
        r.raise_for_status()
        history = r.json().get("history", [])
    except Exception as e:
        print(f"  Could not fetch price history: {e}")
        return {}

    prices = {}
    for p in history:
        ts = p.get("t", 0)
        dt = datetime.utcfromtimestamp(ts).strftime("%Y-%m-%d")
        prices[dt] = p.get("p")
    return prices

# ── Final backtest print ──────────────────────────────────────────────────────

import csv

def print_backtest(signals: list, prices: dict, weights: tuple, threshold: float = 0.3):
    rows_out = []
    wins, losses, total_edge = 0, 0, 0.0  # add this line
    # ... (existing code unchanged) ...

    for row in signals:
        date           = row["date"]
        price_today    = prices.get(date)
        next_day       = (datetime.fromisoformat(date) + timedelta(days=1)).strftime("%Y-%m-%d")
        price_tomorrow = prices.get(next_day)

        if price_today is None or price_tomorrow is None:
            continue

        score   = round(composite_score(row, weights), 3)
        signal  = "BULLISH" if score > threshold else "NEUTRAL"
        edge    = price_tomorrow - price_today
        correct = (signal == "BULLISH" and edge > 0) or \
                  (signal == "NEUTRAL" and edge <= 0)

        wins       += int(correct)
        losses     += int(not correct)
        total_edge += abs(edge) if correct else -abs(edge)

        # existing print statement...
        print(...)

        # collect for CSV
        rows_out.append({
            "date":         date,
            "dwell":        row["agg_dwell"],
            "density":      row["agg_density"],
            "throughput":   row["agg_throughput"],
            "sog":          row["agg_sog"],
            "multi_port":   row["multi_port"],
            "score":        score,
            "signal":       signal,
            "price_today":  price_today,
            "price_tomorrow": price_tomorrow,
            "edge":         round(edge, 4),
            "correct":      correct,
        })

    # Save to CSV
    if rows_out:
        csv_path = "backtest_results.csv"
        with open(csv_path, "w", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=rows_out[0].keys())
            writer.writeheader()
            writer.writerows(rows_out)
        print(f"\n  Results saved to {csv_path}")

    # ... existing summary prints unchanged ...
    

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    data = load_tanker_days()
    if not data:
        return

    signals = build_daily_signals(data)
    print(f"\nBuilt {len(signals)} daily signal records.")

    print("\n── Raw metric averages ──────────────────────────────────────")
    for key, label in [
        ("agg_dwell",      "Avg dwell score"),
        ("agg_density",    "Avg density score"),
        ("agg_throughput", "Avg throughput score"),
        ("agg_sog",        "Avg SOG score"),
        ("multi_port",     "Avg multi-port score"),
    ]:
        avg = sum(r[key] for r in signals) / len(signals)
        print(f"  {label:<24} {avg:.3f}")

    with open("delay_signals.json", "w") as f:
        json.dump(signals, f, indent=2)
    print("\n  Signals saved to delay_signals.json")

    print("\nTo backtest, find a YES token_id from markets.json.")
    token_id = input("Paste token_id (or press Enter to skip): ").strip()
    if not token_id:
        print("Skipping backtest. Run again with a token_id to optimise weights.")
        return

    prices = get_price_history(token_id)
    if not prices:
        print("Could not fetch price history. Check token_id and connectivity.")
        return

    print(f"  Fetched {len(prices)} days of price history.")

    best_weights, best_result = optimize_weights(signals, prices)
    print_backtest(signals, prices, best_weights)

    output = {
        "optimised_weights": {
            "dwell":      best_weights[0],
            "density":    best_weights[1],
            "throughput": best_weights[2],
            "sog":        best_weights[3],
            "multi_port": best_weights[4],
        },
        "backtest_result": {
            "win_rate":   round(best_result["win_rate"], 4),
            "total_edge": round(best_result["total_edge"], 4),
            "trades":     best_result["trades"],
        }
    }
    with open("optimised_weights.json", "w") as f:
        json.dump(output, f, indent=2)
    print("\n  Optimised weights saved to optimised_weights.json")
    print("  The frontend and trader will use these automatically.")
            

if __name__ == "__main__":
    main()