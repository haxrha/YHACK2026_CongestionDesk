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

# Widened bounding boxes
PORTS = {
    "houston":      [[28.9, -96.0], [30.5, -94.2]],
    "loop":         [[28.0, -91.5], [29.5, -89.8]],
    "nynj":         [[40.0, -75.0], [41.0, -73.5]],
    "la_longbeach": [[33.0, -119.0], [34.5, -117.5]],
    "corpus":       [[27.0, -98.0], [28.5, -97.0]],
}

def identify_port(lat, lon):
    for port, bbox in PORTS.items():
        if bbox[0][0] <= lat <= bbox[1][0] and bbox[0][1] <= lon <= bbox[1][1]:
            return port
    return None

def identify_tanker(mmsi: str) -> bool:
    """
    Heuristic to guess tankers from MMSI.
    Common US/Canada tanker MIDs: 366, 367, 338, 339, 308, 309
    """
    if len(mmsi) != 9 or not mmsi.isdigit():
        return False
    mid = int(mmsi[:3])
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

def update_cache(
    cache, port, mmsi, name, timestamp, sog, lat, lon, cog
):
    if port not in cache["ports"]:
        cache["ports"][port] = {}
    if mmsi not in cache["ports"][port]:
        cache["ports"][port][mmsi] = {
            "timestamps": [],
            "sog_readings": [],
            "name": name,
            "likely_tanker": identify_tanker(mmsi),
        }
    vessel = cache["ports"][port][mmsi]
    vessel["likely_tanker"] = identify_tanker(mmsi)
    vessel["last_lat"] = lat
    vessel["last_lon"] = lon
    vessel["last_cog"] = float(cog) if cog is not None else 0.0
    if not vessel["timestamps"] or vessel["timestamps"][-1] != timestamp:
        vessel["timestamps"].append(timestamp)
    if 0.0 <= sog < 102.0:
        vessel["sog_readings"].append(sog)
    cache["message_count"] = cache.get("message_count", 0) + 1

async def stream_ais_all(debug_count=10):
    """
    Stream all vessels from AISStream (no filtering by tanker),
    accumulate into daily cache, and keep your daily signal system.
    """
    if not API_KEY:
        print("ERROR: AISSTREAM_API_KEY not set")
        return

    bounding_boxes = list(PORTS.values())
    subscription = {
        "APIKey": API_KEY,
        "BoundingBoxes": bounding_boxes,
        "FilterMessageTypes": ["PositionReport"],
    }

    cache = load_cache()
    total_messages = 0
    vessels_printed = 0

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
                    cog  = float(
                        position.get("Cog", position.get("TrueHeading", 0)) or 0
                    )
                    ts   = metadata.get("time_utc", datetime.now(timezone.utc).isoformat())

                    if not mmsi:
                        continue

                    port = identify_port(lat, lon)
                    if not port:
                        continue

                    # No tanker filtering — include all vessels; store last fix for maps/UI
                    update_cache(cache, port, mmsi, name, ts, sog, lat, lon, cog)
                    total_messages += 1

                    # Print first N vessels for debug
                    if vessels_printed < debug_count:
                        print(f"[{total_messages}] {name or 'UNKNOWN'} | MMSI: {mmsi} | "
                              f"Port: {port} | Lat: {lat:.4f} Lon: {lon:.4f} | SOG: {sog}")
                        vessels_printed += 1
                        if vessels_printed == debug_count:
                            print("\n--- First 10 vessels printed. Continuing to accumulate cache ---\n")

                    # Periodically save cache
                    if total_messages % 50 == 0:
                        save_cache(cache)
                        print(f"{total_messages} messages processed. Cache saved.")

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
    asyncio.run(stream_ais_all())