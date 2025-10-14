function moveRandomly(el, movement) {
  const now = Date.now();
  const deltaTime = (now - movement.lastUpdate) / 1000; // seconds
  movement.lastUpdate = now;

  // Apply velocity
  movement.x += movement.speedX * deltaTime;
  movement.y += movement.speedY * deltaTime;

  const bounds = el.getBoundingClientRect();
  const containerBounds = wishlistDiv.getBoundingClientRect();

  // Bounce on X
  if (movement.x <= 0) {
    movement.x = 0;
    movement.speedX = Math.abs(movement.speedX) * (0.6 + Math.random() * 0.8);
  } else if (movement.x + bounds.width >= containerBounds.width) {
    movement.x = Math.max(0, containerBounds.width - bounds.width);
    movement.speedX = -Math.abs(movement.speedX) * (0.6 + Math.random() * 0.8);
  }

  // Bounce on Y
  if (movement.y <= 0) {
    movement.y = 0;
    movement.speedY = Math.abs(movement.speedY) * (0.6 + Math.random() * 0.8);
  } else if (movement.y + bounds.height >= containerBounds.height) {
    movement.y = Math.max(0, containerBounds.height - bounds.height);
    movement.speedY = -Math.abs(movement.speedY) * (0.6 + Math.random() * 0.8);
  }

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
