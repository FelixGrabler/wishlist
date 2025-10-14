const backend = "http://localhost:8000";
const wishlistDiv = document.getElementById("wishlist");
const personSelect = document.getElementById("person-select");

async function refreshPeople() {
  const res = await fetch(`${backend}/people`);
  const data = await res.json();
  personSelect.innerHTML = "";
  wishlistDiv.innerHTML = "";

  Object.entries(data).forEach(([person, items]) => {
    const opt = document.createElement("option");
    opt.value = person;
    opt.textContent = person;
    personSelect.appendChild(opt);

    items.forEach((item) => createFloatingItem(item.name, person));
  });
}

async function addPerson() {
  const name = document.getElementById("person-name").value;
  await fetch(`${backend}/people`, {
    method: "POST",
    body: new URLSearchParams({ name }),
  });
  refreshPeople();
}

async function addItem() {
  const person = personSelect.value;
  const item_name = document.getElementById("item-name").value;
  await fetch(`${backend}/people/${person}/items`, {
    method: "POST",
    body: new URLSearchParams({ item_name }),
  });
  refreshPeople();
}

function createFloatingItem(name, owner) {
  const el = document.createElement("div");
  el.className = "item";
  el.textContent = `${owner}: ${name}`;
  wishlistDiv.appendChild(el);
  moveRandomly(el);
}

function moveRandomly(el) {
  const x = Math.random() * (wishlistDiv.clientWidth - 100);
  const y = Math.random() * (wishlistDiv.clientHeight - 50);
  el.style.transform = `translate(${x}px, ${y}px)`;
  setTimeout(() => moveRandomly(el), 2000);
}

refreshPeople();
