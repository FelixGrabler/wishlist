// Replace only the page content: the audio/video elements stay mounted and playing.
let navigationRequest = null;
async function navigate(destination, { replace = false, fromHistory = false } = {}) {
  const url = new URL(destination, location.href);
  navigationRequest?.abort();
  const controller = new AbortController();
  navigationRequest = controller;
  try {
    const response = await fetch(url, { signal: controller.signal, cache: "no-cache" });
    if (!response.ok) throw new Error("Seite konnte nicht geladen werden. Bitte erneut versuchen.");
    const parsed = new DOMParser().parseFromString(await response.text(), "text/html");
    const nextPage = parsed.getElementById("page");
    if (!nextPage || !window.pageInitializers[nextPage.dataset.page]) {
      location.assign(url);
      return;
    }
    if (controller.signal.aborted) return;
    if (!fromHistory) history[replace ? "replaceState" : "pushState"]({}, "", url);
    document.querySelectorAll("dialog[open]").forEach(dialog => dialog.close());
    document.getElementById("page").replaceWith(nextPage);
    document.title = parsed.title;
    document.body.classList.toggle("public-wishlist", nextPage.dataset.page === "wishlist");
    window.scrollTo(0, 0);
    const heading = nextPage.querySelector("h1");
    if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
    await initializePage(nextPage);
  } catch (error) {
    if (error.name === "AbortError") return;
    if (fromHistory) { location.reload(); return; }
    showError(error);
  }
}

document.addEventListener("click", event => {
  const link = event.target.closest("a[href]");
  if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.hasAttribute("download") || link.target) return;
  const url = new URL(link.href);
  if (url.origin !== location.origin || url.hash || /^\/(api|assets|js|styles|templates)(\/|$)/.test(url.pathname)) return;
  event.preventDefault();
  void navigate(url);
});
window.addEventListener("popstate", () => void navigate(location.href, { fromHistory: true }));
void initializePage(document.getElementById("page"));
