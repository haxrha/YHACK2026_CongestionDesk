"""
STEP 2: Find oil/energy markets on Polymarket
Run this to browse what markets exist that your AIS signal could trade.

    python 2_find_markets.py
"""

import requests
import json
from datetime import datetime

GAMMA_API = "https://gamma-api.polymarket.com"

OIL_KEYWORDS = [
    "oil", "crude", "wti", "brent", "opec", "petroleum",
    "energy", "gasoline", "barrel", "refinery"
]

def search_markets(keyword: str) -> list:
    try:
        r = requests.get(
            f"{GAMMA_API}/markets",
            params={
                "q":      keyword,
                "active": "true",
                "limit":  20,
            },
            timeout=10,
        )
        r.raise_for_status()
        return r.json()
    except Exception as e:
        print(f"  Error searching '{keyword}': {e}")
        return []

def get_market_price(token_id: str) -> float | None:
    """Get current YES price (0.0 to 1.0) for a market."""
    try:
        from py_clob_client.client import ClobClient
        client = ClobClient("https://clob.polymarket.com")
        result = client.get_midpoint(token_id)
        return float(result.get("mid", 0))
    except:
        return None

def main():
    print("Searching Polymarket for oil/energy markets...\n")

    seen = set()
    markets = []

    for keyword in OIL_KEYWORDS:
        results = search_markets(keyword)
        for m in results:
            mid = m.get("conditionId", m.get("id", ""))
            if mid and mid not in seen:
                seen.add(mid)
                markets.append(m)

    if not markets:
        print("No markets found. Check your internet connection.")
        return

    print(f"Found {len(markets)} unique oil/energy markets:\n")
    print(f"{'#':<4} {'Question':<60} {'YES Price':<12} {'Volume':<12} {'Closes'}")
    print("-" * 110)

    for i, m in enumerate(markets, 1):
        question  = m.get("question", "Unknown")[:57] + "..." if len(m.get("question","")) > 57 else m.get("question","")
        volume    = m.get("volume", 0)
        end_date  = m.get("endDate", "")[:10]
        token_id  = ""

        # Token IDs live inside the tokens list
        tokens = m.get("tokens", [])
        for t in tokens:
            if t.get("outcome", "").upper() == "YES":
                token_id = t.get("token_id", "")
                break

        price_str = "fetching..."
        if token_id:
            price = get_market_price(token_id)
            price_str = f"${price:.2f}" if price else "n/a"

        print(f"{i:<4} {question:<60} {price_str:<12} ${float(volume):<11,.0f} {end_date}")

    # Save full details to JSON for use in trader
    with open("markets.json", "w") as f:
        json.dump(markets, f, indent=2)

    print(f"\nFull market details saved to markets.json")
    print("\nNext step: run python 3_backtest.py")
    print("\nTIP: Look for markets like:")
    print("  - 'Will WTI crude be above $X on [date]?'")
    print("  - 'Will OPEC cut production in [month]?'")
    print("  These are the ones your tanker delay signal can trade.")

if __name__ == "__main__":
    main()