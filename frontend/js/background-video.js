const backgroundVideo = document.getElementById("background-video");

if (backgroundVideo) {
  const fadeTime = 0.75;

  const showVideo = () => {
    backgroundVideo.classList.add("visible");
  };

  if (backgroundVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    showVideo();
  } else {
    backgroundVideo.addEventListener("loadeddata", showVideo, { once: true });
  }

  backgroundVideo.addEventListener("timeupdate", () => {
    const { currentTime, duration } = backgroundVideo;
    if (!Number.isFinite(duration)) return;

    // Reveal the still image as the video ends, then fade back into the new loop.
    backgroundVideo.classList.toggle(
      "visible",
      currentTime >= fadeTime / 2 && duration - currentTime > fadeTime
    );
  });
}
