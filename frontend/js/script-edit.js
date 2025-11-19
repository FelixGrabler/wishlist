const backend = "/api";
const wishlistDiv = document.getElementById("wishlist");
const personNameHeader = document.getElementById("person-name");
const viewLink = document.getElementById("view-link");
const backgroundMusic = document.getElementById("background-music");
const imageLightbox = document.getElementById("image-lightbox");
const imageLightboxImg = document.getElementById("image-lightbox-img");
const imageLightboxClose = document.getElementById("image-lightbox-close");

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

function openImagePreview(src, alt) {
  if (!imageLightbox || !imageLightboxImg || !src) return;
  imageLightboxImg.src = src;
  imageLightboxImg.alt = alt || "Bildvorschau";
  imageLightbox.classList.add("visible");
  imageLightbox.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
}

function closeImagePreview() {
  if (!imageLightbox || !imageLightboxImg) return;
  imageLightbox.classList.remove("visible");
  imageLightbox.setAttribute("aria-hidden", "true");
  imageLightboxImg.src = "";
  document.body.classList.remove("modal-open");
}

if (imageLightbox) {
  imageLightbox.addEventListener("click", (event) => {
    if (event.target === imageLightbox) {
      closeImagePreview();
    }
  });
}

imageLightboxClose?.addEventListener("click", closeImagePreview);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && imageLightbox?.classList.contains("visible")) {
    closeImagePreview();
  }
});

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

    const displayName = personKey || person;
    person = displayName;
    personNameHeader.textContent = `Wunschliste von ${displayName} bearbeiten`;
    viewLink.href = `/${encodeURIComponent(displayName)}`;
    wishlistDiv.innerHTML = "";

    personData.items.forEach((item) => {
      const itemDiv = document.createElement("div");
      itemDiv.className = "wishlist-item";
      const bg = personData.color || "#eee";
      itemDiv.style.backgroundColor = bg;
      itemDiv.style.color = contrastColor(bg);

      const content = document.createElement("div");
      content.className = "wishlist-item__content";

      if (item.image) {
        const preview = document.createElement("img");
        preview.src = item.image;
        preview.alt = item.name;
        preview.className = "wishlist-item__image";
        preview.addEventListener("click", (ev) => {
          ev.stopPropagation();
          openImagePreview(item.image, item.name);
        });
        content.appendChild(preview);
      }

      const textWrapper = document.createElement("span");
      textWrapper.className = "wishlist-item__text";
      const link = (item.url || "").trim();
      const textEl = document.createElement(link ? "a" : "span");
      textEl.textContent = item.name;
      textEl.className = "wishlist-item__text-inner";
      if (link) {
        textEl.href = link;
        textEl.target = "_blank";
        textEl.rel = "noopener noreferrer";
        textEl.classList.add("wishlist-item__text-link");
      }
      textWrapper.appendChild(textEl);
      content.appendChild(textWrapper);

      const deleteButton = document.createElement("button");
      deleteButton.textContent = "\u2715";
      deleteButton.className = "delete-button";
      deleteButton.style.color = contrastColor(bg);
      deleteButton.onclick = () => removeItem(item.id, item.name);

      itemDiv.appendChild(content);
      itemDiv.appendChild(deleteButton);
      wishlistDiv.appendChild(itemDiv);
    });
  } catch (error) {
    console.error("Error loading wishlist:", error);
    alert("Fehler beim Laden der Wunschliste");
  }
}

async function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

window.addItem = async function () {
  const itemInput = document.getElementById("item-name");
  const linkInput = document.getElementById("item-link");
  const imageInput = document.getElementById("item-image");
  const item_name = itemInput.value.trim();
  const item_link = linkInput.value.trim();
  const imageFile = imageInput.files && imageInput.files[0];

  if (!item_name) return;

  let item_image = "";
  if (imageFile) {
    try {
      item_image = await readFileAsDataURL(imageFile);
    } catch (error) {
      console.error("Error reading image file:", error);
      alert("Bild konnte nicht gelesen werden");
      return;
    }
  }

  try {
    const body = new URLSearchParams();
    body.append("item_name", item_name);
    if (item_link) body.append("item_link", item_link);
    if (item_image) body.append("item_image", item_image);

    const response = await fetch(`${backend}/people/${encodeURIComponent(person)}/items`, {
      method: "POST",
      body,
    });
    if (!response.ok) {
      const errorText = await response.text();
      const normalized = (errorText || "").toLowerCase();
      const tooLarge =
        response.status === 413 ||
        normalized.includes("too large") ||
        normalized.includes("entry-too-large");
      if (tooLarge) {
        alert("Das Bild ist zu groß. Bitte wählen Sie ein kleineres Bild.");
        return;
      }
      throw new Error(errorText || `Fehler beim Hinzufügen: ${response.status}`);
    }
    itemInput.value = "";
    linkInput.value = "";
    imageInput.value = "";
    await loadWishlist();
  } catch (error) {
    console.error("Error adding item:", error);
    alert("Fehler beim Hinzufügen des Geschenks");
  }
};

async function removeItem(itemId, itemName) {
  const confirmed = confirm(
    `Sind Sie sicher, dass Sie "${itemName}" von der Wunschliste entfernen möchten?`
  );
  if (!confirmed) return;

  try {
    const useLegacy = itemId === undefined || itemId === null;
    const identifier = useLegacy ? itemName : itemId;
    const pathSegment = useLegacy ? "items-by-name" : "items";
    await fetch(
      `${backend}/people/${encodeURIComponent(
        person
      )}/${pathSegment}/${encodeURIComponent(identifier)}`,
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
