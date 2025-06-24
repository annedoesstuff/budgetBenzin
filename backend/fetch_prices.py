import json
import os
import requests
from datetime import datetime, timezone, timedelta

# # todo: make place dynamic??
LAT = 51.3552
LNG = 11.9961
RADIUS = 5
FUEL_TYPE = "all"  # e5, e10, diesel, oder all
OUTPUT_DIR = "data"
PRICES_HISTORY_FILE = os.path.join(OUTPUT_DIR, "prices.json")

API_KEY = os.getenv("TANKERKOENIG_API_KEY")

if not API_KEY:
    raise ValueError("Die Umgebungsvariable TANKERKOENIG_API_KEY ist nicht gesetzt.")


def fetch_prices():
    """
    Fetches the current fuel station prices (and station information) from the Tankerkönig API
    and stores them in a history file.
    """
    list_url = f"https://creativecommons.tankerkoenig.de/json/list.php?lat={LAT}&lng={LNG}&rad={RADIUS}&sort=dist&type={FUEL_TYPE}&apikey={API_KEY}"

    try:
        list_response = requests.get(list_url)
        list_response.raise_for_status()
        list_data = list_response.json()

        if not list_data.get("ok") or not list_data.get("stations"):
            print(f"Error or no station found: {list_data.get('message')}")
            return

        stations_from_list = list_data["stations"]
        station_ids = [station["id"] for station in stations_from_list]
        print(f"{len(station_ids)} stations found in area.")

        ids_str = ",".join(station_ids)
        prices_url = f"https://creativecommons.tankerkoenig.de/json/prices.php?ids={ids_str}&apikey={API_KEY}"

        prices_response = requests.get(prices_url)
        prices_response.raise_for_status()
        price_data = prices_response.json()

        if not price_data.get("ok"):
            print(f"Error trying to access price: {price_data.get('message')}")
            return

        prices_by_id = price_data.get("prices", {})
        stations_info_map = {station['id']: station for station in stations_from_list}

        for station_id, prices in prices_by_id.items():
            if station_id in stations_info_map:
                stations_info_map[station_id].update(prices)

        os.makedirs(OUTPUT_DIR, exist_ok=True)
        history = []
        try:
            with open(PRICES_HISTORY_FILE, "r", encoding="utf-8") as f:
                history = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            print("No history found. Creating new file.")
            history = []

        timestamp_utc = datetime.now(timezone.utc)
        new_entry = {
            "timestamp": timestamp_utc.isoformat(),
            "stations": list(stations_info_map.values())
        }

        history.append(new_entry)

        # delete old data -> timeframes (idk if good idea)
        timeframe = timestamp_utc - timedelta(days=14)
        history_filtered = [
            entry for entry in history
            if datetime.fromisoformat(entry["timestamp"]) > timeframe
        ]

        with open(PRICES_HISTORY_FILE, "w", encoding="utf-8") as f:
            json.dump(history_filtered, f, indent=2, ensure_ascii=False)

        print(f"Fetched price successfully at {timestamp_utc.isoformat()} and saved in {PRICES_HISTORY_FILE}.")

    except requests.exceptions.RequestException as e:
        print(f"Network error: {e}")
    except Exception as e:
        print(f"Unexpected error: {e}")


if __name__ == "__main__":
    fetch_prices()
