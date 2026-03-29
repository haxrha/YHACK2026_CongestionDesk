import requests, json

def get_first_live_token():
    """
    Fetches the first active/unclosed market and returns its YES clob token ID.
    """
    try:
        r = requests.get(
            "https://gamma-api.polymarket.com/markets",
            params={
                "active": "true",
                "closed": "false",
                "limit": 1
            },
            timeout=10
        )
        r.raise_for_status()
        markets = r.json()
        if markets:
            m = markets[0]
            raw_tokens = m.get("clobTokenIds", "[]")
            ids = json.loads(raw_tokens)
            if ids:
                print(f"Using first live market: {m.get('question')}")
                print(f"YES token: {ids[0]}")
                return ids[0]
    except Exception as e:
        print(f"Error fetching live market: {e}")
    return None

# Example usage:
token_id = get_first_live_token()
print("Selected token:", token_id)