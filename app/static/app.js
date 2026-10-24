// KilimoGuard Client Application

let currentFarmer = null;

const DEFAULT_CROPS_LIST = [
  "Maize",
  "Irish Potatoes",
  "Tomatoes",
  "French Beans",
  "Dry Beans",
  "Cabbages",
  "Hass Avocados",
  "Bananas",
  "Tea",
  "Coffee",
  "Sukuma Wiki",
  "Wheat",
  "Dairy Cattle",
  "Sorghum",
];

let selectedCrops = new Set(["Maize", "Irish Potatoes"]);
let diseaseSelectedFile = null;
let receiptSelectedFile = null;
let speechRecognition = null;
let isRecording = false;
let allMarketPrices = [];

// App Startup
document.addEventListener("DOMContentLoaded", async () => {
  renderCropChips();
  await loadCounties();
  initFarmerState();
  initSpeechRecognition();
});

// Render Multi-Crop Selection Chips
function renderCropChips() {
  const container = document.getElementById("cropChipsContainer");
  if (!container) return;
  container.innerHTML = "";

  DEFAULT_CROPS_LIST.forEach((crop) => {
    const isSelected = selectedCrops.has(crop);
    const chip = document.createElement("div");
    chip.className = `crop-chip ${isSelected ? "selected" : ""}`;
    chip.onclick = () => toggleCropChip(crop);

    const checkIcon = isSelected
      ? `<svg class="icon icon-sm" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>`
      : `<svg class="icon icon-sm" viewBox="0 0 24 24" style="opacity:0.4;"><circle cx="12" cy="12" r="9"/></svg>`;

    chip.innerHTML = `${checkIcon} <span>${crop}</span>`;
    container.appendChild(chip);
  });
}

function toggleCropChip(crop) {
  if (selectedCrops.has(crop)) {
    if (selectedCrops.size > 1) {
      selectedCrops.delete(crop);
    }
  } else {
    selectedCrops.add(crop);
  }
  renderCropChips();
}

function handleCustomCropKeydown(e) {
  if (e.key === "Enter") {
    e.preventDefault();
    const val = e.target.value.trim();
    if (val && !selectedCrops.has(val)) {
      if (!DEFAULT_CROPS_LIST.includes(val)) {
        DEFAULT_CROPS_LIST.push(val);
      }
      selectedCrops.add(val);
      e.target.value = "";
      renderCropChips();
    }
  }
}

// SACCO Form Controls
function toggleSaccoFields(checked) {
  const box = document.getElementById("saccoFieldsBox");
  if (box) {
    box.style.display = checked ? "block" : "none";
  }
}

function handleSaccoSelectChange(select) {
  const customInput = document.getElementById("signupCustomSacco");
  if (select.value === "custom") {
    customInput.style.display = "block";
    customInput.required = true;
  } else {
    customInput.style.display = "none";
    customInput.required = false;
  }
}

// Counties Loader
async function loadCounties() {
  try {
    const res = await fetch("/api/counties");
    const counties = await res.json();

    const signupSelect = document.getElementById("signupCounty");
    const profileSelect = document.getElementById("profileCounty");

    [signupSelect, profileSelect].forEach((select) => {
      if (!select) return;
      select.innerHTML = "";
      counties.forEach((c) => {
        const opt = document.createElement("option");
        opt.value = c;
        opt.innerText = c;
        select.appendChild(opt);
      });
    });

    if (signupSelect) signupSelect.value = "Nakuru";
  } catch (err) {
    console.error("Failed loading counties:", err);
  }
}

// Initialize Farmer Profile State
function initFarmerState() {
  const saved = localStorage.getItem("kilimoguard_farmer");
  if (saved) {
    try {
      currentFarmer = JSON.parse(saved);
    } catch (e) {
      console.warn("Invalid saved farmer profile:", e);
    }
  }

  if (currentFarmer && currentFarmer.id) {
    showAppView();
    updateFarmerUI();
    loadDashboardData();
    loadMarketPrices();
    loadTrustIndex();
  } else {
    showSignupView();
  }
}

function showSignupView() {
  document.getElementById("viewSignup").classList.add("active");
  document.getElementById("viewApp").classList.remove("active");
  document.getElementById("farmerBadgeName").innerText = "New Farmer";
  document.getElementById("farmerBadgeCounty").innerText = "Sign Up";
}

function showAppView() {
  document.getElementById("viewSignup").classList.remove("active");
  document.getElementById("viewApp").classList.add("active");
}

function openSignupView() {
  closeProfileModal();
  showSignupView();
}

// Handle Sign-Up Form Submit
async function handleSignupSubmit(e) {
  e.preventDefault();

  const name = document.getElementById("signupName").value.trim();
  const phone = document.getElementById("signupPhone").value.trim();
  const county = document.getElementById("signupCounty").value;
  const subCounty = document.getElementById("signupSubCounty").value.trim();
  const acreage = parseFloat(document.getElementById("signupAcreage").value) || 1.0;

  const isSacco = document.getElementById("signupSaccoToggle").checked;
  let saccoName = null;
  let saccoId = null;

  if (isSacco) {
    const selectVal = document.getElementById("signupSaccoSelect").value;
    saccoName = selectVal === "custom"
      ? document.getElementById("signupCustomSacco").value.trim()
      : selectVal;
    saccoId = document.getElementById("signupSaccoId").value.trim();
  }

  const cropsArr = Array.from(selectedCrops);

  const payload = {
    name,
    phone,
    county,
    sub_county: subCounty,
    primary_crop: cropsArr[0] || "Maize",
    crops: cropsArr,
    farm_size_acres: acreage,
    is_sacco_member: isSacco ? "yes" : "no",
    sacco_name: saccoName,
    sacco_member_id: saccoId,
  };

  try {
    const res = await fetch("/api/farmer/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      currentFarmer = await res.json();
      localStorage.setItem("kilimoguard_farmer", JSON.stringify(currentFarmer));
      showAppView();
      updateFarmerUI();
      loadDashboardData();
      loadMarketPrices();
      // Auto-trigger trust index calculation on new registration
      runGenerateTrustIndex();
    } else {
      const err = await res.json();
      alert("Registration failed: " + (err.detail || "Check input details."));
    }
  } catch (err) {
    alert("Network error: " + err.message);
  }
}

// Update UI Badges & Profile Modal
function updateFarmerUI() {
  if (!currentFarmer) return;

  document.getElementById("farmerBadgeName").innerText = currentFarmer.name || "Mkulima";
  document.getElementById("farmerBadgeCounty").innerText = currentFarmer.county || "Nakuru";
  document.getElementById("dashWeatherCounty").innerText = currentFarmer.county || "Nakuru";
  document.getElementById("farmerAvatar").innerText = (currentFarmer.name || "M").charAt(0).toUpperCase();

  document.getElementById("profileName").value = currentFarmer.name || "";
  document.getElementById("profilePhone").value = currentFarmer.phone || "";
  if (currentFarmer.county) {
    document.getElementById("profileCounty").value = currentFarmer.county;
  }
  document.getElementById("profileSubCounty").value = currentFarmer.sub_county || "";
  document.getElementById("profileAcreage").value = currentFarmer.farm_size_acres || 1.0;
  document.getElementById("profileCrops").value = Array.isArray(currentFarmer.crops)
    ? currentFarmer.crops.join(", ")
    : (currentFarmer.crops || currentFarmer.primary_crop || "");

  const saccoText = currentFarmer.is_sacco_member === "yes"
    ? `${currentFarmer.sacco_name || "SACCO Member"} (ID: ${currentFarmer.sacco_member_id || "Verified"})`
    : "Not affiliated";
  document.getElementById("profileSacco").value = saccoText;
}

function openProfileModal() {
  updateFarmerUI();
  document.getElementById("profileModal").classList.add("active");
}

function closeProfileModal() {
  document.getElementById("profileModal").classList.remove("active");
}

async function saveProfileModal(e) {
  e.preventDefault();
  if (!currentFarmer) return;

  const cropsStr = document.getElementById("profileCrops").value.trim();
  const cropsArr = cropsStr ? cropsStr.split(",").map((c) => c.trim()).filter(Boolean) : [currentFarmer.primary_crop];

  const payload = {
    name: document.getElementById("profileName").value.trim(),
    phone: document.getElementById("profilePhone").value.trim(),
    county: document.getElementById("profileCounty").value,
    sub_county: document.getElementById("profileSubCounty").value.trim(),
    farm_size_acres: parseFloat(document.getElementById("profileAcreage").value) || 1.0,
    primary_crop: cropsArr[0] || "Maize",
    crops: cropsArr,
    is_sacco_member: currentFarmer.is_sacco_member || "no",
    sacco_name: currentFarmer.sacco_name,
    sacco_member_id: currentFarmer.sacco_member_id,
  };

  try {
    const res = await fetch("/api/farmer/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      currentFarmer = await res.json();
      localStorage.setItem("kilimoguard_farmer", JSON.stringify(currentFarmer));
      updateFarmerUI();
      closeProfileModal();
      loadDashboardData();
    }
  } catch (err) {
    alert("Update failed: " + err.message);
  }
}

// Tab Switching
function switchTab(tabId) {
  const tabs = ["dashboard", "trust", "disease", "chat", "receipts", "ledger", "market"];
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
  if (tabId === "trust") loadTrustIndex();
  if (tabId === "ledger") loadLedgerTransactions();
  if (tabId === "market") loadMarketPrices();
}

// Dashboard & Weather
async function loadDashboardData() {
  loadLedgerSummary();
  loadWeather();
  loadTrustIndex();
}

async function loadLedgerSummary() {
  if (!currentFarmer) return;
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
    console.error("Failed loading ledger summary:", err);
  }
}

async function loadWeather() {
  const county = currentFarmer ? currentFarmer.county : "Nakuru";
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
    console.error("Failed loading weather:", err);
  }
}

// Kilimo-Trust-Index (Credit Rating via Gemma)
async function loadTrustIndex() {
  if (!currentFarmer) return;
  try {
    const res = await fetch(`/api/farmer/${currentFarmer.id}/trust-index`);
    if (res.ok) {
      const data = await res.json();
      if (data.has_score) {
        renderTrustIndexUI(data);
      }
    }
  } catch (err) {
    console.error("Failed loading trust index:", err);
  }
}

async function runGenerateTrustIndex() {
  if (!currentFarmer) return;

  const btn = document.getElementById("calcTrustBtn");
  const btnText = document.getElementById("calcTrustBtnText");
  btn.disabled = true;
  btnText.innerHTML = `<span class="spinner"></span> Assessing with Gemma AI...`;

  try {
    const res = await fetch(`/api/farmer/${currentFarmer.id}/trust-index`, {
      method: "POST",
    });

    if (!res.ok) {
      const err = await res.json();
      alert("Trust index assessment failed: " + (err.detail || "Unable to complete."));
      return;
    }

    const data = await res.json();
    renderTrustIndexUI(data);
  } catch (err) {
    alert("Network error: " + err.message);
  } finally {
    btn.disabled = false;
    btnText.innerText = "Recalculate Trust Index with Gemma";
  }
}

function renderTrustIndexUI(data) {
  document.getElementById("trustEmptyPrompt").style.display = "none";
  document.getElementById("trustReportContainer").style.display = "block";

  // Score & Grade
  const score = data.score || 650;
  const grade = data.grade || "BBB";
  const risk = data.risk_level || "Moderate Risk";
  const maxCredit = data.max_recommended_credit_kes || 50000;

  document.getElementById("trustScoreVal").innerText = score;
  document.getElementById("trustGradeVal").innerText = `Grade ${grade}`;
  document.getElementById("trustRiskPill").innerText = risk;

  document.getElementById("trustMaxCreditVal").innerText = `KES ${maxCredit.toLocaleString()}`;
  document.getElementById("trustRepaymentVal").innerText = `Repayment Capacity: ${data.repayment_capacity || "Adequate"}`;

  // Dashboard widget sync
  document.getElementById("dashTrustScore").innerText = `${score} (${grade})`;
  document.getElementById("dashTrustStatus").innerText = risk;

  // Breakdown cards
  document.getElementById("trustExecSummary").innerText = data.financial_health_summary || "Healthy farm cash flow record.";
  document.getElementById("trustAgronomicResilience").innerText = data.agronomic_resilience ? `Agronomic Analysis: ${data.agronomic_resilience}` : "";
  document.getElementById("trustSaccoNote").innerText = data.recommendations_for_sacco || "Standard input voucher advance approved.";
  document.getElementById("trustTimestampMeta").innerText = `Verified by KilimoGuard AI · Updated ${data.updated_at || "Today"}`;

  // Strengths list
  const strengthsUl = document.getElementById("trustStrengthsList");
  strengthsUl.innerHTML = "";
  (data.key_strengths || []).forEach((s) => {
    const li = document.createElement("li");
    li.innerHTML = `<svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg><span>${s}</span>`;
    strengthsUl.appendChild(li);
  });

  // Risks list
  const risksUl = document.getElementById("trustRisksList");
  risksUl.innerHTML = "";
  (data.risk_factors || []).forEach((r) => {
    const li = document.createElement("li");
    li.innerHTML = `<svg class="icon icon-sm" viewBox="0 0 24 24"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg><span>${r}</span>`;
    risksUl.appendChild(li);
  });

  // Voucher details
  document.getElementById("voucherFarmerName").innerText = currentFarmer.name;
  document.getElementById("voucherCounty").innerText = currentFarmer.county;
  document.getElementById("voucherSacco").innerText = currentFarmer.is_sacco_member === "yes" ? (currentFarmer.sacco_name || "SACCO Member") : "Direct Smallholder";
  document.getElementById("voucherGrade").innerText = `Grade ${grade} (${score}/850) · ${risk}`;
  document.getElementById("voucherCredit").innerText = `KES ${maxCredit.toLocaleString()}`;
}

// Voice Capabilities & Web Speech API
function initSpeechRecognition() {
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRec) {
    console.warn("Web Speech API not supported in this browser. Chat text entry is available.");
    return;
  }

  speechRecognition = new SpeechRec();
  speechRecognition.continuous = false;
  speechRecognition.interimResults = false;
  speechRecognition.lang = "sw-KE";

  speechRecognition.onstart = () => {
    isRecording = true;
    const btn = document.getElementById("voiceMicBtn");
    if (btn) btn.classList.add("recording");
  };

  speechRecognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    const input = document.getElementById("chatTextInput");
    input.value = transcript;
    sendChatMessage();
  };

  speechRecognition.onerror = () => stopVoiceInput();
  speechRecognition.onend = () => stopVoiceInput();
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
  if (btn) btn.classList.remove("recording");
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
  if (!message || !currentFarmer) return;

  input.value = "";
  appendChatBubble("user", message);

  const loadingBubble = appendChatBubble("bot", "Analyzing transaction with Gemma AI...");

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
    appendChatBubble("bot", "Network connection error. Please verify your internet connection.");
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
        <span>Draft Sale Extracted</span>
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
        <svg class="icon icon-sm" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
        <span>Accept & Record to Digital Ledger</span>
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
          <div style="font-size: 1.5rem; margin-bottom: 0.5rem;">
            <svg class="icon icon-lg" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </div>
          <h3>${data.message}</h3>
          <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.4rem;">Transaction #${data.transaction_id} is permanently saved in your digital ledger.</p>
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
  if (!diseaseSelectedFile || !currentFarmer) return;

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
    btn.innerHTML = `<svg class="icon icon-sm" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><span>Diagnose Crop with Gemma</span>`;
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
  if (!receiptSelectedFile || !currentFarmer) return;

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
    btn.innerHTML = `<svg class="icon icon-sm" viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg><span>Audit & Extract Receipt with Gemma</span>`;
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
        <div style="grid-column: span 2;"><strong>Total Cost:</strong> <span style="color:var(--danger); font-weight:800;">KES ${draft.total_amount.toLocaleString()}</span></div>
        <div style="grid-column: span 2; font-size: 0.8rem; color: var(--text-muted);">${draft.summary}</div>
      </div>
      <button class="btn btn-primary" style="width: 100%; margin-top: 0.75rem;" onclick='acceptDraftTransaction(${JSON.stringify(draft).replace(/'/g, "&apos;")})'>
        <svg class="icon icon-sm" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
        <span>Accept & Record Expense to Ledger</span>
      </button>
    </div>
  `;
}

// Digital Ledger Table
async function loadLedgerTransactions() {
  if (!currentFarmer) return;

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
      tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: var(--text-muted); padding: 2rem;">No transactions recorded yet. Log a produce sale or scan an agrovet receipt.</td></tr>`;
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
    console.error("Failed loading transactions:", err);
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
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">No matching commodity benchmarks.</td></tr>`;
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
  resultBox.innerHTML = `Calculating variance against wholesale market benchmark...`;

  try {
    const res = await fetch("/api/market/compare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        commodity: commodity,
        unit_price: price,
        unit: unit,
        county: currentFarmer ? currentFarmer.county : "Nakuru",
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
