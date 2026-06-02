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
  demographics: {
    age_band: { "25_34": { n: 600, accuracy: 0.65 }, "35_44": { n: 400, accuracy: 0.58 }, "prefer_not": { n: 234, accuracy: 0.5 } },
    education: { "bachelors": { n: 700, accuracy: 0.62 }, "masters": { n: 300, accuracy: 0.7 }, "hs": { n: 234, accuracy: 0.55 } },
    native_english: { "yes": { n: 900, accuracy: 0.63 }, "no": { n: 334, accuracy: 0.55 } },
    gender: { "female": { n: 500, accuracy: 0.6 }, "male": { n: 500, accuracy: 0.62 }, "non_binary": { n: 100, accuracy: 0.65 }, "prefer_not": { n: 134, accuracy: 0.55 } },
    ai_familiarity: { "never": { n: 200, accuracy: 0.5 }, "sometimes": { n: 700, accuracy: 0.62 }, "daily": { n: 334, accuracy: 0.68 } }
  },
  survey: {
    learned: { yes: { n: 700 }, somewhat: { n: 400 }, no: { n: 134 } },
    useful: { very: { n: 600 }, somewhat: { n: 500 }, not: { n: 134 } },
    rating: { "1": { n: 40 }, "2": { n: 80 }, "3": { n: 300 }, "4": { n: 500 }, "5": { n: 314 } },
    confidence: { much_more: { n: 300 }, somewhat_more: { n: 600 }, same: { n: 300 }, less: { n: 34 } },
    ai_changed: { yes: { n: 500 }, somewhat: { n: 600 }, no: { n: 134 } },
    learned_ai: { yes: { n: 800 }, somewhat: { n: 300 }, no: { n: 134 } },
    course_effectiveness: { very: { n: 700 }, somewhat: { n: 400 }, neutral: { n: 100 }, not: { n: 34 } },
    avg_rating: 3.85,
    n_responses: 1234
  },
  updated_at: Date.now()
};

// Display order + human-readable labels for each demographic bucket.
const DEMO_META = {
  age_band: {
    title: "Age",
    type: "bar",
    order: ["under_18", "18_24", "25_34", "35_44", "45_54", "55_64", "65_plus", "prefer_not"],
    labels: {
      under_18: "Under 18",
      "18_24": "18–24",
      "25_34": "25–34",
      "35_44": "35–44",
      "45_54": "45–54",
      "55_64": "55–64",
      "65_plus": "65+",
      prefer_not: "Prefer not to say"
    }
  },
  education: {
    title: "Education",
    type: "bar",
    order: ["less_than_hs", "hs", "some_college", "bachelors", "masters", "doctorate", "prefer_not"],
    labels: {
      less_than_hs: "Less than HS",
      hs: "High school",
      some_college: "Some college",
      bachelors: "Bachelor's",
      masters: "Master's",
      doctorate: "Doctorate",
      prefer_not: "Prefer not to say"
    }
  },
  native_english: {
    title: "Native English speaker",
    type: "donut",
    order: ["yes", "no", "prefer_not"],
    labels: { yes: "Yes", no: "No", prefer_not: "Prefer not to say" }
  },
  gender: {
    title: "Gender",
    type: "donut",
    order: ["female", "male", "non_binary", "self_describe", "prefer_not"],
    labels: {
      female: "Female",
      male: "Male",
      non_binary: "Non-binary",
      self_describe: "Self-describe",
      prefer_not: "Prefer not to say"
    }
  },
  ai_familiarity: {
    title: "AI tool usage",
    type: "donut",
    order: ["never", "sometimes", "daily", "prefer_not"],
    labels: { never: "Never", sometimes: "Sometimes", daily: "Daily", prefer_not: "Prefer not to say" }
  }
};

// Display order + human-readable labels for each post-survey question.
const SURVEY_META = {
  learned: {
    title: "Did the quiz teach you something new?",
    type: "donut",
    order: ["yes", "somewhat", "no"],
    labels: { yes: "Yes", somewhat: "Somewhat", no: "No" }
  },
  useful: {
    title: "How useful was the information?",
    type: "bar",
    order: ["very", "somewhat", "not"],
    labels: { very: "Very useful", somewhat: "Somewhat useful", not: "Not useful" }
  },
  rating: {
    title: "Overall rating",
    type: "bar",
    order: ["1", "2", "3", "4", "5"],
    labels: { "1": "1 star", "2": "2 stars", "3": "3 stars", "4": "4 stars", "5": "5 stars" }
  },
  confidence: {
    title: "Confidence spotting AI content",
    type: "bar",
    order: ["much_more", "somewhat_more", "same", "less"],
    labels: {
      much_more: "Much more confident",
      somewhat_more: "Somewhat more confident",
      same: "About the same",
      less: "Less confident"
    }
  },
  ai_changed: {
    title: "Has your idea about AI changed?",
    type: "donut",
    order: ["yes", "somewhat", "no"],
    labels: { yes: "Yes", somewhat: "Somewhat", no: "No" }
  },
  learned_ai: {
    title: "Did you learn more about AI?",
    type: "donut",
    order: ["yes", "somewhat", "no"],
    labels: { yes: "Yes", somewhat: "Somewhat", no: "No" }
  },
  course_effectiveness: {
    title: "How effective/easy was the course?",
    type: "bar",
    order: ["very", "somewhat", "neutral", "not"],
    labels: {
      very: "Very effective",
      somewhat: "Somewhat effective",
      neutral: "Neutral",
      not: "Not effective"
    }
  }
};

// Monochrome palette (cycled per bucket) — grayscale tones, labels carry meaning.
const DEMO_PALETTE = ["#14110d", "#403a32", "#615a4e", "#837b6c", "#a39a89", "#c2b9a6", "#15110d", "#544d42"];

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
    li.querySelector(".genre-n").textContent = "";
    li.querySelector(".genre-bar-fill").style.width =
      Math.max(0, Math.min(1, pct)) * 100 + "%";
    list.appendChild(li);
  });

  renderDemographics(data.demographics || {});
  renderSurvey(data.survey || {});
}

// ---------- demographics ----------
function renderDemographics(demos) {
  renderChartGrid("demo-grid", DEMO_META, demos);
}

// ---------- post-survey ----------
function renderSurvey(survey) {
  const meta = document.getElementById("survey-meta");
  if (meta) {
    const n = survey.n_responses || 0;
    if (n > 0 && survey.avg_rating != null) {
      meta.textContent = `Based on ${n.toLocaleString()} responses · average rating ${survey.avg_rating} / 5.`;
    } else {
      meta.textContent = "";
    }
  }
  renderChartGrid("survey-grid", SURVEY_META, survey);
}

// Shared renderer for both the demographics and survey chart grids.
function renderChartGrid(gridId, metaMap, data) {
  const grid = document.getElementById(gridId);
  if (!grid) return;
  grid.innerHTML = "";

  Object.keys(metaMap).forEach(field => {
    const meta = metaMap[field];
    const buckets = data[field] || {};
    const items = orderBuckets(meta, buckets);
    const total = items.reduce((s, x) => s + (x.n || 0), 0);

    const card = document.createElement("section");
    card.className = "demo-card";
    card.appendChild(buildEl("h3", { className: "demo-title", text: meta.title }));
    card.appendChild(buildEl("p", { className: "demo-total", text: `${total.toLocaleString()} responses` }));

    if (total === 0) {
      card.appendChild(buildEl("p", { className: "demo-empty", text: "No responses yet." }));
      grid.appendChild(card);
      return;
    }

    const chart = meta.type === "donut" ? buildDonut(items, total) : buildBarChart(items, total);
    card.appendChild(chart);
    grid.appendChild(card);
  });
}

function orderBuckets(meta, buckets) {
  const seen = new Set();
  const out = [];
  meta.order.forEach(key => {
    if (key in buckets) {
      out.push({ key, label: meta.labels[key] || key, ...buckets[key] });
      seen.add(key);
    }
  });
  Object.keys(buckets).forEach(key => {
    if (!seen.has(key)) {
      out.push({ key, label: meta.labels[key] || key, ...buckets[key] });
    }
  });
  return out.filter(x => (x.n || 0) > 0);
}

function buildEl(tag, opts) {
  const el = document.createElement(tag);
  if (opts) {
    if (opts.className) el.className = opts.className;
    if (opts.text != null) el.textContent = opts.text;
    if (opts.attrs) {
      Object.keys(opts.attrs).forEach(k => el.setAttribute(k, opts.attrs[k]));
    }
  }
  return el;
}

function svgEl(name, attrs) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", name);
  if (attrs) {
    Object.keys(attrs).forEach(k => el.setAttribute(k, attrs[k]));
  }
  return el;
}

function colorFor(idx) {
  return DEMO_PALETTE[idx % DEMO_PALETTE.length];
}

function buildBarChart(items, total) {
  const wrap = buildEl("div", { className: "demo-bars" });
  const max = items.reduce((m, x) => Math.max(m, x.n || 0), 0) || 1;

  items.forEach((item, i) => {
    const pct = total > 0 ? item.n / total : 0;
    const fill = Math.max(0.02, (item.n || 0) / max);

    const row = buildEl("div", { className: "demo-bar-row" });

    const head = buildEl("div", { className: "demo-bar-head" });
    head.appendChild(buildEl("span", { className: "demo-bar-label", text: item.label }));
    const stats = buildEl("span", { className: "demo-bar-stats" });
    stats.appendChild(buildEl("span", { className: "demo-bar-n", text: `${item.n.toLocaleString()} (${(pct * 100).toFixed(0)}%)` }));
    if (item.accuracy != null) {
      stats.appendChild(buildEl("span", {
        className: "demo-bar-acc",
        text: `${(item.accuracy * 100).toFixed(0)}% acc`
      }));
    }
    head.appendChild(stats);
    row.appendChild(head);

    const track = buildEl("div", { className: "demo-bar-track" });
    const bar = buildEl("div", { className: "demo-bar-fill" });
    bar.style.width = fill * 100 + "%";
    bar.style.background = colorFor(i);
    track.appendChild(bar);
    row.appendChild(track);

    wrap.appendChild(row);
  });

  return wrap;
}

function buildDonut(items, total) {
  const wrap = buildEl("div", { className: "demo-donut-wrap" });

  const size = 160;
  const radius = 64;
  const stroke = 28;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * radius;

  const svg = svgEl("svg", {
    viewBox: `0 0 ${size} ${size}`,
    class: "demo-donut",
    role: "img",
    "aria-label": "Distribution chart"
  });

  svg.appendChild(svgEl("circle", {
    cx, cy, r: radius,
    fill: "none",
    stroke: "var(--rule)",
    "stroke-width": stroke
  }));

  let offset = 0;
  items.forEach((item, i) => {
    const fraction = total > 0 ? item.n / total : 0;
    if (fraction <= 0) return;
    const seg = svgEl("circle", {
      cx, cy, r: radius,
      fill: "none",
      stroke: colorFor(i),
      "stroke-width": stroke,
      "stroke-dasharray": `${fraction * circumference} ${circumference}`,
      "stroke-dashoffset": -offset,
      transform: `rotate(-90 ${cx} ${cy})`
    });
    svg.appendChild(seg);
    offset += fraction * circumference;
  });

  const center = svgEl("text", {
    x: cx, y: cy + 6,
    "text-anchor": "middle",
    class: "demo-donut-center"
  });
  center.textContent = total.toLocaleString();
  svg.appendChild(center);

  wrap.appendChild(svg);

  const legend = buildEl("ul", { className: "demo-legend" });
  items.forEach((item, i) => {
    const pct = total > 0 ? item.n / total : 0;
    const li = buildEl("li", { className: "demo-legend-row" });
    const swatch = buildEl("span", { className: "demo-swatch" });
    swatch.style.background = colorFor(i);
    li.appendChild(swatch);

    const text = buildEl("span", { className: "demo-legend-text" });
    text.appendChild(buildEl("span", { className: "demo-legend-label", text: item.label }));
    const meta = buildEl("span", { className: "demo-legend-meta" });
    meta.appendChild(buildEl("span", { className: "demo-legend-n", text: `${item.n.toLocaleString()} (${(pct * 100).toFixed(0)}%)` }));
    if (item.accuracy != null) {
      meta.appendChild(buildEl("span", {
        className: "demo-legend-acc",
        text: `${(item.accuracy * 100).toFixed(0)}% acc`
      }));
    }
    text.appendChild(meta);
    li.appendChild(text);

    legend.appendChild(li);
  });
  wrap.appendChild(legend);

  return wrap;
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
