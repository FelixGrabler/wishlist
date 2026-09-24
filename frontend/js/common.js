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

function showError(error) {
  const status = document.getElementById("status");
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

const lightbox = document.getElementById("image-lightbox");
document.getElementById("image-lightbox-close")?.addEventListener("click", () => lightbox.close());
lightbox?.addEventListener("click", event => { if (event.target === lightbox) lightbox.close(); });
lightbox?.addEventListener("close", () => document.getElementById("image-lightbox-img").removeAttribute("src"));

const music = document.getElementById("background-music");
const musicButton = document.getElementById("music-toggle");
musicButton.addEventListener("click", async () => {
  try {
    if (music.paused) await music.play(); else music.pause();
    musicButton.textContent = music.paused ? "Musik einschalten" : "Musik ausschalten";
    musicButton.setAttribute("aria-pressed", String(!music.paused));
  } catch { showError(new Error("Musik konnte nicht abgespielt werden.")); }
});

const motionPreference = matchMedia("(prefers-reduced-motion: reduce)");
window.motionPaused = motionPreference.matches;
const motionButton = document.getElementById("motion-toggle");
function setMotion(paused) {
  window.motionPaused = paused;
  document.body.classList.toggle("motion-paused", paused);
  motionButton.textContent = paused ? "Bewegung einschalten" : "Bewegung pausieren";
  motionButton.setAttribute("aria-pressed", String(paused));
  window.dispatchEvent(new Event("motionchange"));
}
motionButton.addEventListener("click", () => setMotion(!window.motionPaused));
motionPreference.addEventListener("change", event => setMotion(event.matches));
setMotion(window.motionPaused);
