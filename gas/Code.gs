// AI or Human? — Google Apps Script wrapper
// Proxies API calls to the Cloudflare backend to avoid CORS restrictions.

var API_BASE = "https://mobeauchoho.org";

// ---------- routing ----------
function doGet(e) {
  var page = (e && e.parameter && e.parameter.page) || "index";
  if (page === "stats") {
    return serveStats();
  }
  return serveIndex();
}

// ---------- index page ----------
function serveIndex() {
  return HtmlService.createHtmlOutputFromFile("index")
    .setTitle("AI or Human?")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ---------- stats page ----------
function serveStats() {
  var statsJson = fetchStatsJson_();
  var template = HtmlService.createTemplateFromFile("stats");
  template.statsJson = statsJson !== null ? statsJson : "null";
  return template.evaluate()
    .setTitle("Quiz Results")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function fetchStatsJson_() {
  try {
    var resp = UrlFetchApp.fetch(API_BASE + "/api/stats", {
      muteHttpExceptions: true,
      headers: { "Accept": "application/json" }
    });
    if (resp.getResponseCode() === 200) {
      return resp.getContentText();
    }
  } catch (err) {
    Logger.log("fetchStatsJson_ error: " + err);
  }
  return null;
}

// ---------- client-callable: submit quiz results ----------
// Called from the browser via google.script.run.submitQuizData(payload).
// Proxies the payload to the Cloudflare Worker, bypassing CORS.
function submitQuizData(payload) {
  try {
    UrlFetchApp.fetch(API_BASE + "/api/submit", {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
  } catch (err) {
    Logger.log("submitQuizData error: " + err);
    // swallow — telemetry must never surface as an error to the user
  }
}
