# 🌱 KilimoGuard — AI Agricultural Copilot & Digital Ledger

[![DigitalOcean](https://img.shields.io/badge/DigitalOcean-App_Platform_%26_Spaces-0080FF?logo=digitalocean&logoColor=white)](https://www.digitalocean.com)
[![Google Gemma](https://img.shields.io/badge/Google_Gemma-4--26B_%26_4--31B-4285F4?logo=google&logoColor=white)](https://ai.google.dev/gemma)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Python 3.13](https://img.shields.io/badge/Python-3.13+-3776AB?logo=python&logoColor=white)](https://www.python.org)
[![Tests](https://img.shields.io/badge/Tests-16_Passed_100%25-brightgreen)](tests/)

**KilimoGuard** is an AI-powered agricultural copilot and digital ledger tailored for Kenyan smallholder farmers. Powered by **Google Gemma** and built natively for **DigitalOcean cloud infrastructure**, KilimoGuard empowers farmers to diagnose crop diseases, log sales conversationally in English, Swahili, or Sheng, audit agrovet receipts, evaluate trader deals against live Kenyan wholesale market benchmarks, and track farm profitability.

---

## 🚀 Key Features

### 1. 🔬 Multimodal Crop Disease Diagnosis
* **Visual Foliage Analysis**: Farmers photograph affected leaves, fruits, or stems.
* **Gemma Plant Pathologist**: Identifies crop species, disease, and confidence level.
* **Kenyan Agronomy Prescriptions**: Recommends organic remedies (ash, neem, rogueing) and agrochemical treatments approved in Kenya (e.g., Mancozeb, Ridomil Gold, Duduthrin).
* **Audio Voice Output**: Browser Text-to-Speech reads the diagnosis and prescription aloud in the field.
* **Cloud Storage**: Photographs are permanently archived to **DigitalOcean Spaces**.

### 2. 🎙️ Voice & Sales Chat (English, Kiswahili & Sheng)
* **Conversational Sales Logging**: Farmers can speak or type natural sentences like:
  * *"Nimeuza gunia 10 za viazi kwa 3,500 kila moja"* (Swahili)
  * *"Sold 20 crates of tomatoes at 5,000 each to Wakulima trader"* (English)
* **Autonomous Structuring**: Gemma parses commodity, quantity, unit price, total, and buyer.
* **Ledger Action Center**: Displays a structured preview with one-click acceptance into the farmer's ledger.

### 3. ⚖️ Kenya Market Intelligence & Deal Evaluator
* **Live Wholesale Benchmarks**: Pre-seeded pricing covering 26 commodity bands across major Kenyan hubs:
  * **Nairobi**: Wakulima Market & City Market
  * **Mombasa**: Kongowea Market
  * **Rift Valley**: Nakuru Top Market & Eldoret Market
  * **Western / Nyanza**: Kisumu Jubilee Market
  * **Central**: Murang'a Farm Gate
* **Deal Evaluator**: Instantly flags whether a broker's offer is **fair**, **above market**, or **below market** with percentage variance.

### 4. 🧾 Agrovet Expense Receipt Scanner
* **Paper Receipt Audit**: Scans receipts for fertilizer (DAP, CAN, Urea), certified seeds, agrochemicals, and tractor hire.
* **OCR & Item Extraction**: Gemma extracts vendor, date, line items, and total amount.
* **Ledger Integration**: Adds verified farm costs to the expense ledger.

### 5. 🌦️ Localized Weather & Agronomic Advisories
* **County-Level Precision**: Real-time meteorological data across 23+ Kenyan farming counties via Open-Meteo.
* **Agronomy Advisory Engine**: Generates real-time advice on spraying windows (wind/drift checks), fungal blight alerts (humidity checks), and fertilizer top-dressing timing (rainfall probability).

### 6. 📖 Digital Financial Ledger
* Real-time cash flow overview: **Total Revenue**, **Farm Expenses**, and **Net Profit Margin**.
* Transaction filtering by Income / Expense with receipt proof links.

---

## 🏗️ Architecture & DigitalOcean Integration

```mermaid
graph TD
    User([Farmer Browser / Mobile]) -->|HTTPS| Web[FastAPI Web Server<br/>DigitalOcean App Platform]
    
    subgraph DigitalOcean Cloud
        Web -->|CRUD & Relations| DB[(DigitalOcean Managed<br/>PostgreSQL 16)]
        Web -->|boto3 S3 API| Spaces[DigitalOcean Spaces<br/>Object Storage: Scans & Receipts]
    end

    subgraph Google GenAI
        Web -->|gemma-4-26b-a4b-it<br/>fallback: gemma-4-31b-it| Gemma[Google Gemma AI<br/>Multimodal & Text]
    end

    subgraph External APIs
        Web -->|Geo Weather Forecast| Meteo[Open-Meteo API]
    end
```

### DigitalOcean Components:
1. **App Platform (`.do/app.yaml`)**: Zero-downtime deployment, auto-scaling, and health check monitoring on `/health`.
2. **Managed PostgreSQL**: Relational persistence for farmer profiles, transactions, diagnoses, and market benchmarks.
3. **Spaces (Object Storage)**: S3-compatible cloud storage for crop leaf photos and agrovet receipts with CDN delivery.

---

## 🛠️ Configuration & API Keys

KilimoGuard is configured via environment variables in `.env` (see `.env.example`):

| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `GEMINI_API_KEY` | Google Gemini API key for Gemma inference | Get from [Google AI Studio](https://aistudio.google.com/apikey) |
| `GEMMA_MODELS` | Preferred and fallback Gemma models | `gemma-4-26b-a4b-it,gemma-4-31b-it` |
| `DATABASE_URL` | DigitalOcean PostgreSQL connection string (falls back to local SQLite if empty) | `postgresql://user:pass@host:25060/db?sslmode=require` |
| `DO_SPACES_KEY` | DigitalOcean Spaces Access Key | Spaces API key from DO Console |
| `DO_SPACES_SECRET` | DigitalOcean Spaces Secret Key | Spaces secret from DO Console |
| `DO_SPACES_BUCKET` | Spaces bucket name | `kilimo-guard-storage` |
| `DO_SPACES_REGION` | DigitalOcean Spaces datacenter region | `nyc3` |
| `DO_SPACES_ENDPOINT`| DigitalOcean Spaces S3 endpoint URL | `https://nyc3.digitaloceanspaces.com` |

> **Graceful Fallback**: If DigitalOcean credentials are not provided in your local environment, KilimoGuard automatically falls back to an embedded SQLite database (`kilimoguard.db`) and local filesystem storage (`uploads/`).

---

## 💻 Quickstart (Local Development)

### 1. Clone & Set Up Environment
```bash
git clone https://github.com/your-username/kilimo-guard.git
cd kilimo-guard

# Create and activate virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env and ensure GEMINI_API_KEY is populated
```

### 3. Run the Development Server
```bash
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
Open **[http://localhost:8000](http://localhost:8000)** in your browser.

---

## 🧪 Automated Testing

KilimoGuard includes a full `pytest` suite testing all endpoints, error handling, mock Gemma responses, and ledger logic:

```bash
pytest -v
```

Expected output:
```
tests/test_api.py::test_health_check PASSED
tests/test_api.py::test_get_counties PASSED
tests/test_api.py::test_market_prices PASSED
tests/test_api.py::test_market_compare_deal_evaluator PASSED
tests/test_api.py::test_weather_advisory PASSED
tests/test_chat_and_scan.py::test_chat_message_sale_detection PASSED
tests/test_chat_and_scan.py::test_disease_scan_upload PASSED
tests/test_chat_and_scan.py::test_receipt_scan_upload PASSED
tests/test_gemma.py::test_extract_json_plain PASSED
tests/test_gemma.py::test_extract_json_markdown_fence PASSED
tests/test_gemma.py::test_ask_gemma_success PASSED
tests/test_gemma.py::test_ask_gemma_retry_on_transient PASSED
tests/test_gemma.py::test_ask_gemma_model_fallback PASSED
tests/test_gemma.py::test_ask_gemma_json PASSED
tests/test_ledger.py::test_farmer_profile_create_and_fetch PASSED
tests/test_ledger.py::test_ledger_transactions_and_summary PASSED

16 passed in 2.04s
```

---

## 🚢 DigitalOcean Production Deployment

### Option A: DigitalOcean App Platform (Recommended)
1. Push this repository to GitHub or GitLab.
2. In the [DigitalOcean Cloud Console](https://cloud.digitalocean.com/apps), click **Create App**.
3. Choose your repository and branch.
4. DigitalOcean App Platform will automatically detect the app specification at [`.do/app.yaml`](.do/app.yaml).
5. Add your `GEMINI_API_KEY`, `DO_SPACES_KEY`, and `DO_SPACES_SECRET` in the Environment Variables tab as encrypted secrets.
6. Click **Deploy**.

### Option B: Docker Compose
```bash
docker compose up -d --build
```
KilimoGuard will launch with PostgreSQL 16 on port 8000.
