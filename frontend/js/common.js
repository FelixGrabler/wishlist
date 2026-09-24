const backend = "/api";

async function api(path, options) {
  const response = await fetch(`${backend}${path}`, options);
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(response.status === 413 ? "Das Bild ist zu groß (maximal 5 MB)." :
      typeof data?.detail === "string" ? data.detail : "Die Anfrage ist fehlgeschlagen. Bitte erneut versuchen.");
  }
  return response.json();
}

function showError(error, root = document) {
  const status = root.querySelector("#status");
  status.textContent = error.message || "Verbindung fehlgeschlagen. Bitte erneut versuchen.";
}

function contrastColor(hex) {
  const channels = (hex || "#eeeeee").replace("#", "").match(/.{2}/g);
  if (!channels || channels.length !== 3) return "#000";
  const [r, g, b] = channels.map(c => {
    const value = parseInt(c, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.179 ? "#000" : "#fff";
}

function safeLink(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch { return ""; }
}

function openImagePreview(src, alt) {
  const dialog = document.getElementById("image-lightbox");
  const img = document.getElementById("image-lightbox-img");
  img.src = src;
  img.alt = alt || "Bildvorschau";
  dialog.showModal();
}

window.pageInitializers = {};

function initializePage(root) {
  const lightbox = root.querySelector("#image-lightbox");
  root.querySelector("#image-lightbox-close")?.addEventListener("click", () => lightbox.close());
  lightbox?.addEventListener("click", event => { if (event.target === lightbox) lightbox.close(); });
  lightbox?.addEventListener("close", () => root.querySelector("#image-lightbox-img").removeAttribute("src"));
  return window.pageInitializers[root.dataset.page](root);
}

const music = document.getElementById("background-music");
const musicButton = document.getElementById("music-toggle");
let musicEnabled = true;
try { musicEnabled = localStorage.getItem("wishlist-music") !== "off"; } catch { /* Storage can be unavailable. */ }

function updateMusicButton() {
  const label = musicEnabled ? "Musik ausschalten" : "Musik einschalten";
  musicButton.setAttribute("aria-label", label);
  musicButton.title = label;
  musicButton.setAttribute("aria-pressed", String(musicEnabled));
  musicButton.querySelector(".sound-on").toggleAttribute("hidden", !musicEnabled);
  musicButton.querySelector(".sound-off").toggleAttribute("hidden", musicEnabled);
}

function startMusic() {
  if (musicEnabled && music.paused) {
    // Browsers can block audible autoplay until a user gesture. Retry on interaction.
    music.play().then(() => { if (!musicEnabled) music.pause(); }).catch(() => {});
  }
}
musicButton.addEventListener("click", () => {
  musicEnabled = !musicEnabled;
  try { localStorage.setItem("wishlist-music", musicEnabled ? "on" : "off"); } catch { /* Optional preference storage. */ }
  updateMusicButton();
  if (musicEnabled) startMusic(); else music.pause();
});
document.addEventListener("pointerdown", startMusic, { passive: true });
document.addEventListener("keydown", startMusic);
updateMusicButton();
startMusic();

// Respect the device preference without offering a separate motion control.
const motionPreference = matchMedia("(prefers-reduced-motion: reduce)");
function setMotionPreference() {
  window.motionPaused = motionPreference.matches;
  document.body.classList.toggle("motion-paused", window.motionPaused);
  window.dispatchEvent(new Event("motionchange"));
}
motionPreference.addEventListener("change", setMotionPreference);
setMotionPreference();
