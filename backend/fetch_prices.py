import json
import os
from http.client import responses

import requests
from datetime import datetime, timezone, timedelta

# todo: make place dynamic??
LAT = 51.3552
LNG = 11.9961
RADIUS = 5
FUEL_TYPE = "all" # e5, e10, diesel, or all
OUTPUT_DIR = "data"
OUTPUT_FILE = os.path.join(OUTPUT_DIR, "prices.json")
STATIONS_INFO_FILE = os.path.join(OUTPUT_DIR, "stations.json")

# todo: get AIP-KEY
API_KEY = os.getenv("TANKERKOENIG_API_KEY")

if not API_KEY:
    raise ValueError("TANKERKOENIG_API_KEY not set")

def get_station_infos(station_ids):
    ids_str = ",".join(station_ids)
    url = f"https://creativecommons.tankerkoenig.de/json/detail.php?ids[]={ids_str}&apikey={API_KEY}"

    try:
        response = requests.get(url)
        response.raise_for_status()
        data = response.json()

        if data.get("status") == "ok":
            station_details = {s["id"]: s for s in data["stations"]}
            os.makedirs(OUTPUT_DIR, exist_ok=True)
            with open(STATIONS_INFO_FILE, "w", encoding="utf-8") as f:
                json.dump(station_details, f, indent=2, ensure_ascii=False)
            print(f"{len(station_details)} Station information saved in {STATIONS_INFO_FILE}.")
            return station_details
        else:
            print(f"Error trying to access station infos: {data.get('message')}")
            return None
    except requests.exceptions.RequestException as e:
        print(f"Network error trying to access station infos: {e}")
        return None


def fetch_prices():
    list_url = f"https://creativecommons.tankerkoenig.de/json/list.php?lat={LAT}&lng={LNG}&rad={RADIUS}&sort=dist&type={FUEL_TYPE}&apikey={API_KEY}"

    try:
        response = requests.get(list_url)
        response.raise_for_status()
        list_data = response.json()

        if not list_data.get("ok") or not list_data.get("stations"):
            print(f"Error or no stations found: {list_data.get('message')}")
            return

        station_ids = [station["id"] for station in list_data["stations"]]
        print(f"{len(station_ids)} found station in area.")

        if not os.path.exists(STATIONS_INFO_FILE):
            get_station_infos(station_ids)

        ids_str = ",".join(station_ids)
        prices_url =  f"https://creativecommons.tankerkoenig.de/json/prices.php?ids[]={ids_str}&apikey={API_KEY}"

        prices_response = requests.get(prices_url)
        prices_response.raise_for_status()
        price_data = prices_response.json()

        if not price_data.get("ok"):
            print(f"Error trying to access prices: {price_data.get('message')}")
            return

        os.makedirs(OUTPUT_DIR, exist_ok=True)

        try:
            with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
                history = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            history = []

        timestamp = datetime.now(timezone.utc).timestamp()

        new_entry = {
            "timestamp": timestamp,
            "prices": price_data.get("prices", {})
        }

        history.append(new_entry)

        # delete old data -> timeframes (idk if good idea)
        timeframe = datetime.now(timezone.utc) - timedelta(days=14)
        history_filtered = [
            entry for entry in history
            if datetime.fromisoformat(entry["timestamp"]) > timeframe
        ]

        with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
            json.dump(history_filtered, f, indent=2)

        print(f"Successfully fetched prices at {timestamp} and saved in {OUTPUT_FILE}.")

    except requests.exceptions.RequestException as e:
        print(f"Network error: {e}")
    except Exception as e:
        print(f"Unexpected error: {e}")


if __name__ == "__main__":
    from datetime import timedelta
    fetch_prices()