const backend = "/api";
const wishlistDiv = document.getElementById("wishlist");
const personNameHeader = document.getElementById("person-name");
const viewLink = document.getElementById("view-link");
const backgroundMusic = document.getElementById("background-music");

function contrastColor(hex) {
  if (!hex) return "#000";
  hex = hex.replace("#", "");
  if (hex.length === 3)
    hex = hex
      .split("")
      .map((c) => c + c)
      .join("");
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
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

// Get person name from URL path (support both /edit/Name and /Name/edit)
let person = null;
const pathname = window.location.pathname;
if (pathname.startsWith("/edit/")) {
  person = decodeURIComponent(pathname.split("/edit/")[1] || "");
} else if (pathname.endsWith("/edit")) {
  person = decodeURIComponent(pathname.slice(1).replace(/\/edit$/, ""));
} else {
  // fallback: try to extract the second segment
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] === "edit" && parts[1]) person = decodeURIComponent(parts[1]);
}
if (!person) {
  window.location.href = "/";
}
viewLink.href = `/${encodeURIComponent(person)}`;
viewLink.target = "_blank";

async function loadWishlist() {
  try {
    const res = await fetch(`${backend}/people`);
    const data = await res.json();
    // case-insensitive lookup
    const personKey = Object.keys(data).find(
      (k) => k.toLowerCase() === person.toLowerCase()
    );
    const personData = personKey ? data[personKey] : null;

    if (!personData) {
      alert("Person nicht gefunden!");
      window.location.href = "/";
      return;
    }

    personNameHeader.textContent = `Wunschliste von ${person} bearbeiten`;
    wishlistDiv.innerHTML = "";

    personData.items.forEach((item) => {
      const itemDiv = document.createElement("div");
      itemDiv.className = "wishlist-item";
      const bg = personData.color || "#eee";
      itemDiv.style.backgroundColor = bg;
      itemDiv.style.color = contrastColor(bg);

      const label = document.createElement("span");
      label.textContent = item.name;

      const deleteButton = document.createElement("button");
      deleteButton.textContent = "\u2715";
      deleteButton.className = "delete-button";
      deleteButton.style.color = contrastColor(bg);
      deleteButton.onclick = () => removeItem(item.name);

      itemDiv.appendChild(label);
      itemDiv.appendChild(deleteButton);
      wishlistDiv.appendChild(itemDiv);
    });
  } catch (error) {
    console.error("Error loading wishlist:", error);
    alert("Fehler beim Laden der Wunschliste");
  }
}

window.addItem = async function () {
  const itemInput = document.getElementById("item-name");
  const item_name = itemInput.value.trim();

  if (!item_name) return;

  try {
    await fetch(`${backend}/people/${encodeURIComponent(person)}/items`, {
      method: "POST",
      body: new URLSearchParams({ item_name }),
    });
    itemInput.value = "";
    await loadWishlist();
  } catch (error) {
    console.error("Error adding item:", error);
    alert("Fehler beim Hinzufügen des Geschenks");
  }
};

async function removeItem(itemName) {
  const confirmed = confirm(
    `Sind Sie sicher, dass Sie "${itemName}" von der Wunschliste entfernen möchten?`
  );
  if (!confirmed) return;

  try {
    await fetch(
      `${backend}/people/${encodeURIComponent(
        person
      )}/items/${encodeURIComponent(itemName)}`,
      {
        method: "DELETE",
      }
    );
    await loadWishlist();
  } catch (error) {
    console.error("Error removing item:", error);
    alert("Fehler beim Entfernen des Geschenks");
  }
}

loadWishlist();
