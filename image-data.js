// Section 2 data — AI image vs human-drawn art.
// Read by quiz.js at startQuiz() via `typeof IMAGE_PAIRS` guard.
//
// Schema (must stay in sync with the Person 1 / Person 2 contract):
//   {
//     type: "image",
//     genre: string,
//     human: { url: string, attribution: string },
//     ai:    { url: string, attribution: string }
//   }
//
// Image hosts must be allow-listed in `_headers` (`img-src`).
// Human side = Wikimedia Commons public-domain art.
// AI side = Wikimedia Commons "AI-generated images" subcategories
// (CC0/CC-BY uploads from the community — not always the same artist
// style as the human side, but verifiably AI-generated).

const IMAGE_PAIRS = [
  {
    type: "image",
    genre: "Portrait",
    human: {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0f/1665_Girl_with_a_Pearl_Earring.jpg/960px-1665_Girl_with_a_Pearl_Earring.jpg",
      attribution: "Johannes Vermeer, Girl with a Pearl Earring (c. 1665) — Wikimedia Commons"
    },
    ai: {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/32/Mona_Lisa_2024.jpg/960px-Mona_Lisa_2024.jpg",
      attribution: "AI-generated portrait (Mona Lisa 2024) — Wikimedia Commons"
    }
  },
  {
    type: "image",
    genre: "Landscape",
    human: {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Tsunami_by_hokusai_19th_century.jpg/960px-Tsunami_by_hokusai_19th_century.jpg",
      attribution: "Katsushika Hokusai, The Great Wave off Kanagawa (c. 1831) — Wikimedia Commons"
    },
    ai: {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ed/Scenic_Forest_Valley_in_the_Late_Afternoon_%28FLUX.1%29.jpg/960px-Scenic_Forest_Valley_in_the_Late_Afternoon_%28FLUX.1%29.jpg",
      attribution: "AI-generated landscape (FLUX.1) — Wikimedia Commons"
    }
  },
  {
    type: "image",
    genre: "Still life",
    human: {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/46/Vincent_Willem_van_Gogh_127.jpg/960px-Vincent_Willem_van_Gogh_127.jpg",
      attribution: "Vincent van Gogh, Sunflowers (1888) — Wikimedia Commons"
    },
    ai: {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Green_apple_gen.png/960px-Green_apple_gen.png",
      attribution: "AI-generated still life (green apple) — Wikimedia Commons"
    }
  },
  {
    type: "image",
    genre: "Surreal scene",
    human: {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/96/The_Garden_of_earthly_delights.jpg/960px-The_Garden_of_earthly_delights.jpg",
      attribution: "Hieronymus Bosch, The Garden of Earthly Delights (c. 1500) — Wikimedia Commons"
    },
    ai: {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/14/An_astronaut_floats_in_inky_black_space_surrounded_by_iridescent_floating_flowers.png/960px-An_astronaut_floats_in_inky_black_space_surrounded_by_iridescent_floating_flowers.png",
      attribution: "AI-generated surreal scene (DALL\u00b7E) — Wikimedia Commons"
    }
  },
  {
    type: "image",
    genre: "Abstract",
    human: {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/Vassily_Kandinsky%2C_1923_-_Composition_8%2C_huile_sur_toile%2C_140_cm_x_201_cm%2C_Mus%C3%A9e_Guggenheim%2C_New_York.jpg/960px-Vassily_Kandinsky%2C_1923_-_Composition_8%2C_huile_sur_toile%2C_140_cm_x_201_cm%2C_Mus%C3%A9e_Guggenheim%2C_New_York.jpg",
      attribution: "Wassily Kandinsky, Composition 8 (1923) — Wikimedia Commons"
    },
    ai: {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/21/Bioestat%C3%ADstica_abstrato.jpg/960px-Bioestat%C3%ADstica_abstrato.jpg",
      attribution: "AI-generated abstract art — Wikimedia Commons"
    }
  }
];
