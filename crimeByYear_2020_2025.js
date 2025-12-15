<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>מפת פשיעה – לפי רשות ולפי שנה (2020–2025)</title>

  <!-- נתוני פשיעה -->
  <script src="crimeByYear_2020_2025.js"></script>

  <style>
    html, body {
      margin: 0;
      padding: 0;
      height: 100%;
      font-family: Arial, sans-serif;
      overflow: hidden;
    }
    #map { width: 100%; height: 100%; }

    #info-panel {
      position: absolute;
      top: 10px;
      left: 10px;
      z-index: 9999;
      background: #fff;
      padding: 10px 14px;
      border-radius: 10px;
      width: 440px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.25);
      font-size: 14px;
    }

    #controls {
      display: flex;
      gap: 10px;
      align-items: center;
      margin-bottom: 10px;
      flex-wrap: wrap;
    }

    #yearSelect, button {
      padding: 6px 8px;
      border-radius: 8px;
      border: 1px solid #ccc;
      font-size: 14px;
      background: #fff;
      cursor: pointer;
    }
    button:hover { background: #f5f5f5; }

    #info-title { font-weight: bold; margin-bottom: 6px; }
    #info-body  { white-space: pre-line; max-height: 65vh; overflow-y: auto; }
    #small-note { font-size: 12px; opacity: 0.8; margin-top: 6px; }
  </style>

  <script>
    /* ===== קונפיגורציה ===== */
    const MUNICIPAL_LAYER = "125";
    const TOKEN = "ede9a5fd-7c23-432f-8ffb-d85feffa3f3c";

    let mapInitialized = false;
    let currentYear = "2025";

    // normalized -> { name, data }
    const muniIndex = {};
    let unmatchedMunicipalities = [];

    /* ===== נרמול שמות ===== */
    function normalizeMunicipalityKey(name) {
      let s = (name ?? "").toString().trim();
      s = s
        .replace(/^עיריית\s+/g, "")
        .replace(/^עיריה\s+/g, "")
        .replace(/^מועצה\s+אזורית\s+/g, "")
        .replace(/^מועצה\s+מקומית\s+/g, "");
      s = s.replace(/["׳״']/g, "");
      s = s.replace(/[\s\-]/g, "");
      return s.toLowerCase();
    }

    /* ===== בניית אינדקס לשנה ===== */
    function buildIndexForYear(year) {
      for (const k in muniIndex) delete muniIndex[k];
      const yearData = window.crimeByYear?.[year];
      if (!yearData) return;

      for (const name in yearData) {
        muniIndex[normalizeMunicipalityKey(name)] = {
          name,
          data: yearData[name]
        };
      }
      console.log(`Year: ${year} muniIndex size:`, Object.keys(muniIndex).length);
    }

    /* ===== UI ===== */
    function showInfo(title, body) {
      document.getElementById("info-title").textContent = title;
      document.getElementById("info-body").textContent = body;
    }

    function showEntry(entry) {
      const d = entry.data;
      const lines = [];
      lines.push(`שנה: ${currentYear}`);
      if (d.total !== undefined) lines.push(`סה״כ אירועים: ${d.total}\n`);
      if (d.breakdown) {
        for (const k in d.breakdown) {
          lines.push(`• ${k}: ${d.breakdown[k]}`);
        }
      }
      showInfo(`רשות: ${entry.name}`, lines.join("\n"));
    }

    /* ===== GovMap helpers ===== */
    function fieldsToObject(fields) {
      if (!Array.isArray(fields)) return fields;
      const o = {};
      for (const f of fields) o[f.FieldName] = f.Value;
      return o;
    }

    function pickHebrewField(attrs) {
      for (const k in attrs) {
        if (typeof attrs[k] === "string" && /[\u0590-\u05FF]/.test(attrs[k])) {
          return { key: k, value: attrs[k] };
        }
      }
      return null;
    }

    function detectMunicipalityNameFromAttrs(attrsRaw) {
      const attrs = fieldsToObject(attrsRaw);
      const candidates = ["שם רשות", "שם רשות מקומית", "שם ישוב", "ישוב סופי"];
      for (const c of candidates) {
        if (attrs && attrs[c]) return attrs[c];
      }
      const any = attrs ? pickHebrewField(attrs) : null;
      return any ? any.value : null;
    }

    /* ===== UNMATCHED – שימוש ב-getLayerData + BBOX ===== */
    async function findUnmatchedMunicipalities() {
      if (!mapInitialized) return;

      try {
        const resp = await govmap.getLayerData({
          layerName: MUNICIPAL_LAYER,
          xmin: 120000, ymin: 380000, xmax: 300000, ymax: 800000
        });

        const items = resp?.data || resp?.Data || [];
        const list = [];

        for (const item of items) {
          const attrs = item.Fields || item.Attributes || item;
          const name = detectMunicipalityNameFromAttrs(attrs);
          if (!name) continue;

          const norm = normalizeMunicipalityKey(name);
          if (!muniIndex[norm]) {
            list.push({ original: name, normalized: norm });
          }
        }

        list.sort((a,b)=>a.original.localeCompare(b.original,"he"));
        unmatchedMunicipalities = list;
        window.unmatchedMunicipalities = list;

        console.group("❌ UNMATCHED (bbox)");
        list.forEach(u => console.log(u.original, "→", u.normalized));
        console.groupEnd();
        console.log("סה״כ ללא התאמה:", list.length);

        document.getElementById("unmatchedCount").textContent = list.length;
      } catch (err) {
        console.error("UNMATCHED scan failed:", err);
        showInfo("שגיאה בסריקה", String(err?.message || err));
      }
    }

    function showUnmatchedOnSite() {
      if (!unmatchedMunicipalities || unmatchedMunicipalities.length === 0) {
        showInfo("UNMATCHED", "אין כרגע יישובים ללא התאמה 🎉");
        return;
      }
      const lines = [];
      lines.push(`UNMATCHED לשנה ${currentYear}: ${unmatchedMunicipalities.length}\n`);
      for (const u of unmatchedMunicipalities) {
        lines.push(`• ${u.original}  →  ${u.normalized}`);
      }
      showInfo("רשימת יישובים ללא התאמה", lines.join("\n"));
    }

    /* ===== Init map ===== */
    function initGovMap() {
      if (!window.crimeByYear) {
        showInfo("שגיאה", "crimeByYear לא נטען");
        return;
      }

      const years = Object.keys(window.crimeByYear).sort();
      const sel = document.getElementById("yearSelect");
      sel.innerHTML = "";
      years.forEach(y => {
        const opt = document.createElement("option");
        opt.value = y;
        opt.textContent = y;
        sel.appendChild(opt);
      });

      currentYear = years.includes("2025") ? "2025" : years[0];
      sel.value = currentYear;
      buildIndexForYear(currentYear);

      sel.addEventListener("change", async e => {
        currentYear = e.target.value;
        buildIndexForYear(currentYear);
        showInfo("מפת פשיעה לפי רשות", `שנה נבחרת: ${currentYear}`);
        document.getElementById("unmatchedCount").textContent = "…";
        await findUnmatchedMunicipalities();
      });

      document.getElementById("btnShowUnmatched").addEventListener("click", showUnmatchedOnSite);

      govmap.createMap("map", {
        token: TOKEN,
        layers: [MUNICIPAL_LAYER],
        layersMode: 1,
        background: 2,
        zoomButtons: true,
        identifyOnClick: false,
        onLoad: async () => {
          mapInitialized = true;
          govmap.onEvent(govmap.events.CLICK).progress(onMapClick);
          showInfo("מפת פשיעה לפי רשות", `שנה נבחרת: ${currentYear}`);
          await findUnmatchedMunicipalities();
        }
      });
    }

    /* ===== Click handler ===== */
    async function onMapClick(e) {
      if (!mapInitialized) return;

      const resp = await govmap.getLayerData({
        layerName: MUNICIPAL_LAYER,
        Point: e.mapPoint,
        Radius: 300
      });

      const items = resp?.data || resp?.Data || [];
      if (!items.length) return;

      const attrs = items[0].Fields || items[0].Attributes || items[0];
      const name = detectMunicipalityNameFromAttrs(attrs);
      const key = normalizeMunicipalityKey(name);
      const entry = muniIndex[key];

      if (!entry) {
        showInfo("לא נמצאה התאמה",
          `שנה: ${currentYear}\nשם מהשכבה: ${name}\nמפתח: ${key}`);
        return;
      }

      showEntry(entry);
    }
  </script>

  <!-- GovMap API -->
  <script
    src="https://www.govmap.gov.il/govmap/api/govmap.api.js"
    defer
    onload="initGovMap()">
  </script>
</head>

<body>
  <div id="map"></div>

  <div id="info-panel">
    <div id="controls">
      <label for="yearSelect">שנה:</label>
      <select id="yearSelect"></select>
      <button id="btnShowUnmatched" type="button">הצג UNMATCHED</button>
    </div>

    <div id="info-title">מפת פשיעה לפי רשות</div>
    <div id="info-body">טוען נתונים…</div>

    <div id="small-note">
      UNMATCHED: <b id="unmatchedCount">…</b>
    </div>
  </div>
</body>
</html>
