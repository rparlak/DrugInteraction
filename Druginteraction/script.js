// ------------------------
// Brand -> Generic aliases
// ------------------------
const ALIASES = {
  flagyl: "metronidazole",
  dolorex: "diclofenac",
  apranax: "naproxen",
  ibucold: "ibuprofen",
  parol: "paracetamol",
  majezik: "flurbiprofen",
};

// ------------------------
// Medication list for autocomplete
// ------------------------
const MEDICATION_LIST = [
  "Warfarin","Heparin","Enoxaparin","Clopidogrel","Aspirin","Rivaroxaban","Apixaban","Dabigatran",
  "Paracetamol","Ibuprofen","Diclofenac","Naproxen","Ketoprofen","Flurbiprofen","Majezik",
  "Parol","Dolorex","Apranax","Ibucold",
  "Metronidazole","Flagyl","Amoxicillin","Amoxicillin-Clavulanate","Ciprofloxacin",
  "Levofloxacin","Clarithromycin","Azithromycin","Erythromycin","Doxycycline",
  "Trimethoprim-Sulfamethoxazole","Rifampin",
  "Losartan","Valsartan","Enalapril","Ramipril","Amlodipine","Nifedipine",
  "Bisoprolol","Metoprolol","Atenolol","Carvedilol",
  "Hydrochlorothiazide","Furosemide","Spironolactone",
  "Metformin","Insulin","Glibenclamide","Glimepiride","Sitagliptin","Empagliflozin",
  "Atorvastatin","Simvastatin","Rosuvastatin","Pravastatin",
  "Omeprazole","Pantoprazole","Esomeprazole","Lansoprazole","Ranitidine","Famotidine",
  "Diazepam","Alprazolam","Lorazepam","Sertraline","Fluoxetine","Paroxetine",
  "Citalopram","Escitalopram","Venlafaxine",
  "Salbutamol","Montelukast","Desloratadine","Loratadine","Cetirizine",
  "Levothyroxine","Digoxin","Theophylline","Carbamazepine","Phenytoin",
  "Valproic Acid","Allopurinol","Colchicine","Methotrexate",
];

// ------------------------
// Helpers
// ------------------------
const norm = (s) =>
  (s || "").trim().toLowerCase().replace(/\s+/g, " ");

const toGeneric = (name) => {
  const n = norm(name);
  return ALIASES[n] || n;
};

// Kullanıcı ne yazdıysa onu gösterelim (Flagyl yazdıysa Flagyl görünsün)
// ama parantez içinde active ingredient de gösterelim:
function displayNameForGeneric(genericName, enteredDrugs) {
  const g = norm(genericName);
  const match = enteredDrugs.find((d) => toGeneric(d) === g);
  if (match) return `${match} (${genericName})`;
  return genericName;
}

// ------------------------
// UI elements
// ------------------------
const form = document.getElementById("drugForm");
const resetBtn = document.getElementById("resetBtn");
const resultsEl = document.getElementById("results");
const summaryText = document.getElementById("summaryText");
const hint = document.getElementById("hint");
const badges = Array.from(document.querySelectorAll(".pill-badges .badge"));
const inputs = Array.from(document.querySelectorAll(".drug-input"));

let lastResults = [];
let activeFilter = "ALL"; // ALL | Minor | Moderate | Major

function setHint(text) {
  if (hint) hint.textContent = text;
}

function setActiveBadge() {
  badges.forEach((b) => b.classList.remove("active"));
  const active = badges.find((b) => (b.dataset.filter || "") === activeFilter);
  if (active) active.classList.add("active");
}

function getDrugList() {
  const raw = inputs.map((i) => i.value.trim()).filter(Boolean);

  // same generic tekrar girilmesin
  const seen = new Set();
  const unique = [];
  for (const drug of raw) {
    const key = toGeneric(drug);
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(drug);
    }
  }
  return unique;
}

// ------------------------
// ✅ SQL Server API call
// (Siteyi http://localhost:3001 üzerinden açınca relative yol çalışır)
// ------------------------
async function fetchInteractionsFromServer(drugs) {
  const res = await fetch("/check-interactions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ drugs }),
  });

  const text = await res.text();

  if (!res.ok) {
    try {
      const data = JSON.parse(text);
      throw new Error(data.message || data.details || "API request failed.");
    } catch {
      throw new Error(text || "API request failed.");
    }
  }

  return JSON.parse(text); // recordset array
}

function sevClass(sev) {
  const s = (sev || "").toLowerCase();
  if (s.includes("major")) return "major";
  if (s.includes("moderate")) return "moderate";
  return "minor";
}

function renderResults(all) {
  resultsEl.innerHTML = "";

  const filtered =
    activeFilter === "ALL"
      ? all
      : all.filter(
          (x) => (x.severity || "").toLowerCase() === activeFilter.toLowerCase()
        );

  const counts = { Major: 0, Moderate: 0, Minor: 0 };
  all.forEach((x) => {
    if (counts[x.severity] !== undefined) counts[x.severity]++;
  });

  if (!all.length) {
    summaryText.textContent = "No interactions found in the current dataset.";
    resultsEl.innerHTML = `<div class="empty">✅ No interactions were detected (based on available rules).</div>`;
    return;
  }

  summaryText.textContent =
    `Found ${all.length} interaction(s): Major ${counts.Major}, Moderate ${counts.Moderate}, Minor ${counts.Minor}.` +
    (activeFilter === "ALL" ? "" : ` (Filtered: ${activeFilter})`);

  if (!filtered.length) {
    resultsEl.innerHTML = `<div class="empty">No interactions match the selected filter (${activeFilter}).</div>`;
    return;
  }

  filtered.forEach((item) => {
    const sevCls = sevClass(item.severity);
    const title = `${item.drugA} ↔ ${item.drugB}`;

    const div = document.createElement("div");
    div.className = "result-item";
    div.innerHTML = `
      <div class="sev ${sevCls}">${item.severity}</div>
      <div class="result-body">
        <h3>${title}</h3>
        <p>${item.desc || ""}</p>
      </div>
    `;
    resultsEl.appendChild(div);
  });
}

async function runCheck() {
  const drugs = getDrugList();

  if (drugs.length < 2) {
    setHint("Please enter at least two medications.");
    summaryText.textContent = "Not enough input to run the check.";
    resultsEl.innerHTML = `<div class="empty">⚠️ Enter at least two medications, then click <b>Check Interactions</b>.</div>`;
    lastResults = [];
    return;
  }

  setHint("Checking interactions...");
  summaryText.textContent = "Checking...";
  resultsEl.innerHTML = `<div class="empty">⏳ Running interaction check...</div>`;

  try {
    const rows = await fetchInteractionsFromServer(drugs);

    // rows: [{IngredientA, IngredientB, Severity, Description}]
    lastResults = rows.map((r) => {
      const a = r.IngredientA ?? "";
      const b = r.IngredientB ?? "";

      return {
        drugA: displayNameForGeneric(a, drugs),
        drugB: displayNameForGeneric(b, drugs),
        severity: r.Severity ?? "",
        desc: r.Description ?? "",
      };
    });

    setHint("Check completed.");
    renderResults(lastResults);
  } catch (err) {
    setHint("Error.");
    summaryText.textContent = "Error while checking interactions.";
    resultsEl.innerHTML = `<div class="empty">❌ ${err.message}</div>`;
    lastResults = [];
  }
}

// ------------------------
// Events
// ------------------------
form.addEventListener("submit", (e) => {
  e.preventDefault();
  runCheck();
});

resetBtn.addEventListener("click", () => {
  inputs.forEach((i) => (i.value = ""));
  lastResults = [];
  activeFilter = "ALL";
  setActiveBadge();
  setHint("Enter at least two medications to run the check.");
  summaryText.textContent = "No results yet. Run a check to see interactions.";
  resultsEl.innerHTML = `<div class="empty">No results to display.</div>`;
});

badges.forEach((badge) => {
  badge.addEventListener("click", () => {
    activeFilter = badge.dataset.filter || "ALL";
    setActiveBadge();
    renderResults(lastResults);
  });
});

// ------------------------
// Autocomplete
// ------------------------
inputs.forEach((input) => {
  const box = document.createElement("div");
  box.className = "autocomplete-box";
  input.parentNode.style.position = "relative";
  input.parentNode.appendChild(box);

  input.addEventListener("input", () => {
    const value = input.value.toLowerCase();
    box.innerHTML = "";
    if (!value) return;

    MEDICATION_LIST
      .filter((name) => name.toLowerCase().startsWith(value))
      .slice(0, 6)
      .forEach((name) => {
        const item = document.createElement("div");
        item.textContent = name;
        item.className = "autocomplete-item";
        item.addEventListener("click", () => {
          input.value = name;
          box.innerHTML = "";
        });
        box.appendChild(item);
      });
  });

  document.addEventListener("click", (e) => {
    if (!input.contains(e.target) && !box.contains(e.target)) box.innerHTML = "";
  });
});

// Init
setActiveBadge();
setHint("Enter at least two medications to run the check.");
