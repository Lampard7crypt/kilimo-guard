def test_health_check(client):
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "KilimoGuard"
    assert "models" in data
    assert "gemma-4-26b-a4b-it" in data["models"]


def test_get_counties(client):
    response = client.get("/api/counties")
    assert response.status_code == 200
    counties = response.json()
    assert isinstance(counties, list)
    assert len(counties) >= 47
    assert "Nakuru" in counties
    assert "Nairobi" in counties
    assert "Uasin Gishu" in counties


def test_market_prices(client):
    response = client.get("/api/market/prices")
    assert response.status_code == 200
    prices = response.json()
    assert isinstance(prices, list)
    assert len(prices) >= 20

    # Filter by commodity
    response_maize = client.get("/api/market/prices?commodity=Maize")
    assert response_maize.status_code == 200
    maize_prices = response_maize.json()
    assert len(maize_prices) >= 1
    for p in maize_prices:
        assert "Maize" in p["commodity"]


def test_market_compare_deal_evaluator(client):
    # Test above market deal
    payload_high = {
        "commodity": "Maize (Dry)",
        "unit_price": 5000.0,
        "unit": "90kg bag",
        "county": "Nakuru",
    }
    res_high = client.post("/api/market/compare", json=payload_high)
    assert res_high.status_code == 200
    data_high = res_high.json()
    assert data_high["has_benchmark"] is True
    assert data_high["status"] == "above_market"
    assert "Great deal" in data_high["message"]

    # Test below market deal
    payload_low = {
        "commodity": "Maize (Dry)",
        "unit_price": 1800.0,
        "unit": "90kg bag",
        "county": "Nakuru",
    }
    res_low = client.post("/api/market/compare", json=payload_low)
    assert res_low.status_code == 200
    data_low = res_low.json()
    assert data_low["has_benchmark"] is True
    assert data_low["status"] == "below_market"
    assert "Caution" in data_low["message"]


def test_weather_advisory(client):
    response = client.get("/api/weather?county=Nakuru")
    assert response.status_code == 200
    data = response.json()
    assert data["county"] == "Nakuru"
    assert "temperature" in data
    assert "advisory" in data
    assert "spraying_suitability" in data
    assert "fungal_risk" in data
