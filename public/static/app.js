// KilimoGuard Client Application

let currentFarmer = null;
let currentPlotId = null;
let cropBatches = [];

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
let profileSelectedCrops = new Set(["Maize", "Irish Potatoes"]);
let diseaseSelectedFile = null;
let receiptSelectedFile = null;
let growthSelectedFile = null;
let speechRecognition = null;
let isRecording = false;
let currentUtterance = null;
let allMarketPrices = [];

// App Startup
document.addEventListener("DOMContentLoaded", async () => {
  renderCropChips();
  await loadCounties();
  initFarmerState();
  initSpeechRecognition();

  // Close account dropdown on click outside
  document.addEventListener("click", (e) => {
    const container = document.getElementById("accountMenuContainer");
    const dropdown = document.getElementById("accountDropdownMenu");
    if (container && dropdown && !container.contains(e.target)) {
      dropdown.classList.remove("active");
    }
  });
});

// Render Multi-Crop Selection Chips for Signup Form
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

// Render Profile Crop Chips
function renderProfileCropChips() {
  const container = document.getElementById("profileCropChipsContainer");
  if (!container) return;
  container.innerHTML = "";

  DEFAULT_CROPS_LIST.forEach((crop) => {
    const isSelected = profileSelectedCrops.has(crop);
    const chip = document.createElement("div");
    chip.className = `crop-chip ${isSelected ? "selected" : ""}`;
    chip.onclick = () => {
      if (profileSelectedCrops.has(crop)) {
        if (profileSelectedCrops.size > 1) profileSelectedCrops.delete(crop);
      } else {
        profileSelectedCrops.add(crop);
      }
      renderProfileCropChips();
    };

    const checkIcon = isSelected
      ? `<svg class="icon icon-sm" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>`
      : `<svg class="icon icon-sm" viewBox="0 0 24 24" style="opacity:0.4;"><circle cx="12" cy="12" r="9"/></svg>`;

    chip.innerHTML = `${checkIcon} <span>${crop}</span>`;
    container.appendChild(chip);
  });
}

function handleProfileCustomCropKeydown(e) {
  if (e.key === "Enter") {
    e.preventDefault();
    const val = e.target.value.trim();
    if (val && !profileSelectedCrops.has(val)) {
      if (!DEFAULT_CROPS_LIST.includes(val)) {
        DEFAULT_CROPS_LIST.push(val);
      }
      profileSelectedCrops.add(val);
      e.target.value = "";
      renderProfileCropChips();
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
    const profileSelect = document.getElementById("profileEditCounty");
    const marketAiCounty = document.getElementById("marketAiCounty");

    [signupSelect, profileSelect, marketAiCounty].forEach((select) => {
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
    if (marketAiCounty) marketAiCounty.value = "Nakuru";
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
    loadCropBatches();
  } else {
    showSignupView();
  }
}

function showSignupView() {
  document.getElementById("viewSignup").classList.add("active");
  document.getElementById("viewApp").classList.remove("active");
  const menuContainer = document.getElementById("accountMenuContainer");
  if (menuContainer) menuContainer.style.display = "none";
}

function showAppView() {
  document.getElementById("viewSignup").classList.remove("active");
  document.getElementById("viewApp").classList.add("active");
  const menuContainer = document.getElementById("accountMenuContainer");
  if (menuContainer) menuContainer.style.display = "inline-block";
}

// Top Right Account Dropdown Controls
function toggleAccountMenu(e) {
  if (e) e.stopPropagation();
  const dropdown = document.getElementById("accountDropdownMenu");
  if (dropdown) dropdown.classList.toggle("active");
}

function closeAccountMenu() {
  const dropdown = document.getElementById("accountDropdownMenu");
  if (dropdown) dropdown.classList.remove("active");
}

function goToProfilePage() {
  closeAccountMenu();
  switchTab("profile");
}

function signOutFarmer() {
  closeAccountMenu();
  if (confirm("Are you sure you want to sign out of KilimoGuard?")) {
    localStorage.removeItem("kilimoguard_farmer");
    currentFarmer = null;
    showSignupView();
  }
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
      loadCropBatches();
      runGenerateTrustIndex();
    } else {
      const err = await res.json();
      alert("Registration failed: " + (err.detail || "Check input details."));
    }
  } catch (err) {
    alert("Network error: " + err.message);
  }
}

// Update UI Badges, Avatars & Profile Page
function updateFarmerUI() {
  if (!currentFarmer) return;

  const name = currentFarmer.name || "Mkulima";
  const initial = name.charAt(0).toUpperCase();
  const county = currentFarmer.county || "Nakuru";
  const phone = currentFarmer.phone || "";
  const avatarUrl = currentFarmer.avatar_url;

  // Header badges
  const badgeName = document.getElementById("farmerBadgeName");
  if (badgeName) badgeName.innerText = name;
  const badgeCounty = document.getElementById("farmerBadgeCounty");
  if (badgeCounty) badgeCounty.innerText = county;

  // Header Avatar
  const headerAvatarImg = document.getElementById("headerAvatarImg");
  const headerAvatarInitial = document.getElementById("headerAvatarInitial");
  if (avatarUrl) {
    if (headerAvatarImg) { headerAvatarImg.src = avatarUrl; headerAvatarImg.style.display = "block"; }
    if (headerAvatarInitial) headerAvatarInitial.style.display = "none";
  } else {
    if (headerAvatarImg) headerAvatarImg.style.display = "none";
    if (headerAvatarInitial) { headerAvatarInitial.innerText = initial; headerAvatarInitial.style.display = "block"; }
  }

  // Dropdown Avatar & Meta
  const dropdownName = document.getElementById("dropdownFarmerName");
  if (dropdownName) dropdownName.innerText = name;
  const dropdownPhone = document.getElementById("dropdownFarmerPhone");
  if (dropdownPhone) dropdownPhone.innerText = phone;
  const dropdownImg = document.getElementById("dropdownAvatarImg");
  const dropdownInitial = document.getElementById("dropdownAvatarInitial");
  if (avatarUrl) {
    if (dropdownImg) { dropdownImg.src = avatarUrl; dropdownImg.style.display = "block"; }
    if (dropdownInitial) dropdownInitial.style.display = "none";
  } else {
    if (dropdownImg) dropdownImg.style.display = "none";
    if (dropdownInitial) { dropdownInitial.innerText = initial; dropdownInitial.style.display = "block"; }
  }

  // Profile Page Hero
  const profileHeroName = document.getElementById("profileHeroName");
  if (profileHeroName) profileHeroName.innerText = name;
  const profileHeroLocation = document.getElementById("profileHeroLocation");
  if (profileHeroLocation) {
    profileHeroLocation.innerText = `${county} County · ${currentFarmer.sub_county || "Central Ward"}`;
  }
  const profileImg = document.getElementById("profileAvatarImg");
  const profileInitial = document.getElementById("profileAvatarInitial");
  if (avatarUrl) {
    if (profileImg) { profileImg.src = avatarUrl; profileImg.style.display = "block"; }
    if (profileInitial) profileInitial.style.display = "none";
  } else {
    if (profileImg) profileImg.style.display = "none";
    if (profileInitial) { profileInitial.innerText = initial; profileInitial.style.display = "block"; }
  }

  const profileHeroSaccoPill = document.getElementById("profileHeroSaccoPill");
  if (profileHeroSaccoPill) {
    profileHeroSaccoPill.innerText = currentFarmer.is_sacco_member === "yes"
      ? (currentFarmer.sacco_name || "SACCO Member")
      : "Informal Smallholder";
  }

  // Profile Form Fields
  const editName = document.getElementById("profileEditName");
  if (editName) editName.value = name;
  const editPhone = document.getElementById("profileEditPhone");
  if (editPhone) editPhone.value = phone;
  const editCounty = document.getElementById("profileEditCounty");
  if (editCounty) editCounty.value = county;
  const editSubCounty = document.getElementById("profileEditSubCounty");
  if (editSubCounty) editSubCounty.value = currentFarmer.sub_county || "";
  const editAcreage = document.getElementById("profileEditAcreage");
  if (editAcreage) editAcreage.value = currentFarmer.farm_size_acres || 1.0;
  const editSaccoName = document.getElementById("profileEditSaccoName");
  if (editSaccoName) editSaccoName.value = currentFarmer.sacco_name || "";
  const editSaccoId = document.getElementById("profileEditSaccoId");
  if (editSaccoId) editSaccoId.value = currentFarmer.sacco_member_id || "";

  // Set Profile Crops
  profileSelectedCrops.clear();
  const cropsList = Array.isArray(currentFarmer.crops)
    ? currentFarmer.crops
    : (currentFarmer.crops ? currentFarmer.crops.split(",").map(c => c.trim()) : [currentFarmer.primary_crop || "Maize"]);
  cropsList.forEach(c => profileSelectedCrops.add(c));
  renderProfileCropChips();

  // Market AI County sync
  const marketAiCounty = document.getElementById("marketAiCounty");
  if (marketAiCounty && county) marketAiCounty.value = county;

  const dashCounty = document.getElementById("dashWeatherCounty");
  if (dashCounty) dashCounty.innerText = county;
}

// Upload Profile Avatar Photo
async function handleAvatarUpload(event) {
  const file = event.target.files[0];
  if (!file || !currentFarmer) return;

  const formData = new FormData();
  formData.append("photo", file);

  try {
    const res = await fetch(`/api/farmer/${currentFarmer.id}/avatar`, {
      method: "POST",
      body: formData,
    });

    if (res.ok) {
      const data = await res.json();
      currentFarmer.avatar_url = data.avatar_url;
      localStorage.setItem("kilimoguard_farmer", JSON.stringify(currentFarmer));
      updateFarmerUI();
    } else {
      const err = await res.json();
      alert("Failed to upload profile photo: " + (err.detail || "Image error"));
    }
  } catch (err) {
    alert("Network error: " + err.message);
  }
}

// Handle Profile Edit Form Submission
async function handleProfileUpdate(event) {
  event.preventDefault();
  if (!currentFarmer) return;

  const btn = document.getElementById("saveProfileBtn");
  if (btn) btn.disabled = true;

  const name = document.getElementById("profileEditName").value.trim();
  const phone = document.getElementById("profileEditPhone").value.trim();
  const county = document.getElementById("profileEditCounty").value;
  const subCounty = document.getElementById("profileEditSubCounty").value.trim();
  const acreage = parseFloat(document.getElementById("profileEditAcreage").value) || 1.0;
  const saccoName = document.getElementById("profileEditSaccoName").value.trim();
  const saccoId = document.getElementById("profileEditSaccoId").value.trim();

  const cropsArr = Array.from(profileSelectedCrops);

  const payload = {
    name,
    phone,
    county,
    sub_county: subCounty,
    primary_crop: cropsArr[0] || "Maize",
    crops: cropsArr,
    farm_size_acres: acreage,
    avatar_url: currentFarmer.avatar_url,
    is_sacco_member: saccoName ? "yes" : "no",
    sacco_name: saccoName || null,
    sacco_member_id: saccoId || null,
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
      loadWeather();
      alert("Farm profile updated successfully!");
    } else {
      const err = await res.json();
      alert("Profile update failed: " + (err.detail || "Please check inputs."));
    }
  } catch (err) {
    alert("Network error: " + err.message);
  } finally {
    if (btn) btn.disabled = false;
  }
}

// Tab Switching
function switchTab(tabName) {
  document.querySelectorAll(".tab-btn").forEach((btn) => btn.classList.remove("active"));
  document.querySelectorAll(".tab-panel").forEach((panel) => panel.classList.remove("active"));

  const targetBtn = document.getElementById(`tabBtn${capitalize(tabName)}`);
  const targetPanel = document.getElementById(`panel${capitalize(tabName)}`);

  if (targetBtn) targetBtn.classList.add("active");
  if (targetPanel) targetPanel.classList.add("active");

  if (tabName === "ledger") loadLedgerTransactions();
  if (tabName === "growth") loadCropBatches();
  if (tabName === "profile") updateFarmerUI();
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Load Dashboard Financial & Weather Data
async function loadDashboardData() {
  if (!currentFarmer) return;

  try {
    const res = await fetch(`/api/farmer/${currentFarmer.id}`);
    if (res.ok) {
      const data = await res.json();
      const fin = data.financial_summary || {};

      document.getElementById("kpiIncome").innerText = `KES ${(fin.total_income_kes || 0).toLocaleString()}`;
      document.getElementById("kpiExpense").innerText = `KES ${(fin.total_expense_kes || 0).toLocaleString()}`;

      const profit = fin.net_profit_kes || 0;
      const profitEl = document.getElementById("kpiProfit");
      profitEl.innerText = `KES ${profit.toLocaleString()}`;
      profitEl.style.color = profit >= 0 ? "var(--primary-dark)" : "var(--danger)";

      if (data.trust_index && data.trust_index.score) {
        document.getElementById("dashTrustScore").innerText = data.trust_index.score;
        document.getElementById("dashTrustStatus").innerText = `Grade ${data.trust_index.grade} · ${data.trust_index.risk_level}`;
        const profileHeroTrust = document.getElementById("profileHeroTrustPill");
        if (profileHeroTrust) {
          profileHeroTrust.innerText = `Trust Index: ${data.trust_index.score} (${data.trust_index.grade})`;
        }
      }
    }
  } catch (err) {
    console.error("Dashboard metrics load error:", err);
  }

  loadWeather();
}

// Live Weather & Multi-Month Seasonal Agro-Climatic Outlook
async function loadWeather() {
  const county = currentFarmer ? currentFarmer.county : "Nakuru";
  try {
    const res = await fetch(`/api/weather?county=${encodeURIComponent(county)}`);
    if (!res.ok) return;

    const data = await res.json();
    document.getElementById("dashWeatherTemp").innerText = `${data.temperature.toFixed(1)}°C`;
    document.getElementById("dashWeatherRange").innerText = `Min ${data.temp_min.toFixed(0)}°C / Max ${data.temp_max.toFixed(0)}°C`;
    document.getElementById("dashWeatherRain").innerText = `${data.rain_probability}%`;
    document.getElementById("dashWeatherWind").innerText = `${data.wind_speed} km/h`;
    document.getElementById("dashWeatherHumidity").innerText = `${data.humidity}%`;
    document.getElementById("dashWeatherAdvisory").innerText = data.advisory;

    // Seasonal Outlook Rendering
    if (data.seasonal_outlook) {
      const so = data.seasonal_outlook;
      const cyclePill = document.getElementById("seasonalCyclePill");
      if (cyclePill) cyclePill.innerText = so.season_title;

      const summaryEl = document.getElementById("seasonalSummary");
      if (summaryEl) summaryEl.innerText = `${so.season_phase} across ${county} County.`;

      const moistureEl = document.getElementById("seasonalSoilMoisture");
      if (moistureEl) moistureEl.innerText = so.soil_moisture;

      const riskEl = document.getElementById("seasonalRisk");
      if (riskEl) riskEl.innerText = so.climate_risk;

      const windowEl = document.getElementById("seasonalWindow");
      if (windowEl) windowEl.innerText = so.projection_window;

      const container = document.getElementById("seasonalMonthsContainer");
      if (container && Array.isArray(so.months)) {
        container.innerHTML = "";
        so.months.forEach((m) => {
          const card = document.createElement("div");
          card.className = "seasonal-month-card";
          card.innerHTML = `
            <div class="seasonal-month-name">${m.month}</div>
            <div class="seasonal-month-rain">Rainfall: <strong>${m.rainfall_expectation}</strong> (${m.temp_range})</div>
            <div class="seasonal-month-task">${m.field_activity}</div>
          `;
          container.appendChild(card);
        });
      }
    }
  } catch (err) {
    console.warn("Weather fetch error:", err);
  }
}

// Kilimo-Trust-Index Evaluation
async function runGenerateTrustIndex() {
  if (!currentFarmer) return;

  const btn = document.getElementById("calcTrustBtn");
  const btnText = document.getElementById("calcTrustBtnText");
  btn.disabled = true;
  btnText.innerText = "Evaluating credit profile with Gemma AI...";

  try {
    const res = await fetch(`/api/farmer/${currentFarmer.id}/trust-index`, {
      method: "POST",
    });

    if (res.ok) {
      const data = await res.json();
      renderTrustIndexReport(data);
      loadDashboardData();
    } else {
      const err = await res.json();
      alert("Evaluation failed: " + (err.detail || "Gemma service busy."));
    }
  } catch (err) {
    alert("Network error: " + err.message);
  } finally {
    btn.disabled = false;
    btnText.innerText = "Recalculate Trust Index with Gemma";
  }
}

async function loadTrustIndex() {
  if (!currentFarmer) return;

  try {
    const res = await fetch(`/api/farmer/${currentFarmer.id}/trust-index`);
    if (res.ok) {
      const data = await res.json();
      if (data.has_score) {
        renderTrustIndexReport(data);
      }
    }
  } catch (err) {
    console.warn("Could not load trust index:", err);
  }
}

function renderTrustIndexReport(data) {
  document.getElementById("trustEmptyPrompt").style.display = "none";
  document.getElementById("trustReportContainer").style.display = "block";

  document.getElementById("trustScoreVal").innerText = data.score;
  document.getElementById("trustGradeVal").innerText = `Grade ${data.grade}`;

  const riskPill = document.getElementById("trustRiskPill");
  riskPill.innerText = data.risk_level;
  riskPill.className = "trust-badge-pill " + (data.grade.startsWith("A") ? "low" : "moderate");

  document.getElementById("trustMaxCreditVal").innerText = `KES ${(data.max_recommended_credit_kes || 0).toLocaleString()}`;
  document.getElementById("trustRepaymentVal").innerText = `Repayment Capacity: ${data.repayment_capacity || "Adequate"}`;

  document.getElementById("trustExecSummary").innerText = data.financial_health_summary || "Healthy farm cash flow.";
  document.getElementById("trustAgronomicResilience").innerText = data.agronomic_resilience
    ? `Agronomic Resilience: ${data.agronomic_resilience}`
    : "";
  document.getElementById("trustSaccoNote").innerText = data.recommendations_for_sacco || "Eligible for seasonal farm input credit.";
  document.getElementById("trustTimestampMeta").innerText = `Underwriting timestamp: ${data.updated_at || "Recent"}`;

  const strengthsList = document.getElementById("trustStrengthsList");
  strengthsList.innerHTML = "";
  (data.key_strengths || []).forEach((s) => {
    const li = document.createElement("li");
    li.innerText = s;
    strengthsList.appendChild(li);
  });

  const risksList = document.getElementById("trustRisksList");
  risksList.innerHTML = "";
  (data.risk_factors || []).forEach((r) => {
    const li = document.createElement("li");
    li.innerText = r;
    risksList.appendChild(li);
  });

  // SACCO Print Voucher
  document.getElementById("voucherFarmerName").innerText = currentFarmer.name;
  document.getElementById("voucherCounty").innerText = currentFarmer.county;
  document.getElementById("voucherSacco").innerText = currentFarmer.is_sacco_member === "yes" ? (currentFarmer.sacco_name || "Verified SACCO") : "Direct Farmer Application";
  document.getElementById("voucherGrade").innerText = `Grade ${data.grade} (${data.score}/850)`;
  document.getElementById("voucherCredit").innerText = `KES ${(data.max_recommended_credit_kes || 0).toLocaleString()}`;
}

// CROP GROWTH TRACKER (PHENOLOGY & ACTIONS)
async function loadCropBatches() {
  if (!currentFarmer) return;

  try {
    const res = await fetch(`/api/growth/batches?farmer_id=${currentFarmer.id}`);
    if (!res.ok) return;

    cropBatches = await res.json();
    renderCropPlotsBar();

    const select = document.getElementById("growthActiveBatchSelect");
    if (select) {
      select.innerHTML = "";
      cropBatches.forEach((b) => {
        const opt = document.createElement("option");
        opt.value = b.id;
        opt.innerText = `${b.name} (${b.crop})`;
        select.appendChild(opt);
      });
    }

    if (cropBatches.length > 0) {
      if (!currentPlotId || !cropBatches.find(b => b.id === currentPlotId)) {
        currentPlotId = cropBatches[0].id;
      }
      selectCropPlot(currentPlotId);
    } else {
      document.getElementById("growthEmptyCard").style.display = "block";
      document.getElementById("growthActiveResult").style.display = "none";
      document.getElementById("growthTimelineList").innerHTML = `
        <div style="text-align:center; padding:2rem; color:var(--text-muted);">
          No plots registered yet. Click "+ Register New Plot" to begin tracking.
        </div>`;
    }
  } catch (err) {
    console.error("Crop batches load error:", err);
  }
}

function renderCropPlotsBar() {
  const bar = document.getElementById("cropPlotsBar");
  if (!bar) return;
  bar.innerHTML = "";

  if (cropBatches.length === 0) {
    bar.innerHTML = `<div style="font-size:0.86rem; color:var(--text-muted); padding:0.5rem 0;">No shamba plots tracked yet. Register your first crop plot above!</div>`;
    return;
  }

  cropBatches.forEach((b) => {
    const card = document.createElement("div");
    card.className = `plot-card ${b.id === currentPlotId ? "active" : ""}`;
    card.onclick = () => selectCropPlot(b.id);

    const taskText = b.immediate_tasks && b.immediate_tasks.length > 0 ? b.immediate_tasks[0] : "Inspect crop health";

    card.innerHTML = `
      <div class="plot-card-name">${b.name}</div>
      <div class="plot-card-crop">${b.crop} · ${b.acreage} Acre(s)</div>
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <span class="plot-card-stage">${b.latest_stage}</span>
        <span style="font-size:0.75rem; color:var(--text-muted);">${b.total_logs} photo(s)</span>
      </div>
    `;
    bar.appendChild(card);
  });
}

async function selectCropPlot(batchId) {
  currentPlotId = parseInt(batchId);
  renderCropPlotsBar();

  const select = document.getElementById("growthActiveBatchSelect");
  if (select) select.value = currentPlotId;

  try {
    const res = await fetch(`/api/growth/batch/${currentPlotId}`);
    if (!res.ok) return;

    const data = await res.json();
    renderPlotTimeline(data);
  } catch (err) {
    console.error("Failed loading plot timeline:", err);
  }
}

function renderPlotTimeline(batchData) {
  const emptyCard = document.getElementById("growthEmptyCard");
  const resultCard = document.getElementById("growthActiveResult");
  const timelineList = document.getElementById("growthTimelineList");

  if (!batchData.timeline || batchData.timeline.length === 0) {
    emptyCard.style.display = "block";
    resultCard.style.display = "none";
    timelineList.innerHTML = `
      <div style="text-align:center; padding:2.5rem; color:var(--text-muted);">
        No growth milestone photos logged yet for <strong>${batchData.name}</strong>. Photograph this field to evaluate growth.
      </div>`;
    return;
  }

  emptyCard.style.display = "none";
  resultCard.style.display = "block";

  const latest = batchData.timeline[0];

  resultCard.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.75rem;">
      <div>
        <span class="badge-pill" style="background:#dcfce7; color:#166534; font-weight:700;">${latest.growth_stage}</span>
        <h3 style="font-size:1.15rem; font-weight:800; margin-top:0.3rem;">${batchData.name}</h3>
        <div style="font-size:0.84rem; color:var(--text-muted);">${latest.days_after_planting} Days After Planting (Planted: ${batchData.planting_date})</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:1.5rem; font-weight:800; color:var(--primary);">${latest.health_score}/100</div>
        <div style="font-size:0.75rem; color:var(--text-muted);">Canopy Cover: ${latest.canopy_coverage}</div>
      </div>
    </div>

    <div style="margin-bottom:1rem; font-size:0.88rem; line-height:1.45; background:var(--bg-card-subtle); padding:0.75rem; border-radius:var(--radius-sm); border-left:3px solid var(--primary);">
      ${latest.gemma_analysis}
    </div>

    <div style="margin-bottom:0.5rem;">
      <h4 style="font-size:0.84rem; font-weight:700; text-transform:uppercase; color:var(--primary-dark); margin-bottom:0.4rem;">
        Urgent Shamba Field Tasks:
      </h4>
      <div style="display:flex; flex-direction:column; gap:0.35rem;">
        ${(latest.actionable_tasks || []).map(t => `
          <div style="display:flex; align-items:center; gap:0.5rem; font-size:0.86rem; background:white; padding:0.45rem 0.65rem; border-radius:var(--radius-sm); border:1px solid var(--border);">
            <svg class="icon icon-sm" style="color:var(--primary);" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
            <span>${t}</span>
          </div>
        `).join("")}
      </div>
    </div>

    <div style="margin-top:0.85rem; font-size:0.8rem; color:var(--text-muted);">
      Estimated Harvest Window: ~<strong>${latest.estimated_days_to_harvest}</strong> days remaining.
    </div>
  `;

  // Render Timeline Progression
  timelineList.innerHTML = "";
  batchData.timeline.forEach((item, index) => {
    const el = document.createElement("div");
    el.className = "growth-timeline-item";
    el.innerHTML = `
      <img src="${item.image_url}" class="growth-thumb" alt="Growth Stage Photo">
      <div class="growth-detail-body">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <strong style="font-size:0.92rem;">${item.growth_stage} (${item.days_after_planting} DAP)</strong>
          <span style="font-size:0.75rem; color:var(--text-muted);">${item.created_at}</span>
        </div>
        <p style="font-size:0.84rem; color:var(--text-muted); margin:0.3rem 0;">${item.gemma_analysis}</p>
        <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
          ${(item.actionable_tasks || []).slice(0, 2).map(t => `<span class="badge-pill" style="font-size:0.72rem;">${t}</span>`).join("")}
        </div>
      </div>
    `;
    timelineList.appendChild(el);
  });
}

function openNewPlotModal() {
  const modal = document.getElementById("newPlotModal");
  if (modal) modal.classList.add("active");
  const dateInput = document.getElementById("plotPlantingDate");
  if (dateInput) dateInput.value = new Date().toISOString().split("T")[0];
}

function closeNewPlotModal() {
  const modal = document.getElementById("newPlotModal");
  if (modal) modal.classList.remove("active");
}

async function handleCreatePlotSubmit(e) {
  e.preventDefault();
  if (!currentFarmer) return;

  const name = document.getElementById("plotName").value.trim();
  const crop = document.getElementById("plotCrop").value.trim();
  const variety = document.getElementById("plotVariety").value.trim();
  const acreage = parseFloat(document.getElementById("plotAcreage").value) || 1.0;
  const plantingDate = document.getElementById("plotPlantingDate").value;

  const payload = {
    farmer_id: currentFarmer.id,
    name,
    crop,
    variety: variety || null,
    acreage,
    planting_date: plantingDate,
  };

  try {
    const res = await fetch("/api/growth/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const data = await res.json();
      closeNewPlotModal();
      document.getElementById("newPlotForm").reset();
      await loadCropBatches();
      selectCropPlot(data.id);
    } else {
      const err = await res.json();
      alert("Failed creating plot: " + (err.detail || "Check inputs."));
    }
  } catch (err) {
    alert("Network error: " + err.message);
  }
}

function previewGrowthImage(event) {
  const file = event.target.files[0];
  if (!file) return;

  growthSelectedFile = file;
  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById("growthPreviewImg").src = e.target.result;
    document.getElementById("growthPreviewBox").style.display = "block";
    document.getElementById("growthDropzone").style.display = "none";
    document.getElementById("growthAnalyzeBtn").disabled = false;
  };
  reader.readAsDataURL(file);
}

function clearGrowthPreview(e) {
  if (e) e.stopPropagation();
  growthSelectedFile = null;
  document.getElementById("growthFileInput").value = "";
  document.getElementById("growthPreviewBox").style.display = "none";
  document.getElementById("growthDropzone").style.display = "flex";
  document.getElementById("growthAnalyzeBtn").disabled = true;
}

async function runGrowthAnalysis() {
  if (!growthSelectedFile || !currentPlotId) {
    alert("Please select a plot and upload a photo.");
    return;
  }

  const btn = document.getElementById("growthAnalyzeBtn");
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner"></span> Assessing phenology with Gemma...`;

  const formData = new FormData();
  formData.append("batch_id", currentPlotId);
  formData.append("photo", growthSelectedFile);

  try {
    const res = await fetch("/api/growth/log", {
      method: "POST",
      body: formData,
    });

    if (res.ok) {
      clearGrowthPreview();
      await selectCropPlot(currentPlotId);
      await loadCropBatches();
    } else {
      const err = await res.json();
      alert("Assessment failed: " + (err.detail || "Please retry."));
    }
  } catch (err) {
    alert("Network error: " + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg class="icon icon-sm" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="m12 6 4 6h-8z"/></svg> <span>Analyze Growth Phenology with Gemma</span>`;
  }
}

// CROP DISEASE SCANNER
function previewDiseaseImage(event) {
  const file = event.target.files[0];
  if (!file) return;

  diseaseSelectedFile = file;
  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById("diseasePreviewImg").src = e.target.result;
    document.getElementById("diseasePreviewBox").style.display = "block";
    document.getElementById("diseaseDropzone").style.display = "none";
    document.getElementById("diseaseScanBtn").disabled = false;
  };
  reader.readAsDataURL(file);
}

function clearDiseasePreview(e) {
  if (e) e.stopPropagation();
  diseaseSelectedFile = null;
  document.getElementById("diseaseFileInput").value = "";
  document.getElementById("diseasePreviewBox").style.display = "none";
  document.getElementById("diseaseDropzone").style.display = "flex";
  document.getElementById("diseaseScanBtn").disabled = true;
}

async function runDiseaseScan() {
  if (!diseaseSelectedFile || !currentFarmer) return;

  const btn = document.getElementById("diseaseScanBtn");
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner"></span> Diagnosing symptoms with Gemma...`;

  const cropHint = document.getElementById("diseaseCropHint").value.trim();

  const formData = new FormData();
  formData.append("farmer_id", currentFarmer.id);
  formData.append("crop_type", cropHint || currentFarmer.primary_crop || "Crop");
  formData.append("image", diseaseSelectedFile);

  try {
    const res = await fetch("/api/scan/disease", {
      method: "POST",
      body: formData,
    });

    if (res.ok) {
      const data = await res.json();
      renderDiseaseResult(data);
    } else {
      const err = await res.json();
      alert("Diagnosis failed: " + (err.detail || "Unable to diagnose."));
    }
  } catch (err) {
    alert("Network error: " + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg class="icon icon-sm" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> <span>Diagnose Crop with Gemma</span>`;
  }
}

function renderDiseaseResult(data) {
  const card = document.getElementById("diseaseResultCard");
  card.classList.add("active");

  document.getElementById("resultDiagnosis").innerText = data.diagnosis;
  document.getElementById("resultCrop").innerText = `Crop: ${data.crop_type} · Severity: ${data.severity}`;
  document.getElementById("resultConfidenceBadge").innerText = `${data.confidence_score}% Confidence`;

  document.getElementById("resultSymptoms").innerText = data.symptoms;
  document.getElementById("resultOrganic").innerText = data.organic_treatment;
  document.getElementById("resultChemical").innerText = data.chemical_treatment;
  document.getElementById("resultPrevention").innerText = data.preventative_measures;

  document.getElementById("resultCloudStorageMeta").innerText = `Cloud Archive: DigitalOcean Spaces (${data.model_used || "Gemma 4-26B"})`;

  card.scrollIntoView({ behavior: "smooth" });
}

// Text-to-Speech Controls (Read Aloud & Stop Speaking)
function speakDiagnosis() {
  const diag = document.getElementById("resultDiagnosis").innerText;
  const crop = document.getElementById("resultCrop").innerText;
  const organic = document.getElementById("resultOrganic").innerText;
  const chemical = document.getElementById("resultChemical").innerText;

  const text = `${crop}. Diagnosed condition: ${diag}. Recommended organic remedy: ${organic}. Recommended chemical remedy: ${chemical}.`;
  speakText(text);
}

function speakText(text) {
  if (!window.speechSynthesis) return;
  stopSpeech();

  currentUtterance = new SpeechSynthesisUtterance(text);
  currentUtterance.rate = 0.95;

  const speakBtn = document.getElementById("ttsSpeakBtn");
  const stopBtn = document.getElementById("ttsStopBtn");

  if (speakBtn) speakBtn.style.display = "none";
  if (stopBtn) stopBtn.style.display = "inline-flex";

  currentUtterance.onend = () => {
    if (speakBtn) speakBtn.style.display = "inline-flex";
    if (stopBtn) stopBtn.style.display = "none";
    currentUtterance = null;
  };

  currentUtterance.onerror = () => {
    if (speakBtn) speakBtn.style.display = "inline-flex";
    if (stopBtn) stopBtn.style.display = "none";
    currentUtterance = null;
  };

  window.speechSynthesis.speak(currentUtterance);
}

function stopSpeech() {
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
  const speakBtn = document.getElementById("ttsSpeakBtn");
  const stopBtn = document.getElementById("ttsStopBtn");
  if (speakBtn) speakBtn.style.display = "inline-flex";
  if (stopBtn) stopBtn.style.display = "none";
  currentUtterance = null;
}

// FLOATING VOICE & SALES CHAT ASSISTANT
function toggleFloatingChat() {
  const win = document.getElementById("floatingChatWindow");
  if (win) {
    win.classList.toggle("active");
    if (win.classList.contains("active")) {
      const input = document.getElementById("chatTextInput");
      if (input) input.focus();
    }
  }
}

function clearChatHistory() {
  const box = document.getElementById("chatMessages");
  if (box) {
    box.innerHTML = `
      <div class="chat-bubble bot">
        Jambo mkulima. I am your KilimoGuard copilot. Talk to me in <strong>English</strong>, <strong>Kiswahili</strong>, or <strong>Sheng</strong>.<br><br>
        • Speak or type: <em>"Nimeuza gunia 10 za viazi kwa 3,500 kila moja"</em><br>
        • Or: <em>"Sold 25 crates of tomatoes at 4,800 to Nairobi trader"</em>
      </div>
    `;
  }
}

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

  // DO NOT auto-send: write to input for review as requested by user
  speechRecognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    const input = document.getElementById("chatTextInput");
    const hint = document.getElementById("voiceReviewHint");
    if (input) {
      if (input.value && input.value.trim().length > 0) {
        input.value = input.value.trim() + " " + transcript;
      } else {
        input.value = transcript;
      }
      input.focus();
    }
    if (hint) {
      hint.style.display = "block";
      setTimeout(() => { hint.style.display = "none"; }, 5000);
    }
  };

  speechRecognition.onerror = () => stopVoiceInput();
  speechRecognition.onend = () => stopVoiceInput();
}

function toggleVoiceInput() {
  if (!speechRecognition) {
    alert("Speech recognition is not supported in this browser. You can type directly in the chat box.");
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
  const hint = document.getElementById("voiceReviewHint");
  if (hint) hint.style.display = "none";

  appendChatBubble("user", message);
  const loadingBubble = appendChatBubble("bot", "Analyzing with Gemma AI...");

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
      appendChatBubble("bot", "Pole sana, error communicating with Gemma. Please retry.");
      return;
    }

    const data = await res.json();
    appendChatBubble("bot", data.reply_text);

    // If sale detected, render confirmation card DIRECTLY IN-CHAT
    if (data.is_sale && data.draft_sale) {
      appendChatSaleCard(data.draft_sale, data.market_evaluation);
    }
  } catch (err) {
    loadingBubble.remove();
    appendChatBubble("bot", "Network connection error. Please verify your connection.");
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

// In-Chat Transaction Confirmation Card
function appendChatSaleCard(draft, marketEval) {
  const box = document.getElementById("chatMessages");
  const card = document.createElement("div");
  card.className = "chat-sale-card";

  let marketTagHtml = "";
  if (marketEval && marketEval.has_benchmark) {
    const color = marketEval.status === "above_market" ? "#166534" : (marketEval.status === "below_market" ? "#dc2626" : "#0284c7");
    marketTagHtml = `<div style="font-size:0.75rem; color:${color}; margin-top:0.35rem; font-weight:600;">${marketEval.message}</div>`;
  }

  const encodedDraft = encodeURIComponent(JSON.stringify(draft));

  card.innerHTML = `
    <div class="chat-sale-header">
      <span class="chat-sale-badge">Produce Sale Detected</span>
      <span style="font-size:0.75rem; color:var(--text-muted);">Verification Required</span>
    </div>
    <div class="chat-sale-grid">
      <div><strong>Commodity:</strong> <span>${draft.commodity}</span></div>
      <div><strong>Quantity:</strong> <span>${draft.quantity} ${draft.unit}</span></div>
      <div><strong>Price / Unit:</strong> <span>KES ${(draft.unit_price || 0).toLocaleString()}</span></div>
      <div><strong>Total Amount:</strong> <span style="color:var(--primary-dark);">KES ${(draft.total_amount || 0).toLocaleString()}</span></div>
    </div>
    ${marketTagHtml}
    <div class="chat-sale-actions" style="margin-top:0.75rem;">
      <button class="btn btn-sm btn-primary" onclick="confirmChatTransaction(this, '${encodedDraft}')">
        <svg class="icon icon-sm" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
        Confirm & Add to Ledger
      </button>
      <button class="btn btn-sm btn-secondary" onclick="this.closest('.chat-sale-card').remove()">
        Dismiss
      </button>
    </div>
  `;

  box.appendChild(card);
  box.scrollTop = box.scrollHeight;
}

async function confirmChatTransaction(btn, encodedDraft) {
  if (!currentFarmer) return;

  btn.disabled = true;
  btn.innerText = "Adding to Ledger...";

  const draft = JSON.parse(decodeURIComponent(encodedDraft));

  const payload = {
    farmer_id: currentFarmer.id,
    transaction_type: "income",
    category: "Produce Sale",
    commodity: draft.commodity,
    quantity: draft.quantity,
    unit: draft.unit,
    unit_price: draft.unit_price,
    total_amount: draft.total_amount,
    counterparty: draft.buyer || "Wholesale Buyer",
    notes: "Logged conversationally via Kilimo AI Copilot",
  };

  try {
    const res = await fetch("/api/ledger/transaction", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const card = btn.closest(".chat-sale-card");
      if (card) {
        card.classList.add("confirmed");
        card.innerHTML = `
          <div style="color:#166534; font-weight:700; font-size:0.85rem; display:flex; align-items:center; gap:0.4rem;">
            <svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            Recorded in Farm Ledger · KES ${draft.total_amount.toLocaleString()} (${draft.commodity})
          </div>
        `;
      }
      loadDashboardData();
    } else {
      btn.disabled = false;
      btn.innerText = "Retry Confirmation";
      alert("Failed saving transaction.");
    }
  } catch (err) {
    btn.disabled = false;
    btn.innerText = "Retry Confirmation";
    alert("Network error: " + err.message);
  }
}

// RECEIPT SCANNER
function previewReceiptImage(event) {
  const file = event.target.files[0];
  if (!file) return;

  receiptSelectedFile = file;
  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById("receiptPreviewImg").src = e.target.result;
    document.getElementById("receiptPreviewBox").style.display = "block";
    document.getElementById("receiptDropzone").style.display = "none";
    document.getElementById("receiptScanBtn").disabled = false;
  };
  reader.readAsDataURL(file);
}

function clearReceiptPreview(e) {
  if (e) e.stopPropagation();
  receiptSelectedFile = null;
  document.getElementById("receiptFileInput").value = "";
  document.getElementById("receiptPreviewBox").style.display = "none";
  document.getElementById("receiptDropzone").style.display = "flex";
  document.getElementById("receiptScanBtn").disabled = true;
}

async function runReceiptScan() {
  if (!receiptSelectedFile || !currentFarmer) return;

  const btn = document.getElementById("receiptScanBtn");
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner"></span> Extracting receipt with Gemma OCR...`;

  const formData = new FormData();
  formData.append("farmer_id", currentFarmer.id);
  formData.append("image", receiptSelectedFile);

  try {
    const res = await fetch("/api/scan/receipt", {
      method: "POST",
      body: formData,
    });

    if (res.ok) {
      const data = await res.json();
      renderReceiptResult(data);
    } else {
      const err = await res.json();
      alert("Receipt extraction failed: " + (err.detail || "Unable to parse image."));
    }
  } catch (err) {
    alert("Network error: " + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg class="icon icon-sm" viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> <span>Audit & Extract Receipt with Gemma</span>`;
  }
}

function renderReceiptResult(data) {
  const box = document.getElementById("receiptResultBox");
  const items = data.line_items || [];

  let itemsHtml = items.map(it => `
    <tr>
      <td>${it.item_name}</td>
      <td>${it.quantity}</td>
      <td>KES ${(it.unit_price || 0).toLocaleString()}</td>
      <td style="font-weight:700;">KES ${(it.total_price || 0).toLocaleString()}</td>
    </tr>
  `).join("");

  box.innerHTML = `
    <div style="background:var(--bg-card-subtle); padding:1rem; border-radius:var(--radius-md); margin-bottom:1rem;">
      <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">
        <strong>Merchant:</strong> <span>${data.merchant_name || "Agrovet"}</span>
      </div>
      <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">
        <strong>Receipt Date:</strong> <span>${data.date || "Recent"}</span>
      </div>
      <div style="display:flex; justify-content:space-between; font-size:1.15rem; font-weight:800; color:var(--danger); border-top:1px solid var(--border); padding-top:0.5rem;">
        <span>Total Verified Expense:</span> <span>KES ${(data.total_amount || 0).toLocaleString()}</span>
      </div>
    </div>

    <table class="data-table" style="margin-bottom:1.25rem;">
      <thead>
        <tr>
          <th>Item</th>
          <th>Qty</th>
          <th>Unit Price</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>${itemsHtml || '<tr><td colspan="4">No line items detected</td></tr>'}</tbody>
    </table>

    <button class="btn btn-primary" style="width:100%;" onclick="acceptScannedReceipt(${data.total_amount}, '${encodeURIComponent(data.merchant_name || "Agrovet")}')">
      <svg class="icon icon-sm" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
      Add Scanned Expense to Digital Ledger
    </button>
  `;
}

async function acceptScannedReceipt(amount, encodedMerchant) {
  if (!currentFarmer) return;

  const merchant = decodeURIComponent(encodedMerchant);

  const payload = {
    farmer_id: currentFarmer.id,
    transaction_type: "expense",
    category: "Farm Inputs & Agrovet",
    commodity: "Fertilizer / Agrochemicals / Seed",
    quantity: 1.0,
    unit: "package",
    unit_price: amount,
    total_amount: amount,
    counterparty: merchant,
    notes: "Scanned and verified via Gemma Multimodal Receipt OCR",
  };

  try {
    const res = await fetch("/api/ledger/transaction", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      alert("Receipt expense added to farm ledger!");
      clearReceiptPreview();
      document.getElementById("receiptResultBox").innerHTML = `
        <div style="text-align: center; padding: 3rem 1rem; color: var(--primary);">
          <svg class="icon icon-xl" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          <h3>Receipt Successfully Added</h3>
          <p>Expense logged and farm financial totals updated.</p>
        </div>
      `;
      loadDashboardData();
    }
  } catch (err) {
    alert("Network error: " + err.message);
  }
}

// DIGITAL LEDGER TRANSACTIONS
async function loadLedgerTransactions() {
  if (!currentFarmer) return;

  const type = document.getElementById("ledgerFilterType").value;
  const tbody = document.getElementById("ledgerTableBody");
  tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding:2rem;"><span class="spinner"></span> Loading transactions...</td></tr>`;

  try {
    let url = `/api/ledger/transactions?farmer_id=${currentFarmer.id}`;
    if (type) url += `&type=${type}`;

    const res = await fetch(url);
    if (!res.ok) return;

    const data = await res.json();
    if (data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding:2rem; color:var(--text-muted);">No recorded transactions. Use Voice Chat or Receipt Scanner to add entries.</td></tr>`;
      return;
    }

    tbody.innerHTML = "";
    data.forEach((t) => {
      const tr = document.createElement("tr");
      const isIncome = t.transaction_type === "income";
      const badgeClass = isIncome ? "primary" : "danger";

      tr.innerHTML = `
        <td style="font-size:0.8rem; color:var(--text-muted);">${t.date}</td>
        <td><span class="badge-pill" style="font-size:0.72rem; text-transform:uppercase; background:${isIncome ? '#dcfce7' : '#fee2e2'}; color:${isIncome ? '#166534' : '#991b1b'};">${t.transaction_type}</span></td>
        <td>${t.category}</td>
        <td><strong>${t.commodity}</strong></td>
        <td>${t.quantity} ${t.unit}</td>
        <td>KES ${(t.unit_price || 0).toLocaleString()}</td>
        <td style="font-weight:700; color:${isIncome ? 'var(--primary-dark)' : 'var(--danger)'};">KES ${(t.total_amount || 0).toLocaleString()}</td>
        <td>${t.counterparty || "Direct"}</td>
        <td>${t.receipt_image_url ? `<a href="${t.receipt_image_url}" target="_blank" style="color:var(--primary); font-size:0.78rem;">View</a>` : `<span style="color:var(--text-muted); font-size:0.75rem;">Voice Verified</span>`}</td>
        <td><button class="btn btn-secondary" style="padding:0.2rem 0.5rem; font-size:0.75rem; color:#dc2626;" onclick="deleteLedgerItem(${t.id})">Delete</button></td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error("Ledger load error:", err);
  }
}

async function deleteLedgerItem(id) {
  if (!confirm("Delete this transaction entry?")) return;

  try {
    const res = await fetch(`/api/ledger/transaction/${id}`, { method: "DELETE" });
    if (res.ok) {
      loadLedgerTransactions();
      loadDashboardData();
    }
  } catch (err) {
    alert("Network error: " + err.message);
  }
}

// KENYA MARKET PRICES & GEMMA AI ADVISORY
async function loadMarketPrices() {
  try {
    const res = await fetch("/api/market/prices");
    if (!res.ok) return;

    allMarketPrices = await res.json();
    renderMarketPricesTable(allMarketPrices);
  } catch (err) {
    console.error("Market prices fetch error:", err);
  }
}

function renderMarketPricesTable(prices) {
  const tbody = document.getElementById("marketTableBody");
  if (!tbody) return;

  if (prices.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:1.5rem; color:var(--text-muted);">No matching price benchmarks found.</td></tr>`;
    return;
  }

  tbody.innerHTML = "";
  prices.forEach((p) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${p.commodity}</strong></td>
      <td>${p.market_name} (${p.county})</td>
      <td>${p.unit}</td>
      <td>KES ${(p.price_low || 0).toLocaleString()} - ${(p.price_high || 0).toLocaleString()}</td>
      <td style="font-weight:700; color:var(--primary-dark);">KES ${(p.price_avg || 0).toLocaleString()}</td>
    `;
    tbody.appendChild(tr);
  });
}

function filterMarketPrices() {
  const term = document.getElementById("marketSearchInput").value.toLowerCase().trim();
  const filtered = allMarketPrices.filter(
    (p) => p.commodity.toLowerCase().includes(term) || p.market_name.toLowerCase().includes(term) || p.county.toLowerCase().includes(term)
  );
  renderMarketPricesTable(filtered);
}

async function runPriceCompare() {
  const commodity = document.getElementById("compareCommodity").value;
  const unit = document.getElementById("compareUnit").value.trim();
  const price = parseFloat(document.getElementById("comparePrice").value);

  if (!price || isNaN(price)) {
    alert("Please enter the offered unit price.");
    return;
  }

  const payload = {
    commodity,
    unit_price: price,
    unit: unit || "90kg bag",
    county: currentFarmer ? currentFarmer.county : "Nakuru",
  };

  try {
    const res = await fetch("/api/market/compare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const data = await res.json();
      renderPriceCompareResult(data);
    }
  } catch (err) {
    alert("Error comparing price: " + err.message);
  }
}

function renderPriceCompareResult(data) {
  const box = document.getElementById("compareResultBox");
  box.style.display = "block";

  const color = data.status === "above_market" ? "#166534" : (data.status === "below_market" ? "#dc2626" : "#0284c7");
  const bg = data.status === "above_market" ? "#f0fdf4" : (data.status === "below_market" ? "#fef2f2" : "#f0f9ff");

  box.innerHTML = `
    <div style="background:${bg}; padding:1rem; border-radius:var(--radius-md); border-left:4px solid ${color};">
      <div style="font-weight:700; color:${color}; font-size:0.95rem; margin-bottom:0.3rem;">
        ${data.message}
      </div>
      <div style="font-size:0.84rem; color:var(--text-muted);">
        County Wholesale Benchmark (${data.county}): KES ${data.benchmark_low.toLocaleString()} - ${data.benchmark_high.toLocaleString()} (Average: KES ${data.benchmark_avg.toLocaleString()})
      </div>
    </div>
  `;
}

// Gemma AI Market Advisory & Inter-County Arbitrage
async function runMarketAiAdvisory() {
  const commodity = document.getElementById("marketAiCommodity").value;
  const county = document.getElementById("marketAiCounty").value;
  const question = document.getElementById("marketAiQuestion").value.trim();

  const btn = document.getElementById("marketAiAnalyzeBtn");
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner"></span> Consulting Gemma Agricultural Commodity Analyst...`;

  const payload = { commodity, county, question: question || null };

  try {
    const res = await fetch("/api/market/ai-advisory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const data = await res.json();
      renderMarketAiResult(data);
    } else {
      const err = await res.json();
      alert("Market advisory failed: " + (err.detail || "Gemma service busy."));
    }
  } catch (err) {
    alert("Network error: " + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg class="icon icon-sm" viewBox="0 0 24 24"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg> <span>Analyze Market Strategy with Gemma</span>`;
  }
}

function renderMarketAiResult(data) {
  const box = document.getElementById("marketAiResultBox");
  box.style.display = "block";

  box.innerHTML = `
    <div style="background:var(--bg-card-subtle); padding:1.25rem; border-radius:var(--radius-md); border:1px solid var(--border);">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem; flex-wrap:wrap; gap:0.5rem;">
        <span class="badge-pill" style="background:#fef3c7; color:#92400e; font-weight:700;">Gemma Strategic Verdict</span>
        <span style="font-size:0.78rem; color:var(--text-muted);">${data.commodity} · ${data.county}</span>
      </div>

      <div style="font-size:1.05rem; font-weight:800; color:var(--primary-dark); margin-bottom:0.75rem;">
        ${data.recommendation}
      </div>

      <div class="grid-2" style="gap:0.75rem; margin-bottom:0.75rem;">
        <div style="background:white; padding:0.75rem; border-radius:var(--radius-sm); border:1px solid var(--border);">
          <strong style="font-size:0.8rem; text-transform:uppercase; color:var(--text-muted);">Regional Arbitrage Spread</strong>
          <p style="font-size:0.85rem; margin-top:0.25rem;">${data.arbitrage_analysis}</p>
        </div>
        <div style="background:white; padding:0.75rem; border-radius:var(--radius-sm); border:1px solid var(--border);">
          <strong style="font-size:0.8rem; text-transform:uppercase; color:var(--text-muted);">Fair Farmgate Price Demand</strong>
          <p style="font-size:0.85rem; margin-top:0.25rem; font-weight:700; color:var(--primary-dark);">${data.fair_farmgate_range}</p>
        </div>
      </div>

      <div class="grid-2" style="gap:0.75rem;">
        <div style="background:white; padding:0.75rem; border-radius:var(--radius-sm); border:1px solid var(--border);">
          <strong style="font-size:0.8rem; text-transform:uppercase; color:var(--text-muted);">30-60 Day Seasonal Trend</strong>
          <p style="font-size:0.85rem; margin-top:0.25rem;">${data.seasonal_outlook}</p>
        </div>
        <div style="background:white; padding:0.75rem; border-radius:var(--radius-sm); border:1px solid var(--border);">
          <strong style="font-size:0.8rem; text-transform:uppercase; color:var(--text-muted);">Broker Negotiation Tip</strong>
          <p style="font-size:0.85rem; margin-top:0.25rem;">${data.negotiation_tip}</p>
        </div>
      </div>
    </div>
  `;

  box.scrollIntoView({ behavior: "smooth" });
}
