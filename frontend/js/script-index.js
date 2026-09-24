window.pageInitializers.index = function (pageRoot) {
  const getElement = id => pageRoot.querySelector(`#${id}`);
  const reportError = error => { if (pageRoot.isConnected) showError(error, pageRoot); };
  const peopleGrid = getElement("people-grid");
  async function refreshPeople() {
    const data = await api("/people");
      if (!pageRoot.isConnected) return;
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

      const name = document.createElement("h3");
      name.textContent = person;
      name.style.color = contrastColor(bg);

      const viewLink = document.createElement("a");
      viewLink.textContent = "Wunschliste anzeigen";
      viewLink.href = `/${encodeURIComponent(person)}`;
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

  getElement("person-form").addEventListener("submit", async event => {
    event.preventDefault();
    const button = event.submitter || event.currentTarget.querySelector("button[type=submit]");
    if (button.disabled) return;
    const nameInput = getElement("person-name");
    const colorInput = getElement("person-color");
    const name = nameInput.value.trim();
    const color = colorInput.value;

    if (!name) return;

    try {
      button.disabled = true;
      getElement("status").textContent = "";
      await api("/people", {
        method: "POST",
        body: new URLSearchParams({ name, color }),
      });
      nameInput.value = "";
      await refreshPeople();
    } catch (error) {
      console.error("Error adding person:", error);
      reportError(error);
    } finally { button.disabled = false; }
  });

  return refreshPeople().catch(reportError);

};
