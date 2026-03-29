import requests
from datetime import datetime, timedelta

BASE = "https://coast.noaa.gov/htdata/CMSP/AISDataHandler"

# Check most recent available dates by probing backwards from mid-2025
d = datetime(2025, 6, 1)
while d > datetime(2024, 9, 1):
    url = f"{BASE}/{d.year}/AIS_{d.strftime('%Y_%m_%d')}.zip"
    r = requests.head(url, timeout=10)
    if r.status_code == 200:
        print(f"✅ Most recent available: {d.strftime('%Y-%m-%d')}")
        break
    else:
        print(f"❌ Not available: {d.strftime('%Y-%m-%d')}")
    d -= timedelta(days=7)