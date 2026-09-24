(() => {
  const first = document.getElementById("background-video");
  if (!first) return;
  const second = first.cloneNode(true);
  second.id = "background-video-next";
  first.classList.add("background-video");
  second.classList.add("background-video");
  first.after(second);
  const videos = [first, second];
  let active = first;
  let incoming = null;
  let pending = false;
  let fadeStarted = null;
  let frame = null;
  const fadeMs = 1000;
  const paused = () => window.motionPaused || document.hidden;

  async function beginOverlap() {
    if (pending || incoming || paused()) return;
    const next = videos.find(video => video !== active);
    pending = true;
    next.currentTime = 0;
    next.style.opacity = "0";
    next.style.zIndex = "-1";
    active.style.zIndex = "-2";
    try {
      await next.play();
      if (paused()) { next.pause(); return; }
      incoming = next;
      fadeStarted = null;
    } catch { /* Keep the last frame visible if playback is unavailable. */ }
    finally { pending = false; }
  }

  function tick(now) {
    frame = null;
    if (paused()) return;
    if (incoming && incoming.readyState >= 2 && !incoming.seeking) {
      fadeStarted ??= now;
      const progress = Math.min(1, (now - fadeStarted) / fadeMs);
      // Keep the outgoing video opaque beneath the incoming one to avoid a dark dip.
      incoming.style.opacity = String(progress);
      if (progress === 1) {
        active.pause();
        active.style.opacity = "0";
        active = incoming;
        incoming = null;
      }
    } else if (!incoming && Number.isFinite(active.duration) && active.duration - active.currentTime <= 1.3) {
      void beginOverlap();
    }
    frame = requestAnimationFrame(tick);
  }

  function syncPlayback() {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    if (paused()) {
      videos.forEach(video => video.pause());
      // Restart the overlap after resuming rather than count time spent hidden.
      if (incoming) { incoming.style.opacity = "0"; incoming = null; }
      return;
    }
    active.play().then(() => { active.style.opacity = "1"; }).catch(() => {});
    frame = requestAnimationFrame(tick);
  }
  document.addEventListener("visibilitychange", syncPlayback);
  window.addEventListener("motionchange", syncPlayback);
  syncPlayback();
})();
