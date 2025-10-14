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
    movement.speedX = (Math.random() - 0.5) * 400; // Increased speed
    movement.x = Math.max(
      0,
      Math.min(movement.x, containerBounds.width - bounds.width)
    );
  }
  if (movement.y <= 0 || movement.y >= containerBounds.height - bounds.height) {
    movement.speedY = (Math.random() - 0.5) * 400; // Increased speed
    movement.y = Math.max(
      0,
      Math.min(movement.y, containerBounds.height - bounds.height)
    );
  }

  el.style.transform = `translate(${movement.x}px, ${movement.y}px)`;
  requestAnimationFrame(() => moveRandomly(el, movement));
}
