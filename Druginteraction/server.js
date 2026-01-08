const express = require("express");
const sql = require("mssql");
const cors = require("cors");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

// Frontend dosyaları (index.html, style.css, script.js)
app.use(express.static(__dirname));

const dbConfig = {
  user: "dicas_api",
  password: "Dicas_2025!Strong",
  server: "localhost\\SQLEXPRESS",   // ✅ instance böyle verilir
  database: "DrugInteractionDB",
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
};

// Test
app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

// Interaction endpoint
app.post("/check-interactions", async (req, res) => {
  try {
    const { drugs } = req.body;

    if (!Array.isArray(drugs) || drugs.length < 2) {
      return res.status(400).json({ message: "At least two drugs required." });
    }

    const cleaned = drugs.map(x => (x || "").trim()).filter(Boolean);
    if (cleaned.length < 2) {
      return res.status(400).json({ message: "At least two valid drug names required." });
    }

    const pool = await sql.connect(dbConfig);

    const result = await pool
      .request()
      .input("DrugList", sql.NVarChar(sql.MAX), cleaned.join(","))
      .execute("usp_CheckInteractions");

    // ✅ Alan adlarını garanti etmek istersen (front-end rahat okur)
    const rows = (result.recordset || []).map(r => ({
      IngredientA: r.IngredientA,
      IngredientB: r.IngredientB,
      Severity: r.Severity,
      Description: r.Description
    }));

    res.json(rows);
  } catch (err) {
    console.error("DB ERROR:", err);
    res.status(500).json({ error: "Database error", details: err.message });
  }
});

// Ana sayfa
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Start
const PORT = 3001;
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
