// כאן אתה יכול לשנות את שם שכבת היישובים ואת שם השדה של שם היישוב
const SETTLEMENT_LAYER = "יישובים";   // או מה שהשם המדויק בגובמפה
const CITY_FIELD = "SHEM_YISHUV";      // או HEB_NAME / שם_ישוב וכו' – תעדכן לפי הקונסול

// פונקציה שמופעלת כשה-SCRIPT של GovMap נטען
function initGovMap() {
  govmap.createMap("map", {
    token: "ede9a5fd-7c23-432f-8ffb-d85feffa3f3c", // הטוקן שלך
    layers: [SETTLEMENT_LAYER],
    background: 2,
    layersMode: 1,
    zoomButtons: true,
    level: 8,
    showXY: true,
    identifyOnClick: false
  });

  // האזנה לקליקים על המפה
  govmap.onEvent(govmap.events.CLICK).progress(onMapClick);
}

// מה קורה כשלוחצים על המפה
async function onMapClick(e) {
  try {
    // שלב 1: מבקשים מגובמפה מה היישוב בנקודה שנלחצה
    const res = await govmap.selectFeaturesOnMap({
      drawType: govmap.drawType.Point,
      x: e.mapPoint.x,
      y: e.mapPoint.y,
      layers: [SETTLEMENT_LAYER],
      filterLayer: true,
      isZoomToExtent: false,
      returnFields: {
        [SETTLEMENT_LAYER]: [CITY_FIELD]
      }
    });

    console.log("selectFeaturesOnMap response:", res);

    // ⬅️ כאן צריך לשלוף את שם היישוב מתוך התשובה
    // המבנה המדויק תלוי בגובמפה – לכן נוציא אותו לפונקציה נפרדת
    const cityName = extractCityName(res);

    if (!cityName) {
      showMessage("לא זוהה יישוב בנקודה שנבחרה.");
      return;
    }

    console.log("יישוב שזוהה:", cityName);

    // שלב 2: מציגים את נתוני הפשיעה מה-crimeDB
    showCrimeData(cityName);

  } catch (err) {
    console.error("שגיאה בקריאה ל-selectFeaturesOnMap:", err);
    showMessage("אירעה שגיאה בעת קריאת הנתונים מהמפה.");
  }
}

// ⬅️ כאן אתה תתאים את הקוד לפי מה שאתה רואה ב-console
function extractCityName(res) {
  // בגרסאות רבות של GovMap זה מחזיר אובייקט כזה:
  // { "יישובים": [ { SHEM_YISHUV: "אבו גוש", ... }, ... ] }

  if (!res) return null;

  // נסה קודם כמבנה של אובייקט עם שם שכבה
  if (res[SETTLEMENT_LAYER] && res[SETTLEMENT_LAYER].length > 0) {
    const feature = res[SETTLEMENT_LAYER][0];
    return (feature[CITY_FIELD] || "").toString().trim();
  }

  // במקרים אחרים זה יכול להיות פשוט מערך
  if (Array.isArray(res) && res.length > 0) {
    const feature = res[0];
    if (feature && feature[CITY_FIELD]) {
      return feature[CITY_FIELD].toString().trim();
    }
  }

  return null;
}

// מציג טקסט כללי בפאנל
function showMessage(text) {
  const panel = document.getElementById("cityInfo");
  panel.innerHTML = `<p>${text}</p>`;
}

// מציג את נתוני הפשיעה מה-crimeDB
function showCrimeData(cityName) {
  const panel = document.getElementById("cityInfo");

  const data = crimeDB[cityName];

  if (!data) {
    panel.innerHTML = `
      <h3>${cityName}</h3>
      <p>אין נתונים בטבלה עבור יישוב זה.</p>
    `;
    return;
  }

  let html = `<h3>${cityName}</h3>`;
  html += `<p><strong>סה"כ עבירות:</strong> ${data.total}</p>`;
  html += `<h4>פירוט לפי קבוצת עבירה:</h4>`;
  html += `<ul>`;

  for (const [type, count] of Object.entries(data.breakdown)) {
    html += `<li class="crime-type"><strong>${type}:</strong> ${count}</li>`;
  }

  html += `</ul>`;

  panel.innerHTML = html;
}
