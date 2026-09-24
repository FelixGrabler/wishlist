window.pageInitializers.edit = function (pageRoot) {
  const getElement = id => pageRoot.querySelector(`#${id}`);
  const reportError = error => { if (pageRoot.isConnected) showError(error, pageRoot); };
  const wishlistDiv = getElement("floating-wishlist") || getElement("wishlist");
  const personNameHeader = getElement("person-name");
  const viewLink = getElement("view-link");
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
    void navigate("/", { replace: true });
  }
  viewLink.href = `/${encodeURIComponent(person)}`;

  async function loadWishlist() {
    try {
      const data = await api("/people");
      if (!pageRoot.isConnected) return;
      // case-insensitive lookup
      const personKey = Object.keys(data).find(
        (k) => k.toLowerCase() === person.toLowerCase()
      );
      const personData = personKey ? data[personKey] : null;

      if (!personData) {
        alert("Person nicht gefunden!");
        void navigate("/", { replace: true });
        return;
      }

      const displayName = personKey || person;
      person = displayName;
      personNameHeader.textContent = `Wunschliste von ${displayName} bearbeiten`;
      viewLink.href = `/${encodeURIComponent(displayName)}`;
      wishlistDiv.innerHTML = "";

      if (!personData.items.length) {
        const empty = document.createElement("p");
        empty.className = "empty-state";
        empty.textContent = "Noch keine Wünsche vorhanden.";
        wishlistDiv.appendChild(empty);
      }
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
          preview.tabIndex = 0;
          preview.setAttribute("role", "button");
          preview.setAttribute("aria-label", `${item.name}: Bild vergrößern`);
          preview.addEventListener("keydown", event => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              openImagePreview(item.image, item.name);
            }
          });
          content.appendChild(preview);
        }

        const textWrapper = document.createElement("span");
        textWrapper.className = "wishlist-item__text";
        const link = safeLink(item.url);
        const textEl = document.createElement(link ? "a" : "span");
        textEl.textContent = item.name;
        textEl.className = "wishlist-item__text-inner";
        if (link) {
          textEl.href = link;
          textEl.rel = "noopener noreferrer";
          textEl.classList.add("wishlist-item__text-link");
        }
        textWrapper.appendChild(textEl);
        content.appendChild(textWrapper);

        const deleteButton = document.createElement("button");
        deleteButton.textContent = "\u2715";
        deleteButton.className = "delete-button";
        deleteButton.style.color = contrastColor(bg);
        deleteButton.setAttribute("aria-label", `${item.name} löschen`);
        deleteButton.onclick = () => removeItem(item.id, item.name);

        itemDiv.appendChild(content);
        const editButton = document.createElement("button");
        editButton.textContent = "Bearbeiten";
        editButton.setAttribute("aria-label", `${item.name} bearbeiten`);
        editButton.onclick = () => startEditing(item);
        itemDiv.appendChild(editButton);
        itemDiv.appendChild(deleteButton);
        wishlistDiv.appendChild(itemDiv);
      });
    } catch (error) {
      console.error("Error loading wishlist:", error);
      reportError(error);
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

  const itemForm = getElement("item-form");
  let editingItem = null;
  let saving = false;

  function startEditing(item) {
    if (saving) return;
    editingItem = item;
    itemForm.reset();
    getElement("item-name").value = item.name;
    getElement("item-link").value = item.url || "";
    getElement("form-heading").textContent = "Wunsch bearbeiten";
    getElement("save-item").textContent = "Speichern";
    getElement("cancel-edit").hidden = false;
    getElement("remove-image-label").hidden = !item.image;
    getElement("item-name").focus();
    itemForm.scrollIntoView({ block: "center" });
  }

  function resetEditor() {
    editingItem = null;
    itemForm.reset();
    getElement("form-heading").textContent = "Wunsch hinzufügen";
    getElement("save-item").textContent = "Hinzufügen";
    getElement("cancel-edit").hidden = true;
    getElement("remove-image-label").hidden = true;
  }
  getElement("cancel-edit").addEventListener("click", resetEditor);

  itemForm.addEventListener("submit", async event => {
    event.preventDefault();
    if (saving) return;
    const name = getElement("item-name").value.trim();
    if (!name) { reportError(new Error("Bitte einen Wunsch eingeben.")); return; }
    saving = true;
    const controls = [...itemForm.elements];
    controls.forEach(control => control.disabled = true);
    getElement("status").textContent = "";
    try {
      const file = getElement("item-image").files[0];
      let image = getElement("remove-image").checked ? "" : editingItem?.image || "";
      if (file) {
        if (file.size > 5 * 1024 * 1024) throw new Error("Das Bild darf höchstens 5 MB groß sein.");
        if (!["image/png", "image/jpeg", "image/gif", "image/webp"].includes(file.type)) {
          throw new Error("Bitte ein PNG-, JPEG-, GIF- oder WebP-Bild auswählen.");
        }
        image = await readFileAsDataURL(file);
      }
      await api(`/people/${encodeURIComponent(person)}/items${editingItem ? `/${editingItem.id}` : ""}`, {
        method: editingItem ? "PUT" : "POST",
        body: new URLSearchParams({ item_name: name, item_link: getElement("item-link").value.trim(), item_image: image }),
      });
      resetEditor();
      await loadWishlist();
    } catch (error) {
      reportError(error);
    } finally {
      saving = false;
      controls.forEach(control => control.disabled = false);
    }
  });

  async function removeItem(itemId, itemName) {
    if (saving) return;
    const confirmed = confirm(
      `Sind Sie sicher, dass Sie "${itemName}" von der Wunschliste entfernen möchten?`
    );
    if (!confirmed) return;

    try {
      const useLegacy = itemId === undefined || itemId === null;
      const identifier = useLegacy ? itemName : itemId;
      const pathSegment = useLegacy ? "items-by-name" : "items";
      await api(
        `/people/${encodeURIComponent(
          person
        )}/${pathSegment}/${encodeURIComponent(identifier)}`,
        {
          method: "DELETE",
        }
      );
      if (editingItem?.id === itemId) resetEditor();
      await loadWishlist();
    } catch (error) {
      console.error("Error removing item:", error);
      reportError(error);
    }
  }

  const personDialog = getElement("delete-person-dialog");
  const deletePersonButton = getElement("confirm-delete-person");
  const personMessage = getElement("delete-person-message");
  getElement("cancel-delete-person").addEventListener("click", () => personDialog.close());
  getElement("person-settings").addEventListener("click", async () => {
    if (saving) return;
    deletePersonButton.disabled = true;
    personMessage.textContent = "Wunschliste wird geprüft …";
    personDialog.showModal();
    try {
      const people = await api("/people");
      if (!pageRoot.isConnected) return;
      const key = Object.keys(people).find(name => name.toLowerCase() === person.toLowerCase());
      if (!key) throw new Error("Person nicht gefunden.");
      const empty = people[key].items.length === 0;
      personMessage.textContent = empty
        ? `Möchten Sie „${key}“ löschen? Die Wunschliste ist leer.`
        : "Diese Person hat noch Wünsche. Bitte zuerst alle Wünsche entfernen, bevor Sie die Person löschen.";
      deletePersonButton.disabled = !empty;
    } catch (error) { personMessage.textContent = error.message; }
  });
  deletePersonButton.addEventListener("click", async () => {
    if (deletePersonButton.disabled || !confirm(`„${person}“ wirklich endgültig löschen?`)) return;
    deletePersonButton.disabled = true;
    try {
      await api(`/people/${encodeURIComponent(person)}`, { method: "DELETE" });
      if (!pageRoot.isConnected) return;
      personDialog.close();
      await navigate("/", { replace: true });
    } catch (error) {
      personMessage.textContent = error.message;
      deletePersonButton.disabled = false;
    }
  });

  return loadWishlist();

};
