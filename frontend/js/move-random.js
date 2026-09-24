function moveRandomly(el, movement) {
  if (!el.isConnected) return;
  const now = Date.now();
  const deltaTime = Math.min((now - movement.lastUpdate) / 1000, 0.05); // seconds
  movement.lastUpdate = now;

  if (window.motionPaused || document.hidden || el.matches(":hover, :focus-within") || document.querySelector("dialog[open]")) {
    requestAnimationFrame(() => moveRandomly(el, movement));
    return;
  }

  // Apply velocity
  movement.x += movement.speedX * deltaTime;
  movement.y += movement.speedY * deltaTime;

  const bounds = el.getBoundingClientRect();
  const containerBounds = el.parentElement.getBoundingClientRect();

  let bounced = false;

  // Bounce on X
  if (movement.x <= 0) {
    bounced = movement.speedX < 0;
    movement.x = 0;
    movement.speedX = Math.abs(movement.speedX) * (0.6 + Math.random() * 0.8);
  } else if (movement.x + bounds.width >= containerBounds.width) {
    bounced = movement.speedX > 0;
    movement.x = Math.max(0, containerBounds.width - bounds.width);
    movement.speedX = -Math.abs(movement.speedX) * (0.6 + Math.random() * 0.8);
  }

  // Bounce on Y
  if (movement.y <= 0) {
    bounced ||= movement.speedY < 0;
    movement.y = 0;
    movement.speedY = Math.abs(movement.speedY) * (0.6 + Math.random() * 0.8);
  } else if (movement.y + bounds.height >= containerBounds.height) {
    bounced ||= movement.speedY > 0;
    movement.y = Math.max(0, containerBounds.height - bounds.height);
    movement.speedY = -Math.abs(movement.speedY) * (0.6 + Math.random() * 0.8);
  }

  if (bounced) movement.onBounce?.();

  // Slightly nudge speed occasionally for variation
  if (Math.random() < 0.01) {
    movement.speedX += (Math.random() - 0.5) * 40;
    movement.speedY += (Math.random() - 0.5) * 40;
  }

  // Clamp speeds
  const max = movement.maxSpeed || 300;
  movement.speedX = Math.max(-max, Math.min(max, movement.speedX));
  movement.speedY = Math.max(-max, Math.min(max, movement.speedY));

  el.style.transform = `translate(${movement.x}px, ${movement.y}px)`;
  requestAnimationFrame(() => moveRandomly(el, movement));
}

// A shuffled round-robin gives every wish a turn, unlike random z-index values
// that can repeatedly leave the same wish underneath the others.
function cycleFloatingLayers(container) {
  const order = [...container.querySelectorAll(".floating-item")];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const applyOrder = () => order.forEach((item, index) => { item.style.zIndex = String(index + 1); });
  applyOrder();
  if (order.length < 2) return () => {};

  let elapsed = 0;
  let lastFrame = performance.now();
  const paused = () => window.motionPaused || document.hidden ||
    container.querySelector(".floating-item:is(:hover, :focus-within)") ||
    document.querySelector("dialog[open]");
  function advance() {
    order.push(order.shift());
    applyOrder();
    elapsed = 0;
  }
  function tick(now) {
    if (!container.isConnected || !order[0].isConnected) return;
    // Ignore background-tab time; returning to the page should not shuffle rapidly.
    if (!paused()) elapsed += Math.min(now - lastFrame, 100);
    lastFrame = now;
    if (elapsed >= 5000) advance();
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  return () => {
    if (elapsed >= 3000 && !paused()) advance();
  };
}
