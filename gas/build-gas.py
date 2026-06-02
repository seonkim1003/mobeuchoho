#!/usr/bin/env python3
"""Generate the Google Apps Script mirror (gas/index.html, gas/stats.html)
from the canonical Cloudflare app sources.

The GAS build is a single self-contained HTML file per page:
  - CSS is inlined into a <style> block (no external stylesheets).
  - JS is inlined into a <script> block (no external scripts).
  - Asset URLs are rewritten to absolute https://mobeauchoho.org/... URLs,
    because Apps Script serves one HTML file and can't host /images or /videos.
  - submitQuizData() is proxied through google.script.run (CORS workaround).
  - The stats page reads server-injected EMBEDDED_STATS instead of fetching
    /api/stats (Code.gs fetches it and templates it in via <?!= statsJson ?>).

Run from the repo root:  python3 gas/build-gas.py
Then publish with:       (cd gas && clasp push)
"""

import re
import io
import base64
import pathlib
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
GAS = ROOT / "gas"
ORIGIN = "https://mobeauchoho.org"

# Quiz images are displayed small, so downscale before inlining to keep the
# self-contained GAS HTML light. Tune these if quality/size needs change.
IMG_MAX_SIDE = 1000
IMG_QUALITY = 80


def read(name: str) -> str:
    return (ROOT / name).read_text(encoding="utf-8")


def extract_main(html: str) -> str:
    """Return the <main>...</main> block, dropping external scripts/links."""
    m = re.search(r"<main>.*?</main>", html, re.DOTALL)
    if not m:
        raise SystemExit("could not find <main> block")
    return m.group(0)


def absolutize_assets(text: str) -> str:
    """Rewrite root-relative asset paths to absolute GAS-safe URLs."""
    # videos referenced as src="videos/foo.mp4" in index.html
    text = text.replace('src="videos/', f'src="{ORIGIN}/videos/')
    return text


def image_data_uri(filename: str) -> str:
    """Downscale a quiz image and return it as a base64 JPEG data URI.

    The Apps Script iframe sandbox blocks cross-origin image requests, so the
    GAS build embeds every image directly instead of hotlinking the site.
    """
    img = Image.open(ROOT / "images" / filename).convert("RGB")
    w, h = img.size
    scale = min(1.0, IMG_MAX_SIDE / max(w, h))
    if scale < 1.0:
        img = img.resize((round(w * scale), round(h * scale)), Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=IMG_QUALITY, optimize=True)
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    return "data:image/jpeg;base64," + b64


def inline_images(image_js: str) -> str:
    """Replace each `url: "/images/foo.jpg"` with an embedded data URI."""
    return re.sub(
        r'url: "/images/([^"]+)"',
        lambda m: 'url: "' + image_data_uri(m.group(1)) + '"',
        image_js,
    )


# ---------------------------------------------------------------- index page
def build_index() -> str:
    style = read("styles.css") + "\n" + read("image-styles.css")
    body = absolutize_assets(extract_main(read("index.html")))

    image_js = inline_images(read("image-data.js"))
    quiz_js = read("quiz.js")

    # Swap the fetch-based telemetry for the google.script.run proxy.
    fetch_block = """  if (MOCK_API) {
    console.info("[MOCK_API] would POST", SUBMIT_ENDPOINT, payload);
    return;
  }

  try {
    fetch(SUBMIT_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true
    }).catch(() => { /* swallow: never block UX on telemetry */ });
  } catch (_) {"""
    gas_block = """  try {
    google.script.run
      .withSuccessHandler(function() {})
      .withFailureHandler(function() {})
      .submitQuizData(payload);
  } catch (_) {"""
    if fetch_block not in quiz_js:
        raise SystemExit("submitQuizData fetch block not found — quiz.js changed shape")
    quiz_js = quiz_js.replace(fetch_block, gas_block)

    script = image_js + "\n\n" + quiz_js

    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>AI or Human?</title>
  <style>
{style}
  </style>
</head>
<body>
  {body}
  <script>
{script}
  </script>
</body>
</html>
"""


# ---------------------------------------------------------------- stats page
def build_stats() -> str:
    style = read("styles.css") + "\n" + read("stats.css")
    body = extract_main(read("stats.html"))
    # Tag the "Take the quiz" link so the GAS link-fix can find it.
    body = body.replace(
        '<a class="stats-link" href="index.html">',
        '<a id="quiz-link" class="stats-link" href="index.html">',
    )

    stats_js = read("stats.js")

    # Replace the fetch-based loader with one that reads EMBEDDED_STATS.
    loader_re = re.compile(
        r"async function loadStats\(\) \{.*?\n\}", re.DOTALL
    )
    gas_loader = """function loadStats() {
  showState({ loading: true });
  try {
    var data = (typeof EMBEDDED_STATS !== "undefined" && EMBEDDED_STATS)
      ? EMBEDDED_STATS
      : MOCK_STATS;
    renderStats(data);
    showState({ content: true });
  } catch (_) {
    showState({ error: true });
  }
}"""
    if not loader_re.search(stats_js):
        raise SystemExit("loadStats not found — stats.js changed shape")
    stats_js = loader_re.sub(gas_loader, stats_js)

    preamble = """// Injected server-side by Code.gs — avoids a cross-origin fetch from the browser
var EMBEDDED_STATS = <?!= statsJson ?>;

// Point the "Take the quiz" link at the base GAS URL (no ?page=stats)
(function() {
  var link = document.getElementById("quiz-link");
  if (link) link.href = window.location.href.split("?")[0];
})();
"""
    script = preamble + "\n" + stats_js

    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Quiz Results</title>
  <style>
{style}
  </style>
</head>
<body>
  {body}
  <script>
{script}
  </script>
</body>
</html>
"""


def main() -> None:
    (GAS / "index.html").write_text(build_index(), encoding="utf-8")
    (GAS / "stats.html").write_text(build_stats(), encoding="utf-8")
    print("Wrote gas/index.html and gas/stats.html")


if __name__ == "__main__":
    main()
