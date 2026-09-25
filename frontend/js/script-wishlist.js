window.pageInitializers.wishlist = function (pageRoot) {
  const getElement = id => pageRoot.querySelector(`#${id}`);
  const reportError = error => { if (pageRoot.isConnected) showError(error, pageRoot); };
  const wishlistDiv = getElement("floating-wishlist") || getElement("wishlist");
  const personNameHeader = getElement("person-name");
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
    void navigate("/", { replace: true });
  }

  async function loadWishlist() {
    try {
      const personData = await api(`/people/${encodeURIComponent(person)}`);
      if (!pageRoot.isConnected) return;
      const displayName = personData.name;
      person = displayName;
      personNameHeader.textContent = `Wunschliste von ${displayName}`;
      wishlistDiv.innerHTML = "";

      if (!personData.items.length) {
        const empty = document.createElement("p");
        empty.className = "empty-state";
        empty.textContent = "Noch keine Wünsche vorhanden.";
        wishlistDiv.appendChild(empty);
      }
      let advanceLayers = () => {};
      personData.items.forEach((item) => {
        const itemDiv = document.createElement("div");
        itemDiv.className = "floating-item";
        const bg = personData.color || "#ddd";
        itemDiv.style.backgroundColor = bg;
        itemDiv.style.color = contrastColor(bg);
        itemDiv.classList.toggle("completed", Boolean(item.completed));
        const hasId = item.id !== undefined && item.id !== null;
        const identifier = hasId ? String(item.id) : item.name;
        if (identifier) {
          itemDiv.dataset.itemIdentifier = identifier;
        }
        itemDiv.dataset.identifierType = hasId ? "id" : "name";

        if (item.image) {
          const imageWrapper = document.createElement("div");
          imageWrapper.className = "floating-item__image-wrapper";
          const imageEl = document.createElement("img");
          imageEl.src = item.image;
          imageEl.alt = item.name;
          imageEl.className = "floating-item__image";
          const openPreview = (ev) => {
            ev.stopPropagation();
            openImagePreview(item.image, item.name);
          };
          imageWrapper.addEventListener("click", openPreview);
          imageEl.addEventListener("click", openPreview);
          imageWrapper.tabIndex = 0;
          imageWrapper.setAttribute("role", "button");
          imageWrapper.setAttribute("aria-label", `${item.name}: Bild vergrößern`);
          imageWrapper.addEventListener("keydown", event => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              openImagePreview(item.image, item.name);
            }
          });
          imageWrapper.appendChild(imageEl);
          itemDiv.appendChild(imageWrapper);
        }

        const contentWrapper = document.createElement("div");
        contentWrapper.className = "floating-item__content";

        const textWrapper = document.createElement("span");
        textWrapper.className = "floating-item__label";

        const link = safeLink(item.url);
        const text = document.createElement(link ? "a" : "span");
        text.textContent = item.name;
        text.className = "floating-item__text";
        if (link) {
          text.href = link;
          text.rel = "noopener noreferrer";
          text.classList.add("floating-item__text--link");
        }
        textWrapper.appendChild(text);
        contentWrapper.appendChild(textWrapper);

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.setAttribute("aria-label", `${item.name} erledigt`);
        checkbox.className = "floating-item__checkbox";
        checkbox.checked = Boolean(item.completed);
        checkbox.addEventListener("change", () =>
          updateItemCompletion(item.id, checkbox.checked, checkbox, itemDiv)
        );
        contentWrapper.appendChild(checkbox);

        itemDiv.appendChild(contentWrapper);

        itemDiv.addEventListener("click", (event) => {
          if (checkbox.disabled) return;
          let target = event.target;
          if (target === checkbox) return;
          if (!(target instanceof Element)) {
            target = target?.parentElement || null;
          }
          if (target && target.closest("a")) return;
          if (target && target.closest(".floating-item__image-wrapper")) return;
          checkbox.checked = !checkbox.checked;
          checkbox.dispatchEvent(new Event("change", { bubbles: true }));
        });

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
          onBounce: () => advanceLayers(),
        };
        // ensure the element has an initial transform
        itemDiv.style.transform = `translate(${movement.x}px, ${movement.y}px)`;
        moveRandomly(itemDiv, movement);
      });
      advanceLayers = cycleFloatingLayers(wishlistDiv);
    } catch (error) {
      console.error("Error loading wishlist:", error);
      reportError(error);
    }
  }

  async function updateItemCompletion(itemId, completed, checkbox, itemDiv) {
    try {
      const identifierType = itemDiv.dataset.identifierType || (itemId ? "id" : "name");
      const resolvedIdentifier = itemId ?? itemDiv.dataset.itemIdentifier;
      if (!resolvedIdentifier) {
        throw new Error("Missing item identifier for completion toggle");
      }
      const legacy = identifierType === "name";
      checkbox.disabled = true;
      itemDiv.classList.toggle("completed", completed);
      const pathSegment = legacy ? "items-by-name" : "items";
      const response = await api(
        `/people/${encodeURIComponent(
          person
        )}/${pathSegment}/${encodeURIComponent(resolvedIdentifier)}/complete`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ completed }),
        }
      );

      checkbox.checked = response.completed;
      itemDiv.classList.toggle("completed", response.completed);
    } catch (error) {
      console.error("Error updating completion:", error);
      reportError(error);
      checkbox.checked = !completed;
      itemDiv.classList.toggle("completed", !completed);
    } finally {
      checkbox.disabled = false;
    }
  }

  return loadWishlist();

};
