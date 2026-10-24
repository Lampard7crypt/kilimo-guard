def test_farmer_profile_create_and_fetch(client):
    # Register a new farmer
    payload = {
        "name": "Wanjiku Kamau",
        "phone": "0799887766",
        "county": "Uasin Gishu",
        "primary_crop": "Wheat",
    }
    create_res = client.post("/api/farmer/profile", json=payload)
    assert create_res.status_code == 200
    farmer_data = create_res.json()
    assert farmer_data["id"] > 0
    assert farmer_data["name"] == "Wanjiku Kamau"
    assert farmer_data["county"] == "Uasin Gishu"

    # Fetch profile snapshot
    fetch_res = client.get(f"/api/farmer/{farmer_data['id']}")
    assert fetch_res.status_code == 200
    snapshot = fetch_res.json()
    assert snapshot["name"] == "Wanjiku Kamau"
    assert snapshot["financial_summary"]["total_income_kes"] == 0
    assert snapshot["financial_summary"]["total_expense_kes"] == 0


def test_ledger_transactions_and_summary(client):
    # 1. Register farmer
    farmer_res = client.post(
        "/api/farmer/profile",
        json={"name": "Kipchoge", "phone": "0711223344", "county": "Nandi", "primary_crop": "Tea"},
    )
    farmer_id = farmer_res.json()["id"]

    # 2. Add an income transaction (Crop Sale)
    sale_payload = {
        "farmer_id": farmer_id,
        "transaction_type": "income",
        "category": "Crop Sale",
        "commodity": "Maize (Dry)",
        "quantity": 10,
        "unit": "90kg bag",
        "unit_price": 3500.0,
        "total_amount": 35000.0,
        "counterparty": "Wakulima Wholesaler",
        "notes": "Delivered to Eldoret",
    }
    income_res = client.post("/api/ledger/accept", json=sale_payload)
    assert income_res.status_code == 200
    income_tx = income_res.json()["transaction"]
    assert income_tx["total_amount"] == 35000.0
    sale_id = income_tx["id"]

    # 3. Add an expense transaction (Agrovet Purchase)
    expense_payload = {
        "farmer_id": farmer_id,
        "transaction_type": "expense",
        "category": "Fertilizer",
        "commodity": "DAP Fertilizer (50kg)",
        "quantity": 2,
        "unit": "bags",
        "unit_price": 4500.0,
        "total_amount": 9000.0,
        "counterparty": "Kenya Seed Agrovet",
        "notes": "Planting fertilizer",
    }
    expense_res = client.post("/api/ledger/accept", json=expense_payload)
    assert expense_res.status_code == 200
    expense_tx = expense_res.json()["transaction"]
    assert expense_tx["total_amount"] == 9000.0
    expense_id = expense_tx["id"]

    # 4. Fetch summary
    summary_res = client.get(f"/api/ledger/summary?farmer_id={farmer_id}")
    assert summary_res.status_code == 200
    summary = summary_res.json()
    assert summary["total_income_kes"] == 35000.0
    assert summary["total_expense_kes"] == 9000.0
    assert summary["net_profit_kes"] == 26000.0
    assert summary["total_transactions"] == 2
    assert "Fertilizer" in summary["expense_breakdown"]

    # 5. Filter transactions by type
    filtered_res = client.get(f"/api/ledger/transactions?farmer_id={farmer_id}&transaction_type=income")
    assert filtered_res.status_code == 200
    txs = filtered_res.json()
    assert len(txs) == 1
    assert txs[0]["commodity"] == "Maize (Dry)"

    # 6. Delete a transaction
    del_res = client.delete(f"/api/ledger/transaction/{expense_id}")
    assert del_res.status_code == 200

    # Verify updated summary
    summary_after_del = client.get(f"/api/ledger/summary?farmer_id={farmer_id}").json()
    assert summary_after_del["total_expense_kes"] == 0.0
    assert summary_after_del["net_profit_kes"] == 35000.0


def test_generate_trust_index(client):
    from unittest.mock import patch
    from app.services.gemma import Answer

    # Create farmer with multiple crops & SACCO
    create_res = client.post(
        "/api/farmer/profile",
        json={
            "name": "David Koech",
            "phone": "0722001122",
            "county": "Kericho",
            "sub_county": "Bureti",
            "primary_crop": "Tea",
            "crops": ["Tea", "Maize", "Dairy"],
            "farm_size_acres": 4.5,
            "is_sacco_member": "yes",
            "sacco_name": "Bomet Tea Farmers SACCO",
            "sacco_member_id": "BT-8890",
        },
    )
    farmer_id = create_res.json()["id"]

    mock_trust_data = {
        "score": 755,
        "grade": "A",
        "risk_level": "Low Risk",
        "max_recommended_credit_kes": 180000.0,
        "repayment_capacity": "Strong",
        "financial_health_summary": "Excellent operational track record with verified SACCO membership and strong tea cash flows.",
        "key_strengths": ["Active member of Bomet Tea Farmers SACCO", "Diversified crop mix (Tea, Maize, Dairy)", "4.5 Acre commercial scale"],
        "risk_factors": ["Vulnerability to dry season tea flush drops"],
        "recommendations_for_sacco": "Approved for up to KES 180,000 seasonal input financing.",
        "agronomic_resilience": "High resilience through multi-enterprise farm setup."
    }
    mock_ans = Answer(text="raw json", model="gemma-4-26b-a4b-it", attempts=1)

    with patch("app.routes.auth.ask_gemma_json", return_value=(mock_trust_data, mock_ans)):
        res = client.post(f"/api/farmer/{farmer_id}/trust-index")
        assert res.status_code == 200
        data = res.json()
        assert data["score"] == 755
        assert data["grade"] == "A"
        assert data["risk_level"] == "Low Risk"
        assert data["max_recommended_credit_kes"] == 180000.0
        assert "Bomet Tea Farmers SACCO" in data["key_strengths"][0]

    # Verify cached retrieval via GET
    get_res = client.get(f"/api/farmer/{farmer_id}/trust-index")
    assert get_res.status_code == 200
    cached = get_res.json()
    assert cached["has_score"] is True
    assert cached["score"] == 755
    assert cached["grade"] == "A"


def test_record_transaction_via_transaction_endpoint(client):
    """Ensure POST /api/ledger/transaction successfully records an income/expense transaction."""
    farmer_res = client.post(
        "/api/farmer/profile",
        json={"name": "Mutua", "phone": "0722334455", "county": "Machakos", "primary_crop": "Mangoes"},
    )
    farmer_id = farmer_res.json()["id"]

    payload = {
        "farmer_id": farmer_id,
        "transaction_type": "income",
        "category": "Produce Sale",
        "commodity": "Apple Mangoes",
        "quantity": 50,
        "unit": "cartons",
        "unit_price": 800.0,
        "total_amount": 40000.0,
        "counterparty": "Wakulima Trader",
        "notes": "Logged conversationally via Kilimo AI Copilot",
    }
    res = client.post("/api/ledger/transaction", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert data["transaction"]["total_amount"] == 40000.0

