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

  if (Object.keys(data).length === 0) {
    const message = document.createElement("p");
    message.textContent =
      "Noch keine Personen vorhanden. Fügen Sie eine Person hinzu!";
    message.style.textAlign = "center";
    peopleGrid.appendChild(message);
    return;
  }

  Object.entries(data).forEach(([person, info]) => {
    const personCard = document.createElement("div");
    personCard.className = "person-card";
    personCard.style.backgroundColor = info.color;

    const name = document.createElement("h3");
    name.textContent = person;

    const viewButton = document.createElement("button");
    viewButton.textContent = "Wunschliste anzeigen";
    viewButton.onclick = () =>
      (window.location.href = `/${encodeURIComponent(person)}`);

    const editButton = document.createElement("button");
    editButton.textContent = "Wunschliste bearbeiten";
    editButton.onclick = () =>
      (window.location.href = `/${encodeURIComponent(person)}/edit`);

    personCard.appendChild(name);
    personCard.appendChild(viewButton);
    personCard.appendChild(editButton);
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
