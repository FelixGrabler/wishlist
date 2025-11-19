const backend = "/api";
const wishlistDiv = document.getElementById("wishlist");
const personSelect = document.getElementById("person-select");
const backgroundMusic = document.getElementById("background-music");

// Start playing background music when user interacts with the page
document.addEventListener(
  "click",
  () => {
    backgroundMusic.play().catch(console.error);
  },
  { once: true }
);

async function refreshPeople() {
  const res = await fetch(`${backend}/people`);
  const data = await res.json();
  personSelect.innerHTML = "";
  wishlistDiv.innerHTML = "";

  // Add a default option
  const defaultOpt = document.createElement("option");
  defaultOpt.value = "";
  defaultOpt.textContent = "-- Person auswählen --";
  personSelect.appendChild(defaultOpt);

  // Add all items from all people
  Object.entries(data).forEach(([person, info]) => {
    const opt = document.createElement("option");
    opt.value = person;
    opt.textContent = person;
    personSelect.appendChild(opt);

    // Show items for this person
    info.items.forEach((item) =>
      createFloatingItem(item, person, info.color)
    );
  });
}

// No longer needed as we show all items all the time
function showItemsForPerson(items) {
  wishlistDiv.innerHTML = "";
  if (items) {
    items.forEach((item) => createFloatingItem(item));
  }
}

window.addPerson = async function () {
  const nameInput = document.getElementById("person-name");
  const colorInput = document.getElementById("person-color");
  const name = nameInput.value.trim();
  const color = colorInput.value;

  if (!name) return;

  try {
    await fetch(`${backend}/people`, {
      method: "POST",
      body: new URLSearchParams({ name, color }),
    });
    nameInput.value = "";
    await refreshPeople();
  } catch (error) {
    console.error("Error adding person:", error);
    alert("Fehler beim Hinzufügen der Person");
  }
};

window.addItem = async function () {
  const person = personSelect.value;
  const itemInput = document.getElementById("item-name");
  const item_name = itemInput.value.trim();

  if (!person || !item_name) return;

  try {
    await fetch(`${backend}/people/${encodeURIComponent(person)}/items`, {
      method: "POST",
      body: new URLSearchParams({ item_name }),
    });
    itemInput.value = "";
    await refreshPeople();
  } catch (error) {
    console.error("Error adding item:", error);
    alert("Fehler beim Hinzufügen des Geschenks");
  }
};

async function removeItem(item, person) {
  const confirmed = confirm(
    `Sind Sie sicher, dass Sie "${item.name}" von der Wunschliste entfernen möchten?`
  );
  if (!confirmed) return;

  try {
    const useLegacy = item.id === undefined || item.id === null;
    const identifier = useLegacy ? item.name : item.id;
    const pathSegment = useLegacy ? "items-by-name" : "items";
    await fetch(
      `${backend}/people/${encodeURIComponent(
        person
      )}/${pathSegment}/${encodeURIComponent(identifier)}`,
      {
        method: "DELETE",
      }
    );
    await refreshPeople();
  } catch (error) {
    console.error("Error removing item:", error);
    alert("Fehler beim Entfernen des Geschenks");
  }
}

function createFloatingItem(item, owner = "", color) {
  const el = document.createElement("div");
  el.className = "item";
  const ownerPrefix = owner ? `${owner}: ` : "";
  el.textContent = `${ownerPrefix}${item.name}`;
  el.onclick = () => removeItem(item, owner);
  el.title = "Klicken zum Entfernen";
  if (color) {
    el.style.backgroundColor = color;
  }
  wishlistDiv.appendChild(el);

  // Initialize random movement properties
  const movement = {
    x: Math.random() * (wishlistDiv.clientWidth - 300), // Adjusted for larger size
    y: Math.random() * (wishlistDiv.clientHeight - 160), // Adjusted for larger size
    speedX: (Math.random() - 0.5) * 400, // Doubled speed
    speedY: (Math.random() - 0.5) * 400, // Doubled speed
    lastUpdate: Date.now(),
  };

  moveRandomly(el, movement);
}

function moveRandomly(el, movement) {
  const now = Date.now();
  const deltaTime = (now - movement.lastUpdate) / 1000; // Convert to seconds
  movement.lastUpdate = now;

  // Update position
  movement.x += movement.speedX * deltaTime;
  movement.y += movement.speedY * deltaTime;

  // Check boundaries and bounce with new random speed
  const bounds = el.getBoundingClientRect();
  const containerBounds = wishlistDiv.getBoundingClientRect();

  if (movement.x <= 0 || movement.x >= containerBounds.width - bounds.width) {
    movement.speedX = (Math.random() - 0.5) * 200;
    movement.x = Math.max(
      0,
      Math.min(movement.x, containerBounds.width - bounds.width)
    );
  }
  if (movement.y <= 0 || movement.y >= containerBounds.height - bounds.height) {
    movement.speedY = (Math.random() - 0.5) * 200;
    movement.y = Math.max(
      0,
      Math.min(movement.y, containerBounds.height - bounds.height)
    );
  }

  el.style.transform = `translate(${movement.x}px, ${movement.y}px)`;
  requestAnimationFrame(() => moveRandomly(el, movement));
}

refreshPeople();
