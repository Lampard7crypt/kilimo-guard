import logging
from typing import Any, Dict
import httpx

log = logging.getLogger(__name__)

# Coordinates for major Kenyan farming counties
KENYA_COUNTY_COORDINATES = {
    "Nakuru": {"lat": -0.3031, "lon": 36.0800},
    "Nairobi": {"lat": -1.2921, "lon": 36.8219},
    "Kiambu": {"lat": -1.1714, "lon": 36.8356},
    "Uasin Gishu": {"lat": 0.5143, "lon": 35.2698},
    "Trans Nzoia": {"lat": 1.0157, "lon": 35.0062},
    "Meru": {"lat": 0.0463, "lon": 37.6559},
    "Nyeri": {"lat": -0.4201, "lon": 36.9476},
    "Machakos": {"lat": -1.5177, "lon": 37.2634},
    "Kirinyaga": {"lat": -0.5000, "lon": 37.2800},
    "Kisumu": {"lat": -0.0917, "lon": 34.7680},
    "Kakamega": {"lat": 0.2827, "lon": 34.7519},
    "Bungoma": {"lat": 0.5695, "lon": 34.5584},
    "Narok": {"lat": -1.0833, "lon": 35.8667},
    "Nyandarua": {"lat": -0.3000, "lon": 36.5000},
    "Murang'a": {"lat": -0.7167, "lon": 37.1500},
    "Kilifi": {"lat": -3.6305, "lon": 39.8499},
    "Mombasa": {"lat": -4.0435, "lon": 39.6682},
    "Kericho": {"lat": -0.3689, "lon": 35.2863},
    "Bomet": {"lat": -0.7813, "lon": 35.3416},
    "Embu": {"lat": -0.5333, "lon": 37.4500},
    "Kitui": {"lat": -1.3667, "lon": 38.0167},
    "Makueni": {"lat": -1.8000, "lon": 37.6333},
    "Laikipia": {"lat": 0.3606, "lon": 36.7820},
}


def get_weather_advisory(temp: float, humidity: float, rain_prob: int, wind_speed: float) -> Dict[str, str]:
    """Generate localized agronomic recommendations based on atmospheric metrics."""
    advice_items = []

    if wind_speed > 18:
        advice_items.append("High winds (>18 km/h): Avoid spraying pesticides or foliage feed to prevent chemical drift.")
    elif rain_prob < 30 and wind_speed < 12:
        advice_items.append("Optimal window for foliar spraying and agrochemical applications.")

    if rain_prob > 60:
        advice_items.append("Rain expected: Delay top-dressing fertilizer (e.g. CAN/Urea) to minimize nutrient leaching.")
    elif rain_prob < 20 and temp > 24:
        advice_items.append("Dry conditions: Excellent window for weeding, solarization, and field drying of harvested grain.")

    if humidity > 80:
        advice_items.append("High humidity alert: Elevated risk for fungal blight and powdery mildew. Monitor tomato and potato canopies.")

    return {
        "summary": " ".join(advice_items) if advice_items else "Standard conditions: Continue regular farm management and crop scouting.",
        "spraying_suitability": "Good" if wind_speed <= 15 and rain_prob <= 35 else "Poor (Risk of drift or rain wash)",
        "fungal_risk": "High" if humidity >= 80 else ("Moderate" if humidity >= 65 else "Low"),
    }


def get_seasonal_climate_outlook(county: str = "Nakuru") -> Dict[str, Any]:
    """Generate multi-month seasonal agro-climatic projection for Kenyan counties."""
    import datetime

    today = datetime.date.today()
    month = today.month

    # Kenyan agro-ecological calendar mapping
    month_names = ["January", "February", "March", "April", "May", "June",
                   "July", "August", "September", "October", "November", "December"]

    # Determine seasonal cycle
    if month in (3, 4, 5):
        season_title = "Long Rains (MAM) Main Cropping Cycle"
        season_phase = "Active Vegetative & Reproductive Phase"
        soil_moisture = "82% (High Saturation)"
        climate_risk = "Moderate (Waterlogging in heavy clay soils)"
    elif month in (6, 7, 8):
        season_title = "Post-Rains Cool & Maturation Season"
        season_phase = "Grain Filling, Maturation & Solar Weeding"
        soil_moisture = "64% (Adequate Subsoil Moisture)"
        climate_risk = "Low Risk (Favorable grain drying)"
    elif month in (9, 10, 11, 12):
        season_title = "Short Rains (OND) Cropping Season"
        season_phase = "Legumes, Horticultural & Short-Cycle Grain Window"
        soil_moisture = "74% (Optimal Field Capacity)"
        climate_risk = "Low Risk (Reliable precipitation across Rift & Central)"
    else:
        season_title = "Warm Dry & Land Preparation Season"
        season_phase = "Harvesting, Threshing & Pre-Season Land Tillage"
        soil_moisture = "48% (Depleting Surface Moisture)"
        climate_risk = "Elevated Moisture Stress (Irrigation advised for horticulture)"

    # Build next 3 months projections
    next_months = []
    for offset in range(1, 4):
        next_m_idx = (month - 1 + offset) % 12
        m_name = month_names[next_m_idx]
        year = today.year + ((month - 1 + offset) // 12)

        if next_m_idx in (2, 3, 4):  # MAM
            rainfall = "160 - 240 mm (High)"
            temp_range = "14°C - 24°C"
            task = "Planting, basal fertilizer application (DAP/NPK), and first weeding at 2-3 weeks."
        elif next_m_idx in (5, 6, 7):  # JJA
            rainfall = "40 - 75 mm (Low-Moderate)"
            temp_range = "11°C - 22°C"
            task = "Top-dressing with CAN, fungal scouting in cool mornings, and inter-row weeding."
        elif next_m_idx in (8, 9, 10, 11):  # SOND
            rainfall = "110 - 180 mm (Moderate)"
            temp_range = "13°C - 25°C"
            task = "Second crop planting (beans/potatoes), foliar booster sprays, and insect pest trapping."
        else:  # JF
            rainfall = "15 - 35 mm (Dry)"
            temp_range = "15°C - 28°C"
            task = "Deep plowing, farmyard manure incorporation, and acquiring certified hybrid seed."

        next_months.append({
            "month": f"{m_name} {year}",
            "rainfall_expectation": rainfall,
            "temp_range": temp_range,
            "field_activity": task,
        })

    return {
        "season_title": season_title,
        "season_phase": season_phase,
        "soil_moisture": soil_moisture,
        "climate_risk": climate_risk,
        "projection_window": f"{next_months[0]['month']} to {next_months[-1]['month']}",
        "months": next_months,
    }


def get_county_weather(county: str = "Nakuru") -> Dict[str, Any]:
    """Fetch real-time weather and forecast for any Kenyan county from Open-Meteo."""
    coords = KENYA_COUNTY_COORDINATES.get(county, KENYA_COUNTY_COORDINATES["Nakuru"])
    url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": coords["lat"],
        "longitude": coords["lon"],
        "current": "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m",
        "daily": "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max",
        "timezone": "Africa/Nairobi",
    }

    seasonal_outlook = get_seasonal_climate_outlook(county)

    try:
        with httpx.Client(timeout=8.0) as client:
            resp = client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()

        current = data.get("current", {})
        daily = data.get("daily", {})

        temp = current.get("temperature_2m", 22.0)
        humidity = current.get("relative_humidity_2m", 65.0)
        wind_speed = current.get("wind_speed_10m", 10.0)
        rain_prob = daily.get("precipitation_probability_max", [20])[0] if daily.get("precipitation_probability_max") else 20
        temp_max = daily.get("temperature_2m_max", [25.0])[0] if daily.get("temperature_2m_max") else 25.0
        temp_min = daily.get("temperature_2m_min", [14.0])[0] if daily.get("temperature_2m_min") else 14.0

        advisory = get_weather_advisory(temp, humidity, rain_prob, wind_speed)

        return {
            "county": county,
            "temperature": temp,
            "humidity": humidity,
            "wind_speed": wind_speed,
            "rain_probability": rain_prob,
            "temp_max": temp_max,
            "temp_min": temp_min,
            "advisory": advisory["summary"],
            "spraying_suitability": advisory["spraying_suitability"],
            "fungal_risk": advisory["fungal_risk"],
            "seasonal_outlook": seasonal_outlook,
            "is_live": True,
        }
    except Exception as exc:
        log.warning("Could not reach Open-Meteo API for county %s: %s", county, exc)
        advisory = get_weather_advisory(23.0, 65.0, 25, 11.0)
        return {
            "county": county,
            "temperature": 23.0,
            "humidity": 65.0,
            "wind_speed": 11.0,
            "rain_probability": 25,
            "temp_max": 26.0,
            "temp_min": 14.0,
            "advisory": advisory["summary"],
            "spraying_suitability": advisory["spraying_suitability"],
            "fungal_risk": advisory["fungal_risk"],
            "seasonal_outlook": seasonal_outlook,
            "is_live": False,
        }

