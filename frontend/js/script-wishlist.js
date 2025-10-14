const backend = "/api";
// Use a dedicated container for the public floating layer so edit `#wishlist` stays interactive
const wishlistDiv =
  document.getElementById("floating-wishlist") ||
  document.getElementById("wishlist");
const personNameHeader = document.getElementById("person-name");
const backgroundMusic = document.getElementById("background-music");

// Helper: choose readable text color (black or white) based on background hex
function contrastColor(hex) {
  if (!hex) return "#000";
  // Normalize
  hex = hex.replace("#", "");
  if (hex.length === 3)
    hex = hex
      .split("")
      .map((c) => c + c)
      .join("");
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  // Perceived luminance
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 140 ? "#000" : "#fff";
}

// Start playing background music when user interacts with the page
document.addEventListener(
  "click",
  () => {
    backgroundMusic.play().catch(console.error);
  },
  { once: true }
);

// Get person name from URL path
const pathname = window.location.pathname;
// Accept /Name or /edit/Name or /Name/edit
let person = null;
if (pathname.startsWith("/edit/")) {
  person = decodeURIComponent(pathname.split("/edit/")[1] || "");
} else if (pathname.endsWith("/edit")) {
  person = decodeURIComponent(pathname.slice(1).replace(/\/edit$/, ""));
} else if (pathname !== "/") {
  person = decodeURIComponent(pathname.slice(1));
}
if (!person) {
  // Not a person page -> go back to root
  window.location.href = "/";
}

async function loadWishlist() {
  try {
    const res = await fetch(`${backend}/people`);
    const data = await res.json();
    // Case-insensitive person lookup
    const personName = Object.keys(data).find(
      (name) => name.toLowerCase() === person.toLowerCase()
    );
    const personData = personName ? data[personName] : null;

    if (!personData) {
      alert("Person nicht gefunden!");
      window.location.href = "/";
      return;
    }

    personNameHeader.textContent = `Wunschliste von ${person}`;
    wishlistDiv.innerHTML = "";

    personData.items.forEach((item) => {
      const itemDiv = document.createElement("div");
      itemDiv.className = "floating-item";
      const bg = personData.color || "#ddd";
      itemDiv.style.backgroundColor = bg;
      itemDiv.style.color = contrastColor(bg);
      itemDiv.textContent = item.name;
      wishlistDiv.appendChild(itemDiv);

      // Initialize random movement inside the container bounds
      const movement = {
        x:
          Math.random() *
          Math.max(0, wishlistDiv.clientWidth - itemDiv.offsetWidth),
        y:
          Math.random() *
          Math.max(0, wishlistDiv.clientHeight - itemDiv.offsetHeight),
        speedX: (Math.random() - 0.5) * 220 * 1.5,
        speedY: (Math.random() - 0.5) * 220 * 1.5,
        lastUpdate: Date.now(),
        maxSpeed: 260 * 1.5,
      };
      // ensure the element has an initial transform
      itemDiv.style.transform = `translate(${movement.x}px, ${movement.y}px)`;
      // public view items shouldn't capture pointer events
      itemDiv.style.pointerEvents = "none";
      moveRandomly(itemDiv, movement);
    });
  } catch (error) {
    console.error("Error loading wishlist:", error);
    alert("Fehler beim Laden der Wunschliste");
  }
}

loadWishlist();
