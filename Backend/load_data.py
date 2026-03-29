import urllib.request
import zipfile
import os
import csv
from datetime import date, timedelta
from pathlib import Path

BASE = "https://coast.noaa.gov/htdata/CMSP/AISDataHandler/2024"
OUT = Path("ais_tankers")
OUT.mkdir(exist_ok=True)

# Tanker vessel type codes (80-89 = tankers per AIS standard)
TANKER_TYPES = set(range(80, 90))

# Target port bounding boxes [min_lon, max_lon, min_lat, max_lat]
PORTS = {
    "houston":      [-95.4, -94.7, 29.4, 29.9],
    "loop":         [-91.0, -90.4, 28.7, 29.1],
    "nynj":         [-74.3, -73.8, 40.4, 40.8],
    "la_longbeach": [-118.4, -117.9, 33.6, 34.0],
    "corpus":       [-97.5, -97.1, 27.7, 28.0],
}

def in_port(lat, lon):
    for port, (min_lon, max_lon, min_lat, max_lat) in PORTS.items():
        if min_lon <= lon <= max_lon and min_lat <= lat <= max_lat:
            return port
    return None

d = date(2024, 1, 1)

while d.year == 2024:
    fname = f"AIS_{d.strftime('%Y_%m_%d')}.zip"
    url = f"{BASE}/{fname}"
    zip_path = Path(fname)
    out_csv = OUT / f"tankers_{d}.csv"

    if out_csv.exists():
        print(f"Skipping {d} (already done)")
        d += timedelta(days=1)
        continue

    print(f"Downloading {fname}...")
    try:
        urllib.request.urlretrieve(url, zip_path)

        rows = []
        with zipfile.ZipFile(zip_path, 'r') as z:
            for name in z.namelist():
                with z.open(name) as f:
                    reader = csv.DictReader(
                        line.decode('utf-8') for line in f
                    )
                    for row in reader:
                        try:
                            vtype = int(float(row.get('VesselType', 0) or 0))
                            lat   = float(row.get('LAT', 0) or 0)
                            lon   = float(row.get('LON', 0) or 0)
                        except ValueError:
                            continue

                        if vtype in TANKER_TYPES:
                            port = in_port(lat, lon)
                            if port:
                                row['port'] = port
                                rows.append(row)

        zip_path.unlink()  # delete zip immediately

        if rows:
            with open(out_csv, 'w', newline='') as f:
                writer = csv.DictWriter(f, fieldnames=rows[0].keys())
                writer.writeheader()
                writer.writerows(rows)
            print(f"  Saved {len(rows)} tanker rows -> {out_csv}")
        else:
            print(f"  No tanker rows found for {d}")

    except Exception as e:
        if zip_path.exists():
            zip_path.unlink()
        print(f"  FAILED: {e}")

    d += timedelta(days=1)

print("All done!")