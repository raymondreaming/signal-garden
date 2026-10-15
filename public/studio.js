import { root, mergePatch, effect } from "./vendor/datastar.js";
import { defaults, normalize } from "./field.js";

const field = document.getElementById("field");
let history = [],
  position = -1,
  pending,
  restoring = false,
  collection = [],
  noticeTimer;
let controller;
const key = "signal-garden.collection.v2";
const presets = {
  bloom: { ...defaults },
  vortex: {
    ...defaults,
    system: "vortex",
    palette: "ember",
    count: 2400,
    twist: 65,
    spread: 75,
    size: 30,
    speed: 45,
    seed: 728,
  },
  ribbons: {
    ...defaults,
    system: "ribbons",
    palette: "tide",
    count: 2200,
    twist: 55,
    spread: 74,
    size: 32,
    speed: 30,
    seed: 185,
  },
  constellation: {
    ...defaults,
    system: "constellation",
    palette: "gold",
    count: 1200,
    twist: 48,
    spread: 75,
    size: 40,
    speed: 22,
    lines: true,
    seed: 91,
  },
};
function announce(text) {
  mergePatch({ notice: text });
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => mergePatch({ notice: "" }), 3500);
}
function commit() {
  clearTimeout(pending);
  const next = JSON.stringify(normalize(root));
  if (history[position] === next) return;
  history = history.slice(0, position + 1);
  history.push(next);
  if (history.length > 40) history.shift();
  position = history.length - 1;
  mergePatch({ canUndo: position > 0, canRedo: false });
}
function restore(config) {
  studio.stop();
  field.clearPins();
  mergePatch(normalize(config));
}
function renderCollection() {
  const container = document.getElementById("collection");
  container.replaceChildren();
  if (!collection.length) {
    const empty = document.createElement("p");
    empty.className = "collection-empty";
    empty.textContent =
      "A place for your happy accidents. Save a composition to start your collection.";
    container.append(empty);
    return;
  }
  collection.forEach((item, index) => {
    const card = document.createElement("article");
    card.className = "saved-card";
    const load = document.createElement("button");
    load.className = "saved-load";
    load.title = "Load this recipe";
    const image = document.createElement("img");
    image.src = item.image;
    image.alt = `Saved ${item.config.system} composition`;
    image.width = 320;
    image.height = 200;
    const title = document.createElement("span");
    title.textContent = `${item.config.system} / ${String(item.config.seed).padStart(5, "0")}`;
    load.append(image, title);
    load.addEventListener("click", () => {
      restore(item.config);
      announce("Recipe restored. Animation starts a new moment.");
    });
    const remove = document.createElement("button");
    remove.className = "saved-remove";
    remove.textContent = "×";
    remove.setAttribute(
      "aria-label",
      `Remove saved ${item.config.system} ${item.config.seed}`,
    );
    remove.addEventListener("click", () => {
      const next = collection.filter((_, i) => i !== index);
      try {
        localStorage.setItem(key, JSON.stringify(next));
        collection = next;
        renderCollection();
        announce("Removed from your collection.");
      } catch {
        announce("Browser storage is unavailable.");
      }
    });
    card.append(load, remove);
    container.append(card);
  });
}
const studio = (window.studio = {
  init() {
    let initial = {
      ...defaults,
      playing: !matchMedia("(prefers-reduced-motion: reduce)").matches,
    };
    try {
      const hash = new URLSearchParams(location.hash.slice(1)).get("recipe");
      if (hash && hash.length < 3000) initial = normalize(JSON.parse(hash));
    } catch {
      announce("That recipe link could not be read. Starting a fresh garden.");
    }
    mergePatch(initial);
    try {
      const saved = JSON.parse(localStorage.getItem(key) || "[]");
      if (Array.isArray(saved))
        collection = saved
          .filter(
            (item) =>
              item &&
              typeof item.image === "string" &&
              /^data:image\/(?:webp|png);base64,/.test(item.image) &&
              item.image.length < 250000,
          )
          .slice(0, 8)
          .map((item) => ({
            config: normalize(item.config),
            image: item.image,
          }));
    } catch {
      announce("Your local collection could not be read.");
    }
    renderCollection();
    commit();
    effect(() => {
      const snapshot = JSON.stringify(normalize(root));
      clearTimeout(pending);
      if (!restoring && snapshot !== history[position])
        pending = setTimeout(commit, 180);
    });
    document.addEventListener("keydown", (event) => {
      if (
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.target.closest("input,select,textarea,button,a,[contenteditable]")
      )
        return;
      if (event.key === " ") {
        event.preventDefault();
        mergePatch({ playing: !root.playing });
      }
      if (event.key.toLowerCase() === "r") studio.shuffle();
      if (event.key.toLowerCase() === "s") studio.save();
      if (event.key.toLowerCase() === "h") mergePatch({ help: !root.help });
      if (["1", "2", "3", "4"].includes(event.key))
        studio.preset(Object.keys(presets)[Number(event.key) - 1]);
      if (event.key === "Escape") {
        studio.stop();
        mergePatch({ help: false, inspect: false });
      }
    });
    field.addEventListener("field-metrics", (event) =>
      mergePatch({ fps: event.detail.fps }),
    );
    field.addEventListener("pins-changed", (event) =>
      mergePatch({ pins: event.detail }),
    );
    window.addEventListener("hashchange", () => {
      try {
        const recipe = new URLSearchParams(location.hash.slice(1)).get(
          "recipe",
        );
        if (recipe && recipe.length < 3000) {
          restore(JSON.parse(recipe));
          announce("Shared recipe loaded.");
        }
      } catch {
        announce("That recipe link could not be read.");
      }
    });
    window.addEventListener("pagehide", () => controller?.abort());
  },
  preset(name) {
    if (presets[name]) {
      restore({ ...presets[name], playing: root.playing });
      announce(`${name[0].toUpperCase() + name.slice(1)} system loaded.`);
    }
  },
  shuffle() {
    mergePatch({
      seed: Math.floor(Math.random() * 99999) + 1,
      twist: Math.floor(Math.random() * 85) + 8,
    });
  },
  undo() {
    commit();
    if (position < 1) return;
    restoring = true;
    restore(JSON.parse(history[--position]));
    restoring = false;
    mergePatch({
      canUndo: position > 0,
      canRedo: position < history.length - 1,
    });
  },
  redo() {
    clearTimeout(pending);
    if (position >= history.length - 1) return;
    restoring = true;
    restore(JSON.parse(history[++position]));
    restoring = false;
    mergePatch({
      canUndo: position > 0,
      canRedo: position < history.length - 1,
    });
  },
  save() {
    if (collection.length >= 8) {
      announce("Your collection has eight recipes. Remove one to make room.");
      return;
    }
    const next = [
      { config: normalize(root), image: field.thumbnail() },
      ...collection,
    ];
    try {
      localStorage.setItem(key, JSON.stringify(next));
      collection = next;
      renderCollection();
      announce("Recipe saved on this device.");
    } catch {
      announce("Could not save. Browser storage may be full or unavailable.");
    }
  },
  async share() {
    const url = new URL(location.href);
    url.hash = new URLSearchParams({
      recipe: JSON.stringify(normalize(root)),
    }).toString();
    window.history.replaceState(null, "", url);
    try {
      await navigator.clipboard.writeText(url.href);
      announce("Recipe link copied.");
    } catch {
      mergePatch({ shareLink: url.href });
      document.getElementById("share-link").focus();
      document.getElementById("share-link").select();
      announce("Copy the recipe link from the field.");
    }
  },
  async export() {
    try {
      await field.exportImage();
      announce("PNG exported.");
    } catch {
      announce("Image export failed. Please try again.");
    }
  },
  begin() {
    controller?.abort();
    controller = new AbortController();
    mergePatch({
      growth: 0.12,
      drift: 0,
      frame: 0,
      elapsed: 0,
      status: "Germinating",
      inspect: true,
    });
    return controller;
  },
  stop() {
    if (controller) {
      controller.abort();
      controller = null;
    }
    mergePatch({ growth: 1, drift: 0, status: "Ready" });
  },
  streamFailed() {
    mergePatch({ growth: 1, drift: 0, status: "Connection interrupted" });
    announce("Evolution lost its connection. Your local controls still work.");
  },
});
