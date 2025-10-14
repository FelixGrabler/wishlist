const backend = "/api";
const peopleGrid = document.getElementById("people-grid");
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
  peopleGrid.innerHTML = "";

  const names = Object.keys(data || {});
  if (names.length === 0) {
    const message = document.createElement("p");
    message.textContent =
      "Noch keine Personen vorhanden. F\u00FCgen Sie eine Person hinzu!";
    message.style.textAlign = "center";
    peopleGrid.appendChild(message);
    return;
  }

  names.forEach((person) => {
    const info = data[person];
    const personCard = document.createElement("div");
    personCard.className = "person-card";
    const bg = info.color || "#ccc";
    personCard.style.backgroundColor = bg;

    // compute readable text color
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

    const name = document.createElement("h3");
    name.textContent = person;
    name.style.color = contrastColor(bg);

    const viewLink = document.createElement("a");
    viewLink.textContent = "Wunschliste anzeigen";
    viewLink.href = `/${encodeURIComponent(person)}`;
    viewLink.target = "_blank"; // open in new tab
    viewLink.rel = "noopener noreferrer";
    viewLink.className = "link-button";

    const editLink = document.createElement("a");
    editLink.textContent = "Wunschliste bearbeiten";
    // prefer /edit/Name style
    editLink.href = `/edit/${encodeURIComponent(person)}`;
    editLink.className = "link-button";

    viewLink.style.color = contrastColor(bg);
    editLink.style.color = contrastColor(bg);

    personCard.appendChild(name);
    personCard.appendChild(viewLink);
    personCard.appendChild(editLink);
    peopleGrid.appendChild(personCard);
  });
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

refreshPeople();
