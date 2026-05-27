# Plan: Add a second test section (AI vs human-drawn images)

## Context

The quiz currently has one section: 5 side-by-side text passages where the user picks which was written by AI. We want a **second section of 5 image questions** (AI-generated image vs human-drawn art), running back-to-back with the text section in a single quiz with one combined results screen at the end.

User decisions:
- Section 2 = **AI image vs human-drawn art** (both are artwork)
- **Back-to-back** flow: text Qs → image Qs → video → combined results
- **5 image questions** (matches section 1, total 10)
- Image URLs are remote (Unsplash / Wikimedia Commons) placeholders the user can swap later
- **Two coding agents work in parallel on different machines** → the work must be split so they never edit the same file

## Strategy for parallel work (no merge conflicts)

The split is **by file, not by feature line**. Person 1 owns all *existing* files. Person 2 only creates *new* files. They communicate via a fixed contract (the `IMAGE_PAIRS` global and three CSS class names) — neither needs to read the other's code to do their work.

| File | Owner | Action |
|---|---|---|
| `quiz.js` | Person 1 | edit |
| `index.html` | Person 1 | edit |
| `styles.css` | Person 1 | edit (tiny — just a `.passage.image { padding: 0; }` reset) |
| `image-data.js` | **Person 2** | **create** |
| `image-styles.css` | **Person 2** | **create** |

Result: `git merge` is trivial — no file is touched by both agents.

## Contract between Person 1 and Person 2

Both agents must agree on these three things before starting. Nothing else needs to be coordinated.

### 1. Global variable

Person 2 declares:
```js
const IMAGE_PAIRS = [ /* 5 items */ ];
```
Person 1 reads `IMAGE_PAIRS` at quiz start. Person 1 uses a `typeof IMAGE_PAIRS !== "undefined" ? IMAGE_PAIRS : []` guard so the quiz still runs (text-only) if Person 2's file is missing.

### 2. Image item shape

```js
{
  type: "image",
  genre: string,                                  // e.g. "Portrait", "Landscape"
  human: { url: string, attribution: string },
  ai:    { url: string, attribution: string }
}
```

### 3. CSS class contract

Person 1 will, in the rendered DOM, produce:
- Quiz card: `<div class="passage image"><img class="passage-image" src="..." alt=""></div>`
- Breakdown: `<div class="side-text"><img class="side-image" src="..." alt=""></div>`

Person 2 styles **only** `.passage-image` and `.side-image` (and may add `.passage.image` overrides if needed). Person 2 does not touch any other selector.

---

## Person 1 — Infrastructure (existing files)

### Files: `quiz.js`, `index.html`, `styles.css`

**`quiz.js` changes:**

1. Mark each existing item in `PAIRS` (lines 4–71) with `type: "text"`.
2. Replace the order construction in `startQuiz()` (line 103):
   ```js
   const imagePairs = (typeof IMAGE_PAIRS !== "undefined") ? IMAGE_PAIRS : [];
   state.allItems = [...PAIRS, ...imagePairs];
   const textIdx  = state.allItems.map((p,i) => p.type === "text"  ? i : -1).filter(i => i >= 0);
   const imageIdx = state.allItems.map((p,i) => p.type === "image" ? i : -1).filter(i => i >= 0);
   state.order = [...shuffle(textIdx), ...shuffle(imageIdx)];
   ```
   Update everywhere that reads `PAIRS[...]` to read `state.allItems[...]` instead. Update `PAIRS.length` references to `state.allItems.length`.
3. In `renderQuestion()` (lines 112–131):
   - Read `pair.type`.
   - Set `document.getElementById("prompt-text").textContent` to `"Which one was written by AI?"` (text) or `"Which one was made by AI?"` (image).
   - Replace the two `textContent` assignments with a helper:
     ```js
     function renderSide(container, data, type, isPoetry) {
       container.className = "passage";
       container.innerHTML = "";
       if (type === "image") {
         container.classList.add("image");
         const img = document.createElement("img");
         img.className = "passage-image";
         img.src = data.url;
         img.alt = "";
         container.appendChild(img);
       } else {
         if (isPoetry) container.classList.add("poetry");
         container.textContent = data.text;
       }
     }
     ```
4. In `renderResults()` (lines 144–199):
   - Branch the `.side-text` filler: for image items, replace `item.querySelectorAll(".side-text")[k].textContent = data.text` with code that inserts `<img class="side-image" src="${data.url}" alt="">`.

**`index.html` changes:**

1. In `<head>`, after the existing `<link>`, add:
   ```html
   <link rel="stylesheet" href="image-styles.css" />
   ```
2. Add `id="prompt-text"` to the prompt:
   ```html
   <p id="prompt-text" class="prompt">Which one was written by AI?</p>
   ```
3. Before `<script src="quiz.js"></script>`, add:
   ```html
   <script src="image-data.js"></script>
   ```

**`styles.css` changes:**

Add a single small block to reset card padding for image cards (Person 1 keeps responsibility for layout/card geometry; Person 2 styles only the images themselves):
```css
.passage.image { padding: 0; margin-bottom: 18px; }
```

**Person 1 testing (standalone, no dependency on Person 2):**

- Run `preview_start quiz`.
- Quiz should run exactly as before (5 text questions) because `IMAGE_PAIRS` is undefined and the guard yields `[]`.
- Verify no console errors about missing `image-data.js` or `image-styles.css` (the browser will 404 these but the quiz still works).
- Optionally, paste a tiny stub `IMAGE_PAIRS = [{type:"image",genre:"X",human:{url:"https://placehold.co/600x450",attribution:"H"},ai:{url:"https://placehold.co/600x450",attribution:"AI"}}]` into the console and call `startQuiz()` to confirm image rendering works.

---

## Person 2 — Image content (new files only)

### Files: `image-data.js` (new), `image-styles.css` (new)

**`image-data.js`** — declare `IMAGE_PAIRS` with 5 entries. Suggested categories: Portrait, Landscape, Still life, Surreal scene, Abstract. For each:

- `human.url` — Wikimedia Commons URL of a public-domain painting (Van Gogh, Hokusai, Monet, etc.). Use the direct file URL (ending in `.jpg` or `.png`).
- `human.attribution` — `"Artist Name, Title (year)"`.
- `ai.url` — Unsplash URL of digital/abstract artwork as a placeholder. Format: `https://images.unsplash.com/photo-…?w=800`.
- `ai.attribution` — `"Generated by AI"` (placeholder text; the user will swap in real AI images later).

Skeleton:
```js
const IMAGE_PAIRS = [
  {
    type: "image",
    genre: "Portrait",
    human: { url: "https://upload.wikimedia.org/...", attribution: "..." },
    ai:    { url: "https://images.unsplash.com/...",   attribution: "Generated by AI" }
  },
  // 4 more
];
```

**`image-styles.css`** — style only the image elements Person 1 produces. Required selectors:
```css
.passage-image {
  display: block;
  width: 100%;
  aspect-ratio: 4 / 3;
  object-fit: cover;
  border-radius: 8px;
  background: #f2f2f2;
}
.side-image {
  display: block;
  width: 100%;
  max-height: 220px;
  object-fit: cover;
  border-radius: 6px;
  margin-bottom: 10px;
}
```
Person 2 may tune sizes/aspect-ratio to taste. Do **not** add rules for `.pair-grid`, `.pick-card`, `.passage` (without `.image`), `.pair-side`, `.breakdown-item`, or any layout container — those belong to Person 1.

**Person 2 testing (standalone, no dependency on Person 1):**

- Create a tiny scratch `test.html` that loads `image-styles.css` and renders a couple of `<img class="passage-image">` and `<img class="side-image">` inside dummy `.passage.image` / `.side-text` containers. Confirm visuals.
- Visit each `human.url` directly in a browser to confirm the file is hosted at the URL (Wikimedia hotlinks should return 200).

---

## Integration

When both agents push:
- Person 1's `index.html` already references `image-data.js` and `image-styles.css`, so on merge the new files are automatically picked up.
- No file conflict: Person 1 only edited existing files; Person 2 only created new files.
- Run the full verification (below) to confirm end-to-end behavior.

## Full verification (run after both branches merge)

1. `preview_start quiz`, `preview_resize` to 1280×800.
2. Start → I agree → answer Q1–Q5: prompt reads "Which one was written by AI?", text passages render in cards.
3. Q6 onward: prompt switches to "Which one was made by AI?", images render side-by-side filling the cards.
4. After Q10: video screen → Continue → results show "X / 10 correct" with breakdown of all 10 questions. Text Qs show text in `.side-text`; image Qs show thumbnail `<img class="side-image">`. `.is-ai` / `.is-human` color coding and `.picked` outline still appear on every row.
5. Edge: `preview_resize` to 760×900 — `.pair-grid` collapses to single column, images don't overflow.
6. Open DevTools console — no errors, no 404s on `image-data.js` or `image-styles.css`.

## Out of scope (both persons)

- Real AI-generated image assets (user will swap URLs later)
- Section divider screen between text and image questions
- Per-section sub-scores in results (single combined score only)
- Changing "Passage A/B" labels to "Image A/B"
