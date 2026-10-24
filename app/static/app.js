// KilimoGuard Client Application

let currentFarmer = {
  id: 1,
  name: "Peter Mwangi",
  phone: "0712345678",
  county: "Nakuru",
  primary_crop: "Maize",
};

let diseaseSelectedFile = null;
let receiptSelectedFile = null;
let speechRecognition = null;
let isRecording = false;
let allMarketPrices = [];

// Initialize application on DOM load
document.addEventListener("DOMContentLoaded", async () => {
  loadFarmerFromStorage();
  await loadCounties();
  await registerOrLoginFarmer();
  loadDashboardData();
  loadMarketPrices();
  initSpeechRecognition();
});

// Storage & Farmer Profile
function loadFarmerFromStorage() {
  const saved = localStorage.getItem("kilimoguard_farmer");
  if (saved) {
    try {
      currentFarmer = JSON.parse(saved);
    } catch (e) {
      console.warn("Could not parse saved farmer profile:", e);
    }
  }
  updateFarmerUI();
}

function updateFarmerUI() {
  document.getElementById("farmerBadgeName").innerText = currentFarmer.name || "Mkulima";
  document.getElementById("farmerBadgeCounty").innerText = currentFarmer.county || "Nakuru";
  document.getElementById("dashWeatherCounty").innerText = currentFarmer.county || "Nakuru";
  document.getElementById("farmerAvatar").innerText = (currentFarmer.name || "M").charAt(0).toUpperCase();

  document.getElementById("profileName").value = currentFarmer.name || "";
  document.getElementById("profilePhone").value = currentFarmer.phone || "";
  document.getElementById("profileCounty").value = currentFarmer.county || "Nakuru";
  document.getElementById("profileCrop").value = currentFarmer.primary_crop || "";
}

async function loadCounties() {
  try {
    const res = await fetch("/api/counties");
    const counties = await res.json();
    const select = document.getElementById("profileCounty");
    select.innerHTML = "";
    counties.forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c;
      opt.innerText = c;
      select.appendChild(opt);
    });
    if (currentFarmer.county) {
      select.value = currentFarmer.county;
    }
  } catch (err) {
    console.error("Error loading counties:", err);
  }
}

async function registerOrLoginFarmer() {
  try {
    const res = await fetch("/api/farmer/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(currentFarmer),
    });
    if (res.ok) {
      const data = await res.json();
      currentFarmer.id = data.id;
      localStorage.setItem("kilimoguard_farmer", JSON.stringify(currentFarmer));
      updateFarmerUI();
    }
  } catch (err) {
    console.error("Farmer login/sync failed:", err);
  }
}

async function saveProfile(e) {
  e.preventDefault();
  currentFarmer.name = document.getElementById("profileName").value.trim();
  currentFarmer.phone = document.getElementById("profilePhone").value.trim();
  currentFarmer.county = document.getElementById("profileCounty").value;
  currentFarmer.primary_crop = document.getElementById("profileCrop").value.trim();

  await registerOrLoginFarmer();
  closeProfileModal();
  loadDashboardData();
}

function openProfileModal() {
  document.getElementById("profileModal").classList.add("active");
}

function closeProfileModal() {
  document.getElementById("profileModal").classList.remove("active");
}

// Tab Switching
function switchTab(tabId) {
  const tabs = ["dashboard", "disease", "chat", "receipts", "ledger", "market"];
  tabs.forEach((t) => {
    const panel = document.getElementById(`panel${t.charAt(0).toUpperCase() + t.slice(1)}`);
    const btn = document.getElementById(`tabBtn${t.charAt(0).toUpperCase() + t.slice(1)}`);
    if (panel) panel.classList.remove("active");
    if (btn) btn.classList.remove("active");
  });

  const targetPanel = document.getElementById(`panel${tabId.charAt(0).toUpperCase() + tabId.slice(1)}`);
  const targetBtn = document.getElementById(`tabBtn${tabId.charAt(0).toUpperCase() + tabId.slice(1)}`);
  if (targetPanel) targetPanel.classList.add("active");
  if (targetBtn) targetBtn.classList.add("active");

  if (tabId === "dashboard") loadDashboardData();
  if (tabId === "ledger") loadLedgerTransactions();
  if (tabId === "market") loadMarketPrices();
}

// Dashboard & Weather
async function loadDashboardData() {
  loadLedgerSummary();
  loadWeather();
}

async function loadLedgerSummary() {
  try {
    const res = await fetch(`/api/ledger/summary?farmer_id=${currentFarmer.id}`);
    if (res.ok) {
      const data = await res.json();
      document.getElementById("kpiIncome").innerText = `KES ${data.total_income_kes.toLocaleString()}`;
      document.getElementById("kpiExpense").innerText = `KES ${data.total_expense_kes.toLocaleString()}`;
      const profitEl = document.getElementById("kpiProfit");
      profitEl.innerText = `KES ${data.net_profit_kes.toLocaleString()}`;
      profitEl.style.color = data.net_profit_kes >= 0 ? "var(--success)" : "var(--danger)";
    }
  } catch (err) {
    console.error("Failed to load ledger summary:", err);
  }
}

async function loadWeather() {
  const county = currentFarmer.county || "Nakuru";
  document.getElementById("dashWeatherCounty").innerText = county;
  try {
    const res = await fetch(`/api/weather?county=${encodeURIComponent(county)}`);
    if (res.ok) {
      const w = await res.json();
      document.getElementById("dashWeatherTemp").innerText = `${Math.round(w.temperature)}°C`;
      document.getElementById("dashWeatherRange").innerText = `Min ${Math.round(w.temp_min)}°C / Max ${Math.round(w.temp_max)}°C`;
      document.getElementById("dashWeatherRain").innerText = `${w.rain_probability}%`;
      document.getElementById("dashWeatherWind").innerText = `${w.wind_speed} km/h`;
      document.getElementById("dashWeatherHumidity").innerText = `${w.humidity}%`;
      document.getElementById("dashWeatherAdvisory").innerText = w.advisory;
    }
  } catch (err) {
    console.error("Failed to load weather:", err);
  }
}

// Speech Recognition & Voice Capabilities
function initSpeechRecognition() {
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRec) {
    console.warn("Web Speech API not supported in this browser. Chat text entry is available.");
    return;
  }

  speechRecognition = new SpeechRec();
  speechRecognition.continuous = false;
  speechRecognition.interimResults = false;
  // Swahili Kenya or English Kenya
  speechRecognition.lang = "sw-KE";

  speechRecognition.onstart = () => {
    isRecording = true;
    const btn = document.getElementById("voiceMicBtn");
    btn.classList.add("recording");
    btn.title = "Listening to your voice... Speak now";
  };

  speechRecognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    const input = document.getElementById("chatTextInput");
    input.value = transcript;
    // Auto-send voice input
    sendChatMessage();
  };

  speechRecognition.onerror = (event) => {
    console.warn("Speech recognition error:", event.error);
    stopVoiceInput();
  };

  speechRecognition.onend = () => {
    stopVoiceInput();
  };
}

function toggleVoiceInput() {
  if (!speechRecognition) {
    alert("Speech recognition is not supported in this browser. You can type in the chat box.");
    return;
  }
  if (isRecording) {
    speechRecognition.stop();
  } else {
    try {
      speechRecognition.start();
    } catch (e) {
      console.warn("Speech start error:", e);
    }
  }
}

function stopVoiceInput() {
  isRecording = false;
  const btn = document.getElementById("voiceMicBtn");
  if (btn) {
    btn.classList.remove("recording");
    btn.title = "Click to speak (English or Swahili)";
  }
}

function speakDiagnosis() {
  const diag = document.getElementById("resultDiagnosis").innerText;
  const crop = document.getElementById("resultCrop").innerText;
  const organic = document.getElementById("resultOrganic").innerText;
  const chemical = document.getElementById("resultChemical").innerText;

  const text = `${crop}. Diagnosed with ${diag}. Recommended organic treatment: ${organic}. Recommended agrovet chemical remedy: ${chemical}.`;
  speakText(text);
}

function speakText(text) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.95;
  window.speechSynthesis.speak(utterance);
}

// Conversational Chat & Sales Logging
function handleChatKeyPress(event) {
  if (event.key === "Enter") {
    sendChatMessage();
  }
}

async function sendChatMessage() {
  const input = document.getElementById("chatTextInput");
  const message = input.value.trim();
  if (!message) return;

  input.value = "";
  appendChatBubble("user", message);

  // Bot loading placeholder
  const loadingBubble = appendChatBubble("bot", "Thinking with Gemma... 🍃");

  const formData = new FormData();
  formData.append("message", message);
  formData.append("farmer_id", currentFarmer.id);

  try {
    const res = await fetch("/api/chat/message", {
      method: "POST",
      body: formData,
    });

    loadingBubble.remove();

    if (!res.ok) {
      appendChatBubble("bot", "Pole sana, error communicating with Gemma. Please try again.");
      return;
    }

    const data = await res.json();
    appendChatBubble("bot", data.reply_text);

    if (data.is_sale && data.draft_sale) {
      renderChatPendingSale(data.draft_sale, data.market_evaluation);
    }
  } catch (err) {
    loadingBubble.remove();
    appendChatBubble("bot", "Pole! Network failure. Please check your internet connection.");
  }
}

function appendChatBubble(sender, text) {
  const box = document.getElementById("chatMessages");
  const bubble = document.createElement("div");
  bubble.className = `chat-bubble ${sender}`;
  bubble.innerHTML = text.replace(/\n/g, "<br>");
  box.appendChild(bubble);
  box.scrollTop = box.scrollHeight;
  return bubble;
}

function renderChatPendingSale(draft, marketEval) {
  const box = document.getElementById("chatPendingCardBox");
  let marketTagHtml = "";

  if (marketEval && marketEval.has_benchmark) {
    const statusClass = marketEval.status === "above_market" ? "above" : (marketEval.status === "below_market" ? "below" : "fair");
    marketTagHtml = `<div class="market-tag ${statusClass}">${marketEval.message}</div>`;
  }

  box.innerHTML = `
    <div class="confirmation-card">
      <div class="confirmation-header">
        <span>Draft Sale Detected</span>
        <span>${draft.category}</span>
      </div>
      <div class="confirmation-details">
        <div><strong>Commodity:</strong> ${draft.commodity}</div>
        <div><strong>Quantity:</strong> ${draft.quantity} ${draft.unit}</div>
        <div><strong>Unit Price:</strong> KES ${draft.unit_price.toLocaleString()}</div>
        <div><strong>Total Revenue:</strong> <span style="color:var(--success); font-weight:800;">KES ${draft.total_amount.toLocaleString()}</span></div>
        <div style="grid-column: span 2;"><strong>Buyer:</strong> ${draft.counterparty || "Local Trader"}</div>
        ${marketTagHtml}
      </div>
      <button class="btn btn-primary" style="width: 100%; margin-top: 0.5rem;" onclick='acceptDraftTransaction(${JSON.stringify(draft).replace(/'/g, "&apos;")})'>
        ✓ Accept & Add to Ledger
      </button>
    </div>
  `;
}

async function acceptDraftTransaction(draft) {
  try {
    draft.farmer_id = currentFarmer.id;
    const res = await fetch("/api/ledger/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });

    if (res.ok) {
      const data = await res.json();
      document.getElementById("chatPendingCardBox").innerHTML = `
        <div style="text-align: center; padding: 2rem 1rem; color: var(--success);">
          <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🎉</div>
          <h3>${data.message}</h3>
          <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.4rem;">Transaction #${data.transaction_id} is now saved in your digital ledger.</p>
        </div>
      `;
      loadLedgerSummary();
    }
  } catch (err) {
    alert("Error accepting transaction: " + err.message);
  }
}

// Crop Disease Scanner
function previewDiseaseImage(e) {
  const file = e.target.files[0];
  if (!file) return;
  diseaseSelectedFile = file;

  const reader = new FileReader();
  reader.onload = (event) => {
    document.getElementById("diseasePreviewImg").src = event.target.result;
    document.getElementById("diseasePreviewBox").style.display = "block";
    document.getElementById("diseaseDropzone").style.display = "none";
    document.getElementById("diseaseScanBtn").disabled = false;
  };
  reader.readAsDataURL(file);
}

function clearDiseasePreview(e) {
  e.stopPropagation();
  diseaseSelectedFile = null;
  document.getElementById("diseaseFileInput").value = "";
  document.getElementById("diseasePreviewBox").style.display = "none";
  document.getElementById("diseaseDropzone").style.display = "block";
  document.getElementById("diseaseScanBtn").disabled = true;
  document.getElementById("diseaseResultCard").style.display = "none";
}

async function runDiseaseScan() {
  if (!diseaseSelectedFile) return;

  const btn = document.getElementById("diseaseScanBtn");
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner"></span> Diagnosing with Gemma AI...`;

  const formData = new FormData();
  formData.append("image", diseaseSelectedFile);
  formData.append("farmer_id", currentFarmer.id);
  const hint = document.getElementById("diseaseCropHint").value.trim();
  if (hint) formData.append("crop_hint", hint);

  try {
    const res = await fetch("/api/scan/disease", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json();
      alert("Scan failed: " + (err.detail || "Unable to diagnose image."));
      return;
    }

    const data = await res.json();
    renderDiseaseResult(data);
  } catch (err) {
    alert("Network error: " + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<span>🔬</span> Diagnose Crop with Gemma`;
  }
}

function renderDiseaseResult(data) {
  const card = document.getElementById("diseaseResultCard");
  document.getElementById("resultDiagnosis").innerText = data.diagnosis;
  document.getElementById("resultCrop").innerText = `Crop: ${data.crop}`;
  document.getElementById("resultConfidenceBadge").innerText = `${data.confidence} Confidence`;
  document.getElementById("resultSymptoms").innerText = data.symptoms || "No specific symptoms recorded.";
  document.getElementById("resultOrganic").innerText = data.organic_treatment || "N/A";
  document.getElementById("resultChemical").innerText = data.chemical_treatment || "N/A";
  document.getElementById("resultPrevention").innerText = data.prevention || "N/A";
  document.getElementById("resultCloudStorageMeta").innerHTML = `
    Cloud Asset URL: <a href="${data.image_url}" target="_blank" style="color:var(--primary); word-break:break-all;">${data.image_url}</a>
  `;
  card.style.display = "block";
}

// Receipt Scanner
function previewReceiptImage(e) {
  const file = e.target.files[0];
  if (!file) return;
  receiptSelectedFile = file;

  const reader = new FileReader();
  reader.onload = (event) => {
    document.getElementById("receiptPreviewImg").src = event.target.result;
    document.getElementById("receiptPreviewBox").style.display = "block";
    document.getElementById("receiptDropzone").style.display = "none";
    document.getElementById("receiptScanBtn").disabled = false;
  };
  reader.readAsDataURL(file);
}

function clearReceiptPreview(e) {
  e.stopPropagation();
  receiptSelectedFile = null;
  document.getElementById("receiptFileInput").value = "";
  document.getElementById("receiptPreviewBox").style.display = "none";
  document.getElementById("receiptDropzone").style.display = "block";
  document.getElementById("receiptScanBtn").disabled = true;
}

async function runReceiptScan() {
  if (!receiptSelectedFile) return;

  const btn = document.getElementById("receiptScanBtn");
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner"></span> Auditing Receipt with Gemma...`;

  const formData = new FormData();
  formData.append("receipt", receiptSelectedFile);
  formData.append("farmer_id", currentFarmer.id);

  try {
    const res = await fetch("/api/ledger/receipt/scan", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json();
      alert("Receipt scan failed: " + (err.detail || "Unable to extract receipt."));
      return;
    }

    const data = await res.json();
    renderReceiptConfirmation(data);
  } catch (err) {
    alert("Network error: " + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<span>⚡</span> Audit & Extract Receipt with Gemma`;
  }
}

function renderReceiptConfirmation(draft) {
  const box = document.getElementById("receiptResultBox");
  box.innerHTML = `
    <div class="confirmation-card">
      <div class="confirmation-header">
        <span>Agrovet Receipt Verified</span>
        <span>${draft.category}</span>
      </div>
      <div class="confirmation-details">
        <div><strong>Agrovet / Vendor:</strong> ${draft.counterparty}</div>
        <div><strong>Item:</strong> ${draft.commodity}</div>
        <div><strong>Quantity:</strong> ${draft.quantity} ${draft.unit}</div>
        <div><strong>Unit Price:</strong> KES ${draft.unit_price.toLocaleString()}</div>
        <div style="grid-column: span 2;"><strong>Total Paid:</strong> <span style="color:var(--danger); font-weight:800;">KES ${draft.total_amount.toLocaleString()}</span></div>
        <div style="grid-column: span 2; font-size: 0.8rem; color: var(--text-muted);">${draft.summary}</div>
      </div>
      <button class="btn btn-primary" style="width: 100%; margin-top: 0.75rem;" onclick='acceptDraftTransaction(${JSON.stringify(draft).replace(/'/g, "&apos;")})'>
        ✓ Accept & Record Expense to Ledger
      </button>
    </div>
  `;
}

// Digital Ledger Table
async function loadLedgerTransactions() {
  const filterType = document.getElementById("ledgerFilterType").value;
  let url = `/api/ledger/transactions?farmer_id=${currentFarmer.id}`;
  if (filterType) url += `&transaction_type=${filterType}`;

  const tbody = document.getElementById("ledgerTableBody");
  tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; padding: 2rem;">Loading transactions...</td></tr>`;

  try {
    const res = await fetch(url);
    if (!res.ok) return;
    const transactions = await res.json();

    if (transactions.length === 0) {
      tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: var(--text-muted); padding: 2rem;">No transactions found. Log a sale via chat or scan a receipt!</td></tr>`;
      return;
    }

    tbody.innerHTML = transactions
      .map(
        (t) => `
      <tr>
        <td>${t.created_at}</td>
        <td>
          <span class="result-badge ${t.transaction_type === "income" ? "success" : "danger"}">
            ${t.transaction_type === "income" ? "+ Sale (Income)" : "- Expense"}
          </span>
        </td>
        <td><strong>${t.category}</strong></td>
        <td>${t.commodity}</td>
        <td>${t.quantity} ${t.unit}</td>
        <td>KES ${t.unit_price.toLocaleString()}</td>
        <td style="font-weight: 700; color: ${t.transaction_type === "income" ? "var(--success)" : "var(--danger)"}">
          KES ${t.total_amount.toLocaleString()}
        </td>
        <td>${t.counterparty || "—"}</td>
        <td>
          ${t.receipt_url ? `<a href="${t.receipt_url}" target="_blank" style="color:var(--primary); font-size:0.82rem;">View Proof</a>` : "—"}
        </td>
        <td>
          <button class="btn btn-secondary" style="padding: 0.2rem 0.5rem; font-size: 0.75rem;" onclick="deleteLedgerTransaction(${t.id})">
            Delete
          </button>
        </td>
      </tr>
    `
      )
      .join("");
  } catch (err) {
    console.error("Failed to load transactions:", err);
  }
}

async function deleteLedgerTransaction(id) {
  if (!confirm("Are you sure you want to remove this transaction?")) return;
  try {
    const res = await fetch(`/api/ledger/transaction/${id}`, { method: "DELETE" });
    if (res.ok) {
      loadLedgerTransactions();
      loadLedgerSummary();
    }
  } catch (err) {
    alert("Delete failed: " + err.message);
  }
}

// Kenya Market Prices
async function loadMarketPrices() {
  const tbody = document.getElementById("marketTableBody");
  try {
    const res = await fetch("/api/market/prices");
    if (res.ok) {
      allMarketPrices = await res.json();
      renderMarketTable(allMarketPrices);
    }
  } catch (err) {
    console.error("Error loading market prices:", err);
  }
}

function renderMarketTable(prices) {
  const tbody = document.getElementById("marketTableBody");
  if (prices.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">No matching commodity prices.</td></tr>`;
    return;
  }

  tbody.innerHTML = prices
    .map(
      (p) => `
    <tr>
      <td><strong>${p.commodity}</strong></td>
      <td>${p.market_name}</td>
      <td>${p.unit}</td>
      <td>KES ${p.price_low.toLocaleString()} - ${p.price_high.toLocaleString()}</td>
      <td style="font-weight:700; color:var(--primary-dark);">KES ${p.price_avg.toLocaleString()}</td>
    </tr>
  `
    )
    .join("");
}

function filterMarketPrices() {
  const query = document.getElementById("marketSearchInput").value.trim().toLowerCase();
  const filtered = allMarketPrices.filter((p) => p.commodity.toLowerCase().includes(query) || p.market_name.toLowerCase().includes(query));
  renderMarketTable(filtered);
}

async function runPriceCompare() {
  const commodity = document.getElementById("compareCommodity").value;
  const unit = document.getElementById("compareUnit").value;
  const price = parseFloat(document.getElementById("comparePrice").value);

  if (!price || price <= 0) {
    alert("Please enter a valid offered price.");
    return;
  }

  const resultBox = document.getElementById("compareResultBox");
  resultBox.style.display = "block";
  resultBox.innerHTML = `Calculating against wholesale market benchmark...`;

  try {
    const res = await fetch("/api/market/compare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        commodity: commodity,
        unit_price: price,
        unit: unit,
        county: currentFarmer.county,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const statusClass = data.status === "above_market" ? "above" : (data.status === "below_market" ? "below" : "fair");
      resultBox.innerHTML = `
        <div class="market-tag ${statusClass}" style="font-size: 0.95rem; padding: 0.75rem;">
          ${data.message}
        </div>
      `;
    }
  } catch (err) {
    resultBox.innerHTML = "Error checking market prices: " + err.message;
  }
}
