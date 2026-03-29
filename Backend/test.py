import asyncio
import websockets
import json
from datetime import datetime, timezone
from pathlib import Path
from dotenv import load_dotenv
import os

load_dotenv()
API_KEY = os.getenv("AISSTREAM_API_KEY")
CACHE_FILE = Path("vessel_cache.json")
WS_URL = "wss://stream.aisstream.io/v0/stream"

# Widened bounding box example
PORTS = {
    "houston":      [[28.9, -96.0], [30.5, -94.2]],
    "loop":         [[28.0, -91.5], [29.5, -89.8]],
    "nynj":         [[40.0, -75.0], [41.0, -73.5]],
    "la_longbeach": [[33.0, -119.0], [34.5, -117.5]],
    "corpus":       [[27.0, -98.0], [28.5, -97.0]],
}

def identify_port(lat, lon):
    """Return which port this vessel is near (or None)."""
    for port, bbox in PORTS.items():
        if bbox[0][0] <= lat <= bbox[1][0] and bbox[0][1] <= lon <= bbox[1][1]:
            return port
    return None
def identify_tanker(mmsi: str) -> bool:
    """
    Heuristic to guess if a vessel is a tanker using MMSI.
    Works on free-tier feeds with no StaticData.
    Returns True if likely a tanker.
    """
    if len(mmsi) != 9 or not mmsi.isdigit():
        return False

    # Extract first 3 digits (MID)
    mid = int(mmsi[:3])

    # Common US/Canada tankers (366, 367, 338, 339, 308, 309)
    tanker_mids = {366, 367, 338, 339, 308, 309}

    return mid in tanker_mids
def load_cache():
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    if CACHE_FILE.exists():
        try:
            cache = json.loads(CACHE_FILE.read_text())
            if cache.get("date") == today:
                return cache
        except (json.JSONDecodeError, KeyError):
            pass
    return {"date": today, "ports": {}, "message_count": 0}

def save_cache(cache):
    CACHE_FILE.write_text(json.dumps(cache, indent=2))

def update_cache(cache, port, mmsi, name, timestamp, sog):
    if port not in cache["ports"]:
        cache["ports"][port] = {}
    if mmsi not in cache["ports"][port]:
        cache["ports"][port][mmsi] = {
            "timestamps": [],
            "sog_readings": [],
            "name": name,
        }
    vessel = cache["ports"][port][mmsi]
    if not vessel["timestamps"] or vessel["timestamps"][-1] != timestamp:
        vessel["timestamps"].append(timestamp)
    if 0.0 <= sog < 102.0:
        vessel["sog_readings"].append(sog)
    cache["message_count"] = cache.get("message_count", 0) + 1

async def stream_ais(debug_count=10):
    """Stream all vessels from AISStream free feed and print first N sightings."""
    if not API_KEY:
        print("ERROR: AISSTREAM_API_KEY not set")
        return

    bounding_boxes = list(PORTS.values())
    subscription = {
        "APIKey": API_KEY,
        "BoundingBoxes": bounding_boxes,
        "FilterMessageTypes": ["PositionReport"],  # only PositionReport allowed on free tier
    }

    cache = load_cache()
    total_messages = 0
    sightings_printed = 0

    print(f"Starting AISStream connection...")
    print(f"Monitoring ports: {', '.join(PORTS.keys())}")
    print(f"Today's cache date: {cache['date']}\n")

    reconnect_delay = 5  # seconds

    while True:
        try:
            async with websockets.connect(WS_URL, ping_interval=20) as ws:
                await ws.send(json.dumps(subscription))
                print("Connected. Streaming vessels...\n")

                async for raw in ws:
                    try:
                        msg = json.loads(raw)
                    except json.JSONDecodeError:
                        continue

                    if msg.get("MessageType") != "PositionReport":
                        continue

                    metadata = msg.get("MetaData", {})
                    position = msg.get("Message", {}).get("PositionReport", {})

                    mmsi = str(metadata.get("MMSI", ""))
                    name = str(metadata.get("ShipName", "")).strip()
                    lat  = float(position.get("Latitude", 0))
                    lon  = float(position.get("Longitude", 0))
                    sog  = float(position.get("Sog", 0))
                    ts   = metadata.get("time_utc", datetime.now(timezone.utc).isoformat())

                    if not mmsi:
                        continue

                    port = identify_port(lat, lon)
                    if not port:
                        continue

                    update_cache(cache, port, mmsi, name, ts, sog)
                    total_messages += 1

                    # Print the first N sightings for debugging
                    if sightings_printed < debug_count:
                        print(f"[{total_messages}] {name or 'UNKNOWN'} | MMSI: {mmsi} | "
                              f"Port: {port} | Lat: {lat:.4f} Lon: {lon:.4f} | SOG: {sog}")
                        sightings_printed += 1
                        if sightings_printed == debug_count:
                            print("\n--- First 10 sightings printed. Continuing to accumulate cache ---\n")

                    if total_messages % 100 == 0:
                        save_cache(cache)
                        print(f"{total_messages} total messages processed. Cache saved.")

        except websockets.exceptions.ConnectionClosed as e:
            print(f"Connection closed ({e}). Reconnecting in {reconnect_delay}s...")
            save_cache(cache)
            await asyncio.sleep(reconnect_delay)
        except Exception as e:
            print(f"Unexpected error: {e}. Reconnecting in {reconnect_delay}s...")
            save_cache(cache)
            await asyncio.sleep(reconnect_delay)

    
# Run the stream
if __name__ == "__main__":
    asyncio.run(stream_ais())