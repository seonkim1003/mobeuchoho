// Public stats dashboard for /api/stats.
// Render-only: no submissions or PII here.

const MOCK_API = false;
const STATS_ENDPOINT = "/api/stats";

const MOCK_STATS = {
  n_sessions: 1234,
  overall_accuracy: 0.61,
  per_genre: {
    "Literary fiction": { n: 1234, accuracy: 0.58 },
    "Detective fiction": { n: 1230, accuracy: 0.66 },
    "Essay / opinion": { n: 1229, accuracy: 0.55 },
    "Nature writing": { n: 1231, accuracy: 0.6 },
    "Poetry": { n: 1234, accuracy: 0.42 }
  },
  updated_at: Date.now()
};

function formatPct(x) {
  if (typeof x !== "number" || !isFinite(x)) return "—";
  return (x * 100).toFixed(1) + "%";
}

function formatTimestamp(ms) {
  if (typeof ms !== "number" || !isFinite(ms)) return "—";
  try {
    return new Date(ms).toLocaleString();
  } catch (_) {
    return "—";
  }
}

function renderStats(data) {
  document.getElementById("stat-sessions").textContent =
    typeof data.n_sessions === "number" ? data.n_sessions.toLocaleString() : "—";
  document.getElementById("stat-accuracy").textContent = formatPct(data.overall_accuracy);
  document.getElementById("stat-updated").textContent = formatTimestamp(data.updated_at);

  const list = document.getElementById("stat-genres");
  list.innerHTML = "";
  const genres = data.per_genre || {};
  const keys = Object.keys(genres).sort();
  keys.forEach(name => {
    const row = genres[name] || {};
    const pct = typeof row.accuracy === "number" ? row.accuracy : 0;
    const li = document.createElement("li");
    li.className = "genre-row";
    li.innerHTML = `
      <div class="genre-meta">
        <span class="genre-name"></span>
        <span class="genre-stats">
          <span class="genre-acc"></span>
          <span class="genre-n"></span>
        </span>
      </div>
      <div class="genre-bar"><div class="genre-bar-fill"></div></div>
    `;
    li.querySelector(".genre-name").textContent = name;
    li.querySelector(".genre-acc").textContent = formatPct(row.accuracy);
    li.querySelector(".genre-n").textContent =
      typeof row.n === "number" ? `n=${row.n.toLocaleString()}` : "";
    li.querySelector(".genre-bar-fill").style.width =
      Math.max(0, Math.min(1, pct)) * 100 + "%";
    list.appendChild(li);
  });
}

function showState({ loading, error, content }) {
  document.getElementById("stats-loading").hidden = !loading;
  document.getElementById("stats-error").hidden = !error;
  document.getElementById("stats-content").hidden = !content;
}

async function loadStats() {
  showState({ loading: true });
  try {
    let data;
    if (MOCK_API) {
      data = MOCK_STATS;
    } else {
      const res = await fetch(STATS_ENDPOINT, { headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error("bad status " + res.status);
      data = await res.json();
    }
    renderStats(data);
    showState({ content: true });
  } catch (_) {
    showState({ error: true });
  }
}

document.addEventListener("DOMContentLoaded", loadStats);
