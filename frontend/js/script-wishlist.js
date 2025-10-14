const backend = "/api";
const wishlistDiv = document.getElementById("wishlist");
const personNameHeader = document.getElementById("person-name");
const backgroundMusic = document.getElementById("background-music");

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
// Only load wishlist if we're on a person's page (not root or edit)
if (pathname === "/" || pathname.endsWith("/edit")) {
  window.location.href = "/";
}
const person = decodeURIComponent(pathname.slice(1));

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
      itemDiv.className = "item";
      itemDiv.style.backgroundColor = personData.color;

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = item.completed || false;

      const label = document.createElement("span");
      label.textContent = item.name;
      if (item.completed) {
        label.style.textDecoration = "line-through";
      }

      itemDiv.appendChild(checkbox);
      itemDiv.appendChild(label);
      wishlistDiv.appendChild(itemDiv);

      // Initialize random movement
      const movement = {
        x: Math.random() * (wishlistDiv.clientWidth - 150),
        y: Math.random() * (wishlistDiv.clientHeight - 80),
        speedX: (Math.random() - 0.5) * 400, // Increased speed
        speedY: (Math.random() - 0.5) * 400, // Increased speed
        lastUpdate: Date.now(),
      };

      moveRandomly(itemDiv, movement);

      checkbox.onclick = async (e) => {
        if (
          !item.completed &&
          !confirm("Möchten Sie dieses Geschenk als erledigt markieren?")
        ) {
          e.preventDefault();
          return;
        }
        try {
          await fetch(
            `${backend}/people/${encodeURIComponent(
              person
            )}/items/${encodeURIComponent(item.name)}/complete`,
            {
              method: "POST",
            }
          );
          item.completed = !item.completed;
        } catch (error) {
          console.error("Error updating item:", error);
          alert("Fehler beim Aktualisieren des Geschenks");
          e.preventDefault();
        }
      };

      label = document.createElement("span");
      label.textContent = item.name;
      if (item.completed) {
        label.style.textDecoration = "line-through";
      }

      itemDiv.appendChild(checkbox);
      itemDiv.appendChild(label);
      wishlistDiv.appendChild(itemDiv);
    });
  } catch (error) {
    console.error("Error loading wishlist:", error);
    alert("Fehler beim Laden der Wunschliste");
  }
}

loadWishlist();
