// Section 2 data — AI image vs human-drawn art.
// Read by quiz.js at startQuiz() via `typeof IMAGE_PAIRS` guard.
//
// Images are self-hosted under /images/ (committed to the repo).
// The GAS version uses absolute URLs via the BASE_URL prefix below.

const IMAGE_PAIRS = [
  {
    type: "image",
    genre: "Portrait",
    human: {
      url: "/images/portrait-human.jpg",
      attribution: "Johannes Vermeer, Girl with a Pearl Earring (c. 1665)"
    },
    ai: {
      url: "/images/portrait-ai.jpg",
      attribution: "AI-generated portrait — Wikimedia Commons"
    }
  },
  {
    type: "image",
    genre: "Landscape",
    human: {
      url: "/images/landscape-human.jpg",
      attribution: "Katsushika Hokusai, The Great Wave off Kanagawa (c. 1831)"
    },
    ai: {
      url: "/images/landscape-ai.jpg",
      attribution: "AI-generated landscape (Adobe Firefly) — Wikimedia Commons"
    }
  },
  {
    type: "image",
    genre: "Still life",
    human: {
      url: "/images/stilllife-human.jpg",
      attribution: "Vincent van Gogh, Sunflowers (1888)"
    },
    ai: {
      url: "/images/stilllife-ai.png",
      attribution: "AI-generated still life — Wikimedia Commons"
    }
  },
  {
    type: "image",
    genre: "Surreal scene",
    human: {
      url: "/images/surreal-human.jpg",
      attribution: "Hieronymus Bosch, The Garden of Earthly Delights (c. 1500)"
    },
    ai: {
      url: "/images/surreal-ai.png",
      attribution: "AI-generated surreal scene (DALL·E) — Wikimedia Commons"
    }
  },
  {
    type: "image",
    genre: "Abstract",
    human: {
      url: "/images/abstract-human.jpg",
      attribution: "Wassily Kandinsky, Composition 8 (1923)"
    },
    ai: {
      url: "/images/abstract-ai.jpg",
      attribution: "AI-generated abstract art — Wikimedia Commons"
    }
  }
];
