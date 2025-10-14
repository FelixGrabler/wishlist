const backend = "/api";
const wishlistDiv = document.getElementById("wishlist");
const personNameHeader = document.getElementById("person-name");
const viewLink = document.getElementById("view-link");
const backgroundMusic = document.getElementById("background-music");

// Start playing background music when user interacts with the page
document.addEventListener(
  "click",
  () => {
    backgroundMusic.play().catch(console.error);
  },
  { once: true }
);

// Get person name from URL path (remove the /edit part)
const person = decodeURIComponent(
  window.location.pathname.slice(1).replace(/\/edit$/, "")
);
viewLink.href = `/${encodeURIComponent(person)}`;

async function loadWishlist() {
  try {
    const res = await fetch(`${backend}/people`);
    const data = await res.json();
    const personData = data[person];

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
      itemDiv.style.backgroundColor = personData.color;

      const label = document.createElement("span");
      label.textContent = item.name;

      const deleteButton = document.createElement("button");
      deleteButton.textContent = "✕";
      deleteButton.className = "delete-button";
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
